"""Tests for the agent framework."""

import pytest

from agents.base import AgentConfig, AgentResult
from agents.implementations.developer import DeveloperAgent
from agents.implementations.knowledge import KnowledgeAgent
from agents.implementations.research import ResearchAgent
from agents.implementations.writer import WriterAgent
from agents.registry import AgentRegistry
from api.dependencies import get_agent_manager
from models.base import ModelResponse


class CapturingModelManager:
    def __init__(self):
        self.request = None

    async def chat(self, **kwargs):
        self.request = kwargs
        return ModelResponse(
            content="done",
            model=kwargs.get("model") or "default-model",
            provider=kwargs.get("provider") or "default-provider",
            usage={"total_tokens": 3},
        )


class HighUsageFinalModelManager:
    async def chat(self, **kwargs):
        return ModelResponse(
            content="A complete bounded response.",
            model="local-model",
            provider="ollama",
            usage={"total_tokens": 900},
        )


class TestResearchAgent:
    @pytest.mark.asyncio
    async def test_run_without_model(self):
        agent = ResearchAgent()
        result = await agent.run("Summarize quantum gravity papers")
        assert result.success is False
        assert result.error == "No model manager available"
        assert result.agent_name == "research"

    def test_system_prompt(self):
        agent = ResearchAgent()
        assert "Research Zora" in (agent.config.system_prompt or "")

    @pytest.mark.asyncio
    async def test_run_uses_task_route_without_mutating_config(self):
        manager = CapturingModelManager()
        agent = ResearchAgent()
        agent.model_manager = manager

        result = await agent.run(
            "Summarize the handoff",
            provider="openrouter",
            model="example/model",
            max_tokens=123,
        )

        assert result.success
        assert manager.request["provider"] == "openrouter"
        assert manager.request["model"] == "example/model"
        assert manager.request["max_tokens"] == 123
        assert agent.config.provider is None
        assert agent.config.model is None

    @pytest.mark.asyncio
    async def test_final_response_is_kept_when_usage_reaches_budget(self):
        agent = ResearchAgent()
        agent.model_manager = HighUsageFinalModelManager()

        result = await agent.run("Answer locally", max_tokens=256)

        assert result.success
        assert result.output["response"] == "A complete bounded response."
        assert result.tokens_used == 900


class TestDeveloperAgent:
    @pytest.mark.asyncio
    async def test_run_without_model(self):
        agent = DeveloperAgent()
        result = await agent.run("Refactor the codebase")
        assert result.success is False
        assert result.error == "No model manager available"
        assert result.agent_name == "developer"


class TestWriterAgent:
    @pytest.mark.asyncio
    async def test_run_without_model(self):
        agent = WriterAgent()
        result = await agent.run("Draft a paper")
        assert result.success is False
        assert result.error == "No model manager available"
        assert result.agent_name == "writer"


class TestKnowledgeAgent:
    @pytest.mark.asyncio
    async def test_run_without_model(self):
        agent = KnowledgeAgent()
        result = await agent.run("Organize research notes")
        assert result.success is False
        assert result.error == "No model manager available"
        assert result.agent_name == "knowledge"


class TestAgentConfig:
    def test_default_config(self):
        config = AgentConfig(name="test", description="Test agent")
        assert config.name == "test"
        assert config.max_iterations == 10
        assert config.temperature == 0.7
        assert config.tools == []


class TestAgentResult:
    def test_success_result(self):
        result = AgentResult(success=True, output="done", agent_name="test")
        assert result.success is True
        assert result.agent_name == "test"
        assert result.task_id is not None


def test_dependency_factory_registers_builtin_agents(monkeypatch):
    monkeypatch.setattr(AgentRegistry, "_agents", {})

    manager = get_agent_manager()
    names = {agent["name"] for agent in manager.list_agents()}

    assert names == {"research", "developer", "writer", "knowledge", "gaming"}
