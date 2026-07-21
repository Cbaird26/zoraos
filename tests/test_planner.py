"""Tests for the planner engine."""

import pytest

from models.base import ModelResponse
from planner.engine import Plan, PlannerEngine


class CapturingPlannerModelManager:
    def __init__(self):
        self.request = None

    async def chat(self, **kwargs):
        self.request = kwargs
        return ModelResponse(
            content="[]",
            model=kwargs.get("model") or "default",
            provider=kwargs.get("provider") or "default",
        )


class TestPlannerEngine:
    @pytest.mark.asyncio
    async def test_create_plan(self):
        planner = PlannerEngine()
        plan = await planner.plan("Research quantum gravity")
        assert plan.goal == "Research quantum gravity"
        assert plan.status == "pending"
        assert plan.id is not None

    def test_get_plan(self):
        planner = PlannerEngine()
        plan = Plan(goal="test")
        planner._plans[plan.id] = plan
        assert planner.get_plan(plan.id) == plan
        assert planner.get_plan("nonexistent") is None

    def test_list_plans(self):
        planner = PlannerEngine()
        assert isinstance(planner.list_plans(), list)

    @pytest.mark.asyncio
    async def test_plan_uses_explicit_local_route(self):
        manager = CapturingPlannerModelManager()
        planner = PlannerEngine()
        planner.configure(manager, None)

        await planner.plan(
            "Review a local corpus",
            context={"provider": "ollama", "model": "zora:core"},
        )

        assert manager.request["provider"] == "ollama"
        assert manager.request["model"] == "zora:core"
