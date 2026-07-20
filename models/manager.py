from __future__ import annotations

import time
from typing import Any, AsyncIterator, Dict, List, Optional

from configs.settings import settings

from .base import Message, ModelRequest, ModelResponse, ModelProvider
from .registry import ProviderRegistry


class ModelManager:
    def __init__(self):
        self._default_provider: Optional[str] = settings.default_provider
        self._default_model: Optional[str] = settings.default_model
        self._providers: Dict[str, ModelProvider] = {}

    def register_provider(self, name: str, provider: ModelProvider) -> None:
        self._providers[name] = provider

    def get_provider(self, name: Optional[str] = None) -> ModelProvider:
        provider_name = name or self._default_provider
        if not provider_name or provider_name not in self._providers:
            available = list(self._providers.keys())
            raise ValueError(
                f"Provider '{provider_name}' not available. "
                f"Available: {available}. "
                f"Set ZORAOS_DEFAULT_PROVIDER or register the provider."
            )
        provider = self._providers[provider_name]
        return provider

    async def chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        provider: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        tools: Optional[List[Dict[str, Any]]] = None,
        stream: bool = False,
    ) -> ModelResponse:
        p = self.get_provider(provider)

        msgs = []
        for m in messages:
            msg = Message(role=m["role"], content=m.get("content", ""))
            if "tool_call_id" in m:
                msg.tool_call_id = m["tool_call_id"]
            if "name" in m:
                msg.name = m["name"]
            if "tool_calls" in m:
                msg.tool_calls = m["tool_calls"]
            msgs.append(msg)

        request = ModelRequest(
            messages=msgs,
            system_prompt=system_prompt,
            model=model or self._default_model,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream,
            tools=tools,
        )

        start = time.monotonic()
        try:
            if stream:
                content_parts: list[str] = []
                async for chunk in p.chat_stream(request):
                    content_parts.append(chunk)
                response = ModelResponse(
                    content="".join(content_parts),
                    model=request.model or "unknown",
                    provider=p.name,
                    latency_ms=(time.monotonic() - start) * 1000,
                )
            else:
                response = await p.chat(request)
                response.latency_ms = (time.monotonic() - start) * 1000
            return response
        except Exception as e:
            raise RuntimeError(f"Provider '{p.name}' chat failed: {e}") from e

    async def embed(self, texts: List[str], provider: Optional[str] = None) -> List[List[float]]:
        p = self.get_provider(provider)
        return await p.embed(texts)

    def set_default_provider(self, name: str) -> None:
        if name not in self._providers:
            raise ValueError(f"Provider '{name}' not registered")
        self._default_provider = name

    def set_default_model(self, model: str) -> None:
        self._default_model = model

    @property
    def available_providers(self) -> list[str]:
        return list(self._providers.keys())


manager = ModelManager()
