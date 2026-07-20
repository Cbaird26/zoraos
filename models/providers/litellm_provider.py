from __future__ import annotations

from typing import Any, AsyncIterator, Dict, List, Optional

import litellm
from litellm import acompletion, aembedding

from configs.settings import ProviderConfig

from ..base import (
    Message,
    ModelProvider,
    ModelRequest,
    ModelResponse,
    ProviderCapabilities,
)


class LiteLLMProvider(ModelProvider):
    name = "litellm"

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.api_key = config.get("api_key")
        self.api_base = config.get("api_base")
        self.default_model = config.get("model", "gpt-4o")
        self.max_tokens = config.get("max_tokens", 4096)
        self.temperature = config.get("temperature", 0.7)
        self._provider_prefix = config.get("provider_name", "")
        self.capabilities = ProviderCapabilities(
            streaming=True,
            tool_calling=True,
            vision=True,
            function_calling=True,
            max_context_length=128000,
            max_output_tokens=self.max_tokens,
        )

    @classmethod
    def from_config(cls, config: Dict[str, Any]) -> LiteLLMProvider:
        return cls(config)

    def _map_messages(self, request: ModelRequest) -> List[Dict[str, Any]]:
        msgs: List[Dict[str, Any]] = []
        if request.system_prompt:
            msgs.append({"role": "system", "content": request.system_prompt})
        for msg in request.messages:
            role = msg.role.value if hasattr(msg.role, 'value') else msg.role
            entry: Dict[str, Any] = {"role": role, "content": msg.content}
            if msg.tool_calls:
                entry["tool_calls"] = msg.tool_calls
            if msg.tool_call_id:
                entry["tool_call_id"] = msg.tool_call_id
            msgs.append(entry)
        return msgs

    def _get_model_name(self, request: ModelRequest) -> str:
        model = request.model or self.default_model
        if model and "/" not in model and self._provider_prefix:
            model = f"{self._provider_prefix}/{model}"
        return model

    async def chat(self, request: ModelRequest) -> ModelResponse:
        model = self._get_model_name(request)
        messages = self._map_messages(request)

        kwargs: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": request.temperature or self.temperature,
            "max_tokens": request.max_tokens or self.max_tokens,
        }

        if self.api_key:
            kwargs["api_key"] = self.api_key
        if self.api_base:
            kwargs["api_base"] = self.api_base
        if request.tools:
            kwargs["tools"] = request.tools
        if request.tool_choice:
            kwargs["tool_choice"] = request.tool_choice
        if request.stop:
            kwargs["stop"] = request.stop

        response = await acompletion(**kwargs)

        choice = response.choices[0]
        return ModelResponse(
            content=choice.message.content or "",
            model=response.model,
            provider=self.name,
            finish_reason=choice.finish_reason,
            usage=response.usage.model_dump() if response.usage else None,
            tool_calls=choice.message.tool_calls,
        )

    async def chat_stream(self, request: ModelRequest) -> AsyncIterator[str]:
        model = self._get_model_name(request)
        messages = self._map_messages(request)

        kwargs: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": request.temperature or self.temperature,
            "max_tokens": request.max_tokens or self.max_tokens,
            "stream": True,
        }

        if self.api_key:
            kwargs["api_key"] = self.api_key
        if self.api_base:
            kwargs["api_base"] = self.api_base
        if request.tools:
            kwargs["tools"] = request.tools

        async for chunk in await acompletion(**kwargs):
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if delta.content:
                    yield delta.content

    async def embed(self, texts: List[str]) -> List[List[float]]:
        model = "text-embedding-3-small"
        response = await aembedding(model=model, input=texts, api_key=self.api_key)
        return [item["embedding"] for item in response.data]
