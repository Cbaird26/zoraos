from __future__ import annotations

from typing import Any, Dict, List, Optional, Type

from models.manager import ModelManager
from tools.manager import ToolManager
from tools.registry import ToolRegistry

from .base import Agent, AgentConfig, AgentResult
from .registry import AgentRegistry


class AgentManager:
    def __init__(self, model_manager: ModelManager, tool_registry: ToolRegistry):
        self._model_manager = model_manager
        self._tool_registry = tool_registry
        self._tool_manager = ToolManager(tool_registry)
        self._instances: Dict[str, Agent] = {}

    def create_agent(self, agent_type: str, config: Optional[AgentConfig] = None) -> Agent:
        agent_cls = AgentRegistry.get(agent_type)
        agent = agent_cls(config)
        agent.model_manager = self._model_manager
        agent.tool_manager = self._tool_manager
        self._instances[agent.name] = agent
        return agent

    def get_agent(self, name: str) -> Optional[Agent]:
        return self._instances.get(name)

    async def run_agent(self, agent_name: str, goal: str, **kwargs: Any) -> AgentResult:
        agent = self.get_agent(agent_name)
        if not agent:
            agent = self.create_agent(agent_name)
        model = kwargs.get("model")
        provider = kwargs.get("provider")
        if model and not agent.config.model:
            agent.config.model = model
        if provider and not agent.config.provider:
            agent.config.provider = provider
        return await agent.run_with_tools(goal, agent.config.tools, **kwargs)

    def list_agents(self) -> list[dict]:
        agents = []
        for name, agent_cls in AgentRegistry._agents.items():
            agents.append({"name": name, "description": agent_cls.description if hasattr(agent_cls, "description") else ""})
        for name, instance in self._instances.items():
            for a in agents:
                if a["name"] == name:
                    a["active"] = True
                    break
            else:
                agents.append({"name": name, "active": True})
        return agents
