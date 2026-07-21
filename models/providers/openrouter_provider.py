from __future__ import annotations

from typing import Any, AsyncIterator, Dict, List, Optional

import httpx

from ..base import (
    Message,
    ModelProvider,
    ModelRequest,
    ModelResponse,
    ProviderCapabilities,
)


class OpenRouterProvider(ModelProvider):
    name = "openrouter"

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.api_key = config.get("api_key")
        self.api_base = config.get("api_base", "https://openrouter.ai/api/v1")
        self.default_model = config.get("model", "tencent/hy3")
        self.capabilities = ProviderCapabilities(
            streaming=True,
            tool_calling=True,
            vision=True,
            function_calling=True,
            max_context_length=256000,
            max_output_tokens=4096,
        )

    @classmethod
    def from_config(cls, config: Dict[str, Any]) -> OpenRouterProvider:
        return cls(config)

    async def chat(self, request: ModelRequest) -> ModelResponse:
        model = request.model or self.default_model
        model = model.replace("openrouter/", "")

        messages = []
        if request.system_prompt:
            messages.append({"role": "system", "content": request.system_prompt})
        for msg in request.messages:
            entry: Dict[str, Any] = {"role": msg.role.value if hasattr(msg.role, "value") else msg.role, "content": msg.content}
            if msg.tool_calls:
                entry["tool_calls"] = [
                    {"id": tc.id, "type": tc.type, "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                    if hasattr(tc, "id") else tc
                    for tc in msg.tool_calls
                ]
            if msg.tool_call_id:
                entry["tool_call_id"] = msg.tool_call_id
            if msg.name:
                entry["name"] = msg.name
            messages.append(entry)

        body: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": request.temperature or 0.7,
            "max_tokens": request.max_tokens or 4096,
            "stream": False,
        }
        if model == "tencent/hy3":
            body["reasoning"] = {"effort": "low", "exclude": True}
        if request.tools:
            body["tools"] = request.tools
        if request.tool_choice:
            body["tool_choice"] = request.tool_choice

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "ZoraOS",
        }

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(f"{self.api_base}/chat/completions", json=body, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        choice = data["choices"][0]
        msg = choice.get("message", {})
        content = msg.get("content") or ""
        tool_calls = msg.get("tool_calls")

        return ModelResponse(
            content=content,
            model=data.get("model", model),
            provider=self.name,
            finish_reason=choice.get("finish_reason"),
            usage=data.get("usage"),
            tool_calls=tool_calls,
        )

    async def chat_stream(self, request: ModelRequest) -> AsyncIterator[str]:
        model = request.model or self.default_model
        model = model.replace("openrouter/", "")

        messages = []
        if request.system_prompt:
            messages.append({"role": "system", "content": request.system_prompt})
        for msg in request.messages:
            messages.append({"role": msg.role.value if hasattr(msg.role, "value") else msg.role, "content": msg.content})

        body: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": request.temperature or 0.7,
            "max_tokens": request.max_tokens or 4096,
            "stream": True,
        }
        if model == "tencent/hy3":
            body["reasoning"] = {"effort": "low", "exclude": True}
        if request.tools:
            body["tools"] = request.tools

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "ZoraOS",
        }

        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream("POST", f"{self.api_base}/chat/completions", json=body, headers=headers) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        chunk = line[6:]
                        if chunk == "[DONE]":
                            break
                        try:
                            import json
                            data = json.loads(chunk)
                            delta = data["choices"][0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue

    async def embed(self, texts: List[str]) -> List[List[float]]:
        return [[0.0] * 768 for _ in texts]
