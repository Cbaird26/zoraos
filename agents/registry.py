from __future__ import annotations

from typing import Dict, Optional, Type

from .base import Agent


class AgentRegistry:
    _agents: Dict[str, Type[Agent]] = {}

    @classmethod
    def register(cls, name: str, agent_cls: Type[Agent]) -> None:
        cls._agents[name] = agent_cls

    @classmethod
    def get(cls, name: str) -> Type[Agent]:
        if name not in cls._agents:
            raise ValueError(f"Agent '{name}' not found. Available: {list(cls._agents.keys())}")
        return cls._agents[name]

    @classmethod
    def list_agents(cls) -> list[str]:
        return list(cls._agents.keys())
