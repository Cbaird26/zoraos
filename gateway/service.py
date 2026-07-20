from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator, Dict, List, Optional
from uuid import uuid4

from agents.manager import AgentManager
from governance.audit import AuditLedger
from governance.context import ExecutionBudget, ExecutionContext
from models.manager import ModelManager
from planner.engine import PlannerEngine
from router.engine import RouterEngine
from tools.manager import ToolManager


@dataclass
class TaskRecord:
    id: str
    agent_type: str
    goal: str
    status: str = "pending"
    created_at: float = 0.0
    completed_at: Optional[float] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    approved_tools: List[str] = field(default_factory=list)


class GatewayService:
    def __init__(
        self,
        model_manager: ModelManager,
        agent_manager: AgentManager,
        tool_manager: ToolManager,
        planner: PlannerEngine,
        router: RouterEngine,
        audit_ledger: AuditLedger | None = None,
    ):
        self._model_manager = model_manager
        self._agent_manager = agent_manager
        self._tool_manager = tool_manager
        self._planner = planner
        self._router = router
        self._audit_ledger = audit_ledger or AuditLedger()
        self._tasks: Dict[str, TaskRecord] = {}
        self._contexts: Dict[str, ExecutionContext] = {}

    def _create_context(
        self,
        task_id: str,
        approved_tools: List[str] | None,
        budget: Dict[str, Any] | None,
    ) -> ExecutionContext:
        config = budget or {}
        context = ExecutionContext(
            task_id=task_id,
            approved_tools=frozenset(approved_tools or []),
            budget=ExecutionBudget(
                max_tool_calls=int(config.get("max_tool_calls", 20)),
                max_iterations=int(config.get("max_iterations", 10)),
                max_tokens=config.get("max_tokens"),
            ),
        )
        self._contexts[task_id] = context
        return context

    async def chat(self, messages: List[Dict[str, str]], agent: Optional[str] = None, **kwargs: Any) -> Dict[str, Any]:
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

    async def run_agent(self, agent_type: str, goal: str, **kwargs: Any) -> Dict[str, Any]:
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
        self._audit_ledger.record(
            "task_started",
            {"agent": agent_type, "approved_tools": sorted(context.approved_tools)},
            task_id,
        )

        try:
            plan = await self._planner.plan(goal)
            route = await self._router.route(goal, self._model_manager.available_providers)

            agent_kwargs = {**kwargs}
            agent_kwargs.setdefault("model", route.model)
            agent_kwargs.setdefault("provider", route.provider)
            agent_kwargs.setdefault("max_iterations", context.budget.max_iterations)
            agent_kwargs.setdefault("max_tokens", context.budget.max_tokens)

            with self._tool_manager.execution_context(context):
                result = await self._agent_manager.run_agent(agent_type, goal, **agent_kwargs)

            task.status = "completed" if result.success else "failed"
            task.completed_at = time.time()
            task.error = result.error
            task.result = {
                "output": result.output,
                "iterations": result.iterations,
                "tokens_used": result.tokens_used,
                "latency_ms": result.latency_ms,
            }
            self._audit_ledger.record(
                "task_completed" if result.success else "task_failed",
                {"iterations": result.iterations, "tokens_used": result.tokens_used},
                task_id,
            )

            return {
                "task_id": task_id,
                "plan_id": plan.id,
                "route": {"provider": route.provider, "model": route.model},
                "result": result,
            }
        except Exception as e:
            task.status = "failed"
            task.completed_at = time.time()
            task.error = str(e)
            self._audit_ledger.record("task_failed", {"error_type": type(e).__name__}, task_id)
            raise

    async def run_agent_stream(self, agent_type: str, goal: str, **kwargs: Any) -> AsyncGenerator[str, None]:
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
        self._audit_ledger.record(
            "task_started",
            {"agent": agent_type, "approved_tools": sorted(context.approved_tools)},
            task_id,
        )

        yield f"data: {json.dumps({'type': 'task_start', 'task_id': task_id, 'agent': agent_type, 'goal': goal})}\n\n"

        try:
            plan = await self._planner.plan(goal)
            yield f"data: {json.dumps({'type': 'plan_created', 'plan_id': plan.id, 'steps': len(plan.steps)})}\n\n"

            route = await self._router.route(goal, self._model_manager.available_providers)
            yield f"data: {json.dumps({'type': 'route_selected', 'provider': route.provider, 'model': route.model})}\n\n"

            kwargs.setdefault("model", route.model)
            kwargs.setdefault("provider", route.provider)
            kwargs.setdefault("max_iterations", context.budget.max_iterations)
            kwargs.setdefault("max_tokens", context.budget.max_tokens)
            with self._tool_manager.execution_context(context):
                result = await self._agent_manager.run_agent(agent_type, goal, **kwargs)

            for tc in (result.output or {}).get("tool_calls", []):
                yield f"data: {json.dumps({'type': 'tool_call', 'tool': tc['tool'], 'success': tc['success']})}\n\n"

            task.status = "completed" if result.success else "failed"
            task.completed_at = time.time()
            task.result = {"output": result.output}
            task.error = result.error
            self._audit_ledger.record(
                "task_completed" if result.success else "task_failed",
                {"iterations": result.iterations, "tokens_used": result.tokens_used},
                task_id,
            )

            yield f"data: {json.dumps({'type': 'task_complete', 'task_id': task_id, 'plan_id': plan.id, 'result': result.output, 'iterations': result.iterations, 'tokens_used': result.tokens_used, 'latency_ms': result.latency_ms})}\n\n"

        except Exception as e:
            task.status = "failed"
            task.completed_at = time.time()
            task.error = str(e)
            self._audit_ledger.record("task_failed", {"error_type": type(e).__name__}, task_id)
            yield f"data: {json.dumps({'type': 'task_error', 'task_id': task_id, 'error': str(e)})}\n\n"

    def list_tasks(self) -> List[Dict[str, Any]]:
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

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
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

    def cancel_task(self, task_id: str) -> bool:
        task = self._tasks.get(task_id)
        context = self._contexts.get(task_id)
        if not task or not context or task.status not in {"pending", "running"}:
            return False
        context.cancelled = True
        task.status = "cancelling"
        self._audit_ledger.record("task_cancel_requested", {}, task_id)
        return True

    def task_audit(self, task_id: str) -> list[Dict[str, Any]]:
        return self._audit_ledger.events_for_task(task_id)

    async def health(self) -> Dict[str, Any]:
        return {
            "status": "ok",
            "version": "0.1.0",
            "name": "ZoraOS",
            "agents": self._agent_manager.list_agents(),
            "tools": self._tool_manager.list_tools(),
            "providers": self._model_manager.available_providers,
            "plans": len(self._planner.list_plans()),
            "tasks": len(self._tasks),
            "audit_chain_valid": self._audit_ledger.verify(),
        }
