from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass
from typing import Any, AsyncGenerator, Dict, List, Optional
from uuid import uuid4

from agents.manager import AgentManager
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


class GatewayService:
    def __init__(
        self,
        model_manager: ModelManager,
        agent_manager: AgentManager,
        tool_manager: ToolManager,
        planner: PlannerEngine,
        router: RouterEngine,
    ):
        self._model_manager = model_manager
        self._agent_manager = agent_manager
        self._tool_manager = tool_manager
        self._planner = planner
        self._router = router
        self._tasks: Dict[str, TaskRecord] = {}

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
        task = TaskRecord(id=task_id, agent_type=agent_type, goal=goal, status="running", created_at=time.time())
        self._tasks[task_id] = task

        try:
            plan = await self._planner.plan(goal)
            route = await self._router.route(goal, self._model_manager.available_providers)

            agent_kwargs = {**kwargs}
            agent_kwargs.setdefault("model", route.model)
            agent_kwargs.setdefault("provider", route.provider)

            result = await self._agent_manager.run_agent(agent_type, goal, **agent_kwargs)

            task.status = "completed"
            task.completed_at = time.time()
            task.result = {"output": result.output, "iterations": result.iterations, "tokens_used": result.tokens_used, "latency_ms": result.latency_ms}

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
            raise

    async def run_agent_stream(self, agent_type: str, goal: str, **kwargs: Any) -> AsyncGenerator[str, None]:
        task_id = str(uuid4())
        task = TaskRecord(id=task_id, agent_type=agent_type, goal=goal, status="running", created_at=time.time())
        self._tasks[task_id] = task

        yield f"data: {json.dumps({'type': 'task_start', 'task_id': task_id, 'agent': agent_type, 'goal': goal})}\n\n"

        try:
            plan = await self._planner.plan(goal)
            yield f"data: {json.dumps({'type': 'plan_created', 'plan_id': plan.id, 'steps': len(plan.steps)})}\n\n"

            route = await self._router.route(goal, self._model_manager.available_providers)
            yield f"data: {json.dumps({'type': 'route_selected', 'provider': route.provider, 'model': route.model})}\n\n"

            result = await self._agent_manager.run_agent(agent_type, goal, **kwargs)

            for tc in (result.output or {}).get("tool_calls", []):
                yield f"data: {json.dumps({'type': 'tool_call', 'tool': tc['tool'], 'success': tc['success']})}\n\n"

            task.status = "completed"
            task.completed_at = time.time()
            task.result = {"output": result.output}

            yield f"data: {json.dumps({'type': 'task_complete', 'task_id': task_id, 'plan_id': plan.id, 'result': result.output, 'iterations': result.iterations, 'tokens_used': result.tokens_used, 'latency_ms': result.latency_ms})}\n\n"

        except Exception as e:
            task.status = "failed"
            task.completed_at = time.time()
            task.error = str(e)
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
        }

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
        }
