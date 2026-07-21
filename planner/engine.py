from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4


@dataclass
class PlanStep:
    id: str = field(default_factory=lambda: str(uuid4()))
    description: str = ""
    agent: str = ""
    input: str = ""
    depends_on: list[str] = field(default_factory=list)
    status: str = "pending"
    result: Any = None
    error: str | None = None


@dataclass
class Plan:
    id: str = field(default_factory=lambda: str(uuid4()))
    goal: str = ""
    steps: list[PlanStep] = field(default_factory=list)
    status: str = "pending"
    created_at: float = 0.0


PLANNER_SYSTEM_PROMPT = """You are a planning agent that decomposes complex goals
into sequential steps.

Available agents: research (literature review, paper analysis), developer (code),
writer (drafting), knowledge (memory organization).

For each step, output a JSON object with:
- description: what to do
- agent: which agent handles it
- input: the specific input/query for that agent
- depends_on: list of step descriptions this step depends on (empty for first step)

Output ONLY a JSON array, no other text.
"""


class PlannerEngine:
    def __init__(self):
        self._plans: dict[str, Plan] = {}
        self._model_manager = None
        self._agent_manager = None

    def configure(self, model_manager, agent_manager) -> None:
        self._model_manager = model_manager
        self._agent_manager = agent_manager

    async def plan(self, goal: str, context: dict[str, Any] | None = None) -> Plan:
        plan = Plan(goal=goal, created_at=time.time())

        if self._model_manager:
            try:
                messages = [
                    {"role": "system", "content": PLANNER_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": (
                            f"Goal: {goal}\n\nBreak this into steps using available "
                            "agents: research, developer, writer, knowledge."
                        ),
                    },
                ]
                response = await self._model_manager.chat(
                    messages=messages,
                    provider=(context or {}).get("provider"),
                    model=(context or {}).get("model"),
                    temperature=0.3,
                    max_tokens=2048,
                )
                steps_data = self._parse_steps(response.content, goal)
                plan.steps = [PlanStep(**s) for s in steps_data]
                plan.status = "created"
            except Exception:
                plan.steps = [
                    PlanStep(
                        description=f"Complete goal: {goal}",
                        agent="research",
                        input=goal,
                    )
                ]
                plan.status = "created"
        else:
            plan.steps = [
                PlanStep(
                    description=f"Complete goal: {goal}",
                    agent="research",
                    input=goal,
                )
            ]
            plan.status = "pending"

        self._plans[plan.id] = plan
        return plan

    async def execute_step(self, plan_id: str, step_id: str) -> Any:
        plan = self._plans.get(plan_id)
        if not plan:
            raise ValueError(f"Plan not found: {plan_id}")
        step = next((s for s in plan.steps if s.id == step_id), None)
        if not step:
            raise ValueError(f"Step not found: {step_id}")

        if not self._agent_manager:
            step.status = "failed"
            step.error = "No agent manager configured"
            return None

        try:
            step.status = "running"
            result = await self._agent_manager.run_agent(
                agent_name=step.agent,
                goal=step.input,
            )
            step.status = "completed" if result.success else "failed"
            step.result = result.output
            if not result.success:
                step.error = result.error
            return result.output
        except Exception as e:
            step.status = "failed"
            step.error = str(e)
            return None

    async def execute_plan(self, plan_id: str) -> dict[str, Any]:
        plan = self._plans.get(plan_id)
        if not plan:
            raise ValueError(f"Plan not found: {plan_id}")

        plan.status = "running"
        completed: dict[str, Any] = {}

        while True:
            pending = [s for s in plan.steps if s.status == "pending"]
            if not pending:
                break

            for step in pending:
                deps = [completed.get(d) for d in step.depends_on if d in completed]
                if all(d is not None for d in deps) or not step.depends_on:
                    result = await self.execute_step(plan_id, step.id)
                    completed[step.description] = result

        plan.status = "completed"
        return {
            "plan_id": plan.id,
            "steps": [
                {"description": step.description, "status": step.status} for step in plan.steps
            ],
        }

    def _parse_steps(self, content: str, goal: str) -> list[dict[str, Any]]:
        try:
            cleaned = content.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
                cleaned = cleaned.rsplit("\n```", 1)[0]
            steps = json.loads(cleaned)
            return steps if isinstance(steps, list) else []
        except (json.JSONDecodeError, TypeError):
            return [
                {
                    "description": f"Goal: {goal}",
                    "agent": "research",
                    "input": goal,
                    "depends_on": [],
                }
            ]

    def get_plan(self, plan_id: str) -> Plan | None:
        return self._plans.get(plan_id)

    def list_plans(self) -> list[Plan]:
        return list(self._plans.values())
