"""Tests for the gateway service."""

import pytest

from gateway.service import GatewayService
from agents.manager import AgentManager
from agents.registry import AgentRegistry
from tools.registry import ToolRegistry
from tools.manager import ToolManager
from planner.engine import PlannerEngine
from router.engine import RouterEngine
from models.manager import ModelManager


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
