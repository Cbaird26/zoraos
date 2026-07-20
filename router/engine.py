from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from configs.settings import settings


@dataclass
class RouteDecision:
    provider: str
    model: str
    tools: List[str]
    estimated_cost: float = 0.0
    reasoning: str = ""


class RouterEngine:
    _task_provider_map: Dict[str, str] = {
        "research": "deepseek",
        "coding": "kimi",
        "write": "anthropic",
        "code": "kimi",
        "draft": "anthropic",
        "reasoning": "openai",
        "local": "ollama",
    }

    def _model_for_provider(self, provider: str) -> str:
        if provider == "ollama":
            return settings.default_model
        return {
            "deepseek": "deepseek-chat",
            "kimi": "kimi-k2",
            "anthropic": "claude-sonnet-4-20250514",
            "openai": "gpt-4o",
            "openrouter": settings.providers.openrouter.model,
        }.get(provider, settings.default_model)

    async def route(self, goal: str, available_providers: List[str], **kwargs: Any) -> RouteDecision:
        goal_lower = goal.lower()
        provider = settings.default_provider
        if available_providers and provider not in available_providers:
            provider = available_providers[0]

        for task_type, prov in self._task_provider_map.items():
            if task_type in goal_lower.split() and prov in available_providers:
                provider = prov
                break

        model = self._model_for_provider(provider)

        return RouteDecision(
            provider=provider,
            model=model,
            tools=["web_search", "memory_read", "memory_search"],
            reasoning=f"Routed to {provider}/{model} based on task type detection",
        )

    def update_task_map(self, task_type: str, provider: str) -> None:
        self._task_provider_map[task_type] = provider
