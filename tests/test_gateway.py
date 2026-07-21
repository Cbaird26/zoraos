"""Tests for the gateway service."""

import pytest

from agents.base import AgentResult
from agents.manager import AgentManager
from gateway.service import GatewayService
from models.manager import ModelManager
from planner.engine import Plan, PlannerEngine
from router.engine import RouterEngine
from tools.manager import ToolManager
from tools.registry import ToolRegistry


class TestGatewayService:
    @pytest.mark.asyncio
    async def test_health(self):
        model_manager = ModelManager()
        tool_registry = ToolRegistry()
        agent_manager = AgentManager(model_manager, tool_registry)
        planner = PlannerEngine()
        router = RouterEngine()

        tool_manager = ToolManager(tool_registry)
        gateway = GatewayService(model_manager, agent_manager, tool_manager, planner, router)
        health = await gateway.health()
        assert health["status"] == "ok"
        assert health["version"] == "0.1.0"
        assert health["name"] == "ZoraOS"
        assert health["audit_backend"] == "memory"
        assert health["durable_audit_connected"] is False

    @pytest.mark.asyncio
    async def test_postgres_audit_is_mirrored_without_replacing_memory_ledger(self):
        model_manager = ModelManager()
        tool_registry = ToolRegistry()
        tool_manager = ToolManager(tool_registry)
        gateway = GatewayService(
            model_manager,
            AgentManager(model_manager, tool_registry),
            tool_manager,
            PlannerEngine(),
            RouterEngine(),
        )

        class FakePgAudit:
            def __init__(self):
                self.events = []

            async def record(self, event_type, payload, task_id=None):
                self.events.append((event_type, payload, task_id))

            async def verify(self):
                return True

        durable = FakePgAudit()
        gateway._pg_audit = durable
        gateway._pg_audit_healthy = True

        await gateway._record_audit("test_event", {"safe": True}, "task-1")

        assert durable.events == [("test_event", {"safe": True}, "task-1")]
        assert gateway._audit_ledger.verify()
        assert len(gateway._audit_ledger.events_for_task("task-1")) == 1
        health = await gateway.health()
        assert health["audit_chain_valid"] is True
        assert health["audit_backend"] == "postgresql+memory"

    def test_execution_budget_is_clamped(self):
        model_manager = ModelManager()
        tool_registry = ToolRegistry()
        gateway = GatewayService(
            model_manager,
            AgentManager(model_manager, tool_registry),
            ToolManager(tool_registry),
            PlannerEngine(),
            RouterEngine(),
        )

        context = gateway._create_context(
            "task-1",
            [],
            {
                "max_tool_calls": 999,
                "max_iterations": 999,
                "max_tokens": 999_999,
                "max_wall_seconds": 999_999,
            },
        )

        assert context.budget.max_tool_calls == 50
        assert context.budget.max_iterations == 20
        assert context.budget.max_tokens == 100_000
        assert context.budget.max_wall_seconds == 3600

    @pytest.mark.asyncio
    async def test_explicit_provider_uses_matching_default_model(self):
        class LocalModels:
            available_providers = ["ollama"]

        class CapturingPlanner:
            def __init__(self):
                self.context = None
                self.plans = []

            async def plan(self, goal, context=None):
                self.context = context
                plan = Plan(goal=goal)
                self.plans.append(plan)
                return plan

            def list_plans(self):
                return self.plans

        class CapturingAgents:
            def __init__(self):
                self.kwargs = None

            async def run_agent(self, agent_type, goal, **kwargs):
                self.kwargs = kwargs
                return AgentResult(success=True, agent_name=agent_type, output={})

            def list_agents(self):
                return []

        registry = ToolRegistry()
        planner = CapturingPlanner()
        agents = CapturingAgents()
        gateway = GatewayService(
            LocalModels(),
            agents,
            ToolManager(registry),
            planner,
            RouterEngine(),
        )

        result = await gateway.run_agent(
            "research",
            "Review this corpus",
            provider="ollama",
            budget={"max_iterations": 1, "max_tokens": 512},
        )

        assert result["route"] == {"provider": "ollama", "model": "zora:core"}
        assert planner.context == {"provider": "ollama", "model": "zora:core"}
        assert agents.kwargs["provider"] == "ollama"
        assert agents.kwargs["model"] == "zora:core"
