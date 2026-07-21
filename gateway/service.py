from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from agents.manager import AgentManager
from governance.audit import AuditLedger
from governance.context import ExecutionBudget, ExecutionContext
from governance.pg_audit import PgAuditLedger
from models.manager import ModelManager
from planner.engine import PlannerEngine
from router.engine import RouterEngine
from tools.manager import ToolManager

logger = logging.getLogger("zoraos.gateway")


def server_sent_event(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@dataclass
class TaskRecord:
    id: str
    agent_type: str
    goal: str
    status: str = "pending"
    created_at: float = 0.0
    completed_at: float | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    approved_tools: list[str] = field(default_factory=list)


class GatewayService:
    def __init__(
        self,
        model_manager: ModelManager,
        agent_manager: AgentManager,
        tool_manager: ToolManager,
        planner: PlannerEngine,
        router: RouterEngine,
        audit_ledger: AuditLedger | None = None,
        database_url: str | None = None,
    ):
        self._model_manager = model_manager
        self._agent_manager = agent_manager
        self._tool_manager = tool_manager
        self._planner = planner
        self._router = router
        # The in-memory ledger stays authoritative for synchronous in-process
        # checks. PostgreSQL is an asynchronous durable mirror.
        self._audit_ledger = audit_ledger or AuditLedger()
        self._pg_audit: PgAuditLedger | None = None
        self._pg_audit_healthy = False
        self._tasks: dict[str, TaskRecord] = {}
        self._contexts: dict[str, ExecutionContext] = {}
        self._database_url = database_url

    async def startup(self) -> None:
        if self._pg_audit is not None or not self._database_url:
            return
        if self._database_url:
            try:
                dsn = self._database_url.replace(
                    "postgresql+asyncpg://",
                    "postgresql://",
                    1,
                )
                ledger = PgAuditLedger(dsn)
                await ledger.connect()
                self._pg_audit = ledger
                self._pg_audit_healthy = True
                await self._record_audit("gateway_started", {"durable_audit": True})
            except Exception as exc:
                self._pg_audit = None
                self._pg_audit_healthy = False
                logger.warning(
                    "PostgreSQL audit mirror unavailable; using in-memory audit: %s",
                    type(exc).__name__,
                )

    async def shutdown(self) -> None:
        if self._pg_audit:
            try:
                await self._record_audit("gateway_stopping", {"durable_audit": True})
            finally:
                await self._pg_audit.close()
                self._pg_audit = None
                self._pg_audit_healthy = False

    async def _record_audit(
        self,
        event_type: str,
        payload: dict[str, Any],
        task_id: str | None = None,
    ) -> None:
        """Record locally and mirror to PostgreSQL without losing local evidence."""

        self._audit_ledger.record(event_type, payload, task_id)
        if not self._pg_audit:
            return
        try:
            await self._pg_audit.record(event_type, payload, task_id)
            self._pg_audit_healthy = True
        except Exception as exc:
            self._pg_audit_healthy = False
            logger.error("PostgreSQL audit mirror failed: %s", type(exc).__name__)

    def _create_context(
        self,
        task_id: str,
        approved_tools: list[str] | None,
        budget: dict[str, Any] | None,
    ) -> ExecutionContext:
        config = budget or {}
        max_tokens = config.get("max_tokens")
        context = ExecutionContext(
            task_id=task_id,
            approved_tools=frozenset(approved_tools or []),
            budget=ExecutionBudget(
                max_tool_calls=max(0, min(int(config.get("max_tool_calls", 20)), 50)),
                max_iterations=max(1, min(int(config.get("max_iterations", 10)), 20)),
                max_tokens=(
                    max(256, min(int(max_tokens), 100_000)) if max_tokens is not None else None
                ),
                max_wall_seconds=max(
                    5,
                    min(int(config.get("max_wall_seconds", 300)), 3600),
                ),
            ),
        )
        self._contexts[task_id] = context
        return context

    async def chat(
        self,
        messages: list[dict[str, str]],
        agent: str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        last_msg = messages[-1]["content"] if messages else ""
        route = await self._router.route(last_msg, self._model_manager.available_providers)

        provider = kwargs.pop("provider", None) or route.provider
        model = kwargs.pop("model", None) or route.model

        response = await self._model_manager.chat(
            messages=messages,
            provider=provider,
            model=model,
            **kwargs,
        )

        return {
            "response": response.content,
            "model": response.model,
            "provider": response.provider,
            "usage": response.usage,
            "latency_ms": response.latency_ms,
        }

    async def run_agent(self, agent_type: str, goal: str, **kwargs: Any) -> dict[str, Any]:
        task_id = str(uuid4())
        approved_tools = kwargs.pop("approved_tools", None)
        budget = kwargs.pop("budget", None)
        task = TaskRecord(
            id=task_id,
            agent_type=agent_type,
            goal=goal,
            status="running",
            created_at=time.time(),
            approved_tools=approved_tools or [],
        )
        self._tasks[task_id] = task
        context = self._create_context(task_id, approved_tools, budget)
        await self._record_audit(
            "task_started",
            {"agent": agent_type, "approved_tools": sorted(context.approved_tools)},
            task_id,
        )

        try:
            route = await self._router.route(goal, self._model_manager.available_providers)
            requested_provider = kwargs.pop("provider", None)
            requested_model = kwargs.pop("model", None)
            provider = requested_provider or route.provider
            model = requested_model or (
                self._router.model_for_provider(provider) if requested_provider else route.model
            )
            if provider not in self._model_manager.available_providers:
                raise ValueError(f"Provider '{provider}' is not available")

            async with asyncio.timeout(context.budget.max_wall_seconds):
                plan = await self._planner.plan(
                    goal,
                    context={"provider": provider, "model": model},
                )

                agent_kwargs = {**kwargs}
                agent_kwargs.setdefault("model", model)
                agent_kwargs.setdefault("provider", provider)
                agent_kwargs.setdefault("max_iterations", context.budget.max_iterations)
                agent_kwargs.setdefault("max_tokens", context.budget.max_tokens)

                with self._tool_manager.execution_context(context):
                    result = await self._agent_manager.run_agent(
                        agent_type,
                        goal,
                        **agent_kwargs,
                    )

            task.status = "completed" if result.success else "failed"
            task.completed_at = time.time()
            task.error = result.error
            task.result = {
                "output": result.output,
                "iterations": result.iterations,
                "tokens_used": result.tokens_used,
                "latency_ms": result.latency_ms,
            }
            await self._record_audit(
                "task_completed" if result.success else "task_failed",
                {"iterations": result.iterations, "tokens_used": result.tokens_used},
                task_id,
            )

            return {
                "task_id": task_id,
                "plan_id": plan.id,
                "route": {"provider": provider, "model": model},
                "result": result,
            }
        except TimeoutError as exc:
            task.status = "failed"
            task.completed_at = time.time()
            task.error = f"Task exceeded {context.budget.max_wall_seconds}s wall-clock budget"
            await self._record_audit(
                "task_timed_out",
                {"max_wall_seconds": context.budget.max_wall_seconds},
                task_id,
            )
            raise RuntimeError(task.error) from exc
        except Exception as e:
            task.status = "failed"
            task.completed_at = time.time()
            task.error = str(e)
            await self._record_audit(
                "task_failed",
                {"error_type": type(e).__name__},
                task_id,
            )
            raise

    async def run_agent_stream(
        self,
        agent_type: str,
        goal: str,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        task_id = str(uuid4())
        approved_tools = kwargs.pop("approved_tools", None)
        budget = kwargs.pop("budget", None)
        task = TaskRecord(
            id=task_id,
            agent_type=agent_type,
            goal=goal,
            status="running",
            created_at=time.time(),
            approved_tools=approved_tools or [],
        )
        self._tasks[task_id] = task
        context = self._create_context(task_id, approved_tools, budget)
        await self._record_audit(
            "task_started",
            {"agent": agent_type, "approved_tools": sorted(context.approved_tools)},
            task_id,
        )

        yield server_sent_event(
            {
                "type": "task_start",
                "task_id": task_id,
                "agent": agent_type,
                "goal": goal,
            }
        )

        try:
            route = await self._router.route(goal, self._model_manager.available_providers)
            requested_provider = kwargs.pop("provider", None)
            requested_model = kwargs.pop("model", None)
            provider = requested_provider or route.provider
            model = requested_model or (
                self._router.model_for_provider(provider) if requested_provider else route.model
            )
            if provider not in self._model_manager.available_providers:
                raise ValueError(f"Provider '{provider}' is not available")

            async with asyncio.timeout(context.budget.max_wall_seconds):
                plan = await self._planner.plan(
                    goal,
                    context={"provider": provider, "model": model},
                )
                yield server_sent_event(
                    {
                        "type": "plan_created",
                        "plan_id": plan.id,
                        "steps": len(plan.steps),
                    }
                )
                yield server_sent_event(
                    {
                        "type": "route_selected",
                        "provider": provider,
                        "model": model,
                    }
                )

                kwargs.setdefault("model", model)
                kwargs.setdefault("provider", provider)
                kwargs.setdefault("max_iterations", context.budget.max_iterations)
                kwargs.setdefault("max_tokens", context.budget.max_tokens)
                with self._tool_manager.execution_context(context):
                    result = await self._agent_manager.run_agent(agent_type, goal, **kwargs)

            for tc in (result.output or {}).get("tool_calls", []):
                yield server_sent_event(
                    {
                        "type": "tool_call",
                        "tool": tc["tool"],
                        "success": tc["success"],
                    }
                )

            task.status = "completed" if result.success else "failed"
            task.completed_at = time.time()
            task.result = {"output": result.output}
            task.error = result.error
            await self._record_audit(
                "task_completed" if result.success else "task_failed",
                {"iterations": result.iterations, "tokens_used": result.tokens_used},
                task_id,
            )

            yield server_sent_event(
                {
                    "type": "task_complete",
                    "task_id": task_id,
                    "plan_id": plan.id,
                    "result": result.output,
                    "iterations": result.iterations,
                    "tokens_used": result.tokens_used,
                    "latency_ms": result.latency_ms,
                }
            )

        except TimeoutError:
            task.status = "failed"
            task.completed_at = time.time()
            task.error = f"Task exceeded {context.budget.max_wall_seconds}s wall-clock budget"
            await self._record_audit(
                "task_timed_out",
                {"max_wall_seconds": context.budget.max_wall_seconds},
                task_id,
            )
            yield server_sent_event({"type": "task_error", "task_id": task_id, "error": task.error})
        except Exception as e:
            task.status = "failed"
            task.completed_at = time.time()
            task.error = str(e)
            await self._record_audit(
                "task_failed",
                {"error_type": type(e).__name__},
                task_id,
            )
            yield server_sent_event({"type": "task_error", "task_id": task_id, "error": str(e)})

    def list_tasks(self) -> list[dict[str, Any]]:
        return [
            {
                "id": t.id,
                "agent_type": t.agent_type,
                "goal": t.goal[:100],
                "status": t.status,
                "created_at": t.created_at,
                "completed_at": t.completed_at,
                "error": t.error,
            }
            for t in self._tasks.values()
        ]

    def get_task(self, task_id: str) -> dict[str, Any] | None:
        t = self._tasks.get(task_id)
        if not t:
            return None
        return {
            "id": t.id,
            "agent_type": t.agent_type,
            "goal": t.goal,
            "status": t.status,
            "created_at": t.created_at,
            "completed_at": t.completed_at,
            "result": t.result,
            "error": t.error,
            "approved_tools": t.approved_tools or [],
        }

    async def cancel_task(self, task_id: str) -> bool:
        task = self._tasks.get(task_id)
        context = self._contexts.get(task_id)
        if not task or not context or task.status not in {"pending", "running"}:
            return False
        context.cancelled = True
        task.status = "cancelling"
        await self._record_audit("task_cancel_requested", {}, task_id)
        return True

    async def task_audit(self, task_id: str) -> list[dict[str, Any]]:
        if self._pg_audit and self._pg_audit_healthy:
            try:
                return await self._pg_audit.events_for_task(task_id)
            except Exception as exc:
                self._pg_audit_healthy = False
                logger.error("PostgreSQL audit read failed: %s", type(exc).__name__)
        return self._audit_ledger.events_for_task(task_id)

    async def health(self) -> dict[str, Any]:
        durable_valid: bool | None = None
        if self._pg_audit:
            if self._pg_audit_healthy:
                try:
                    durable_valid = await self._pg_audit.verify()
                except Exception as exc:
                    self._pg_audit_healthy = False
                    logger.error(
                        "PostgreSQL audit verification failed: %s",
                        type(exc).__name__,
                    )
                    durable_valid = False
            else:
                durable_valid = False
        memory_valid = self._audit_ledger.verify()
        return {
            "status": "ok",
            "version": "0.1.0",
            "name": "ZoraOS",
            "agents": self._agent_manager.list_agents(),
            "tools": self._tool_manager.list_tools(),
            "providers": self._model_manager.available_providers,
            "plans": len(self._planner.list_plans()),
            "tasks": len(self._tasks),
            "audit_chain_valid": memory_valid and durable_valid is not False,
            "audit_backend": "postgresql+memory" if self._pg_audit else "memory",
            "durable_audit_connected": self._pg_audit is not None and self._pg_audit_healthy,
        }
