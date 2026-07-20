"""Tests for the planner engine."""

import pytest

from planner.engine import PlannerEngine, Plan, PlanStep


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
