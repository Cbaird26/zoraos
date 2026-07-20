"""Tests for the agent framework."""

import pytest

from agents.base import AgentConfig, AgentResult
from agents.implementations.research import ResearchAgent
from agents.implementations.developer import DeveloperAgent
from agents.implementations.writer import WriterAgent
from agents.implementations.knowledge import KnowledgeAgent


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
