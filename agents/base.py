from __future__ import annotations

import json
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4


@dataclass
class AgentConfig:
    name: str = ""
    description: str = ""
    model: str | None = None
    provider: str | None = None
    system_prompt: str | None = None
    tools: list[str] = field(default_factory=list)
    max_iterations: int = 10
    temperature: float = 0.7


@dataclass
class AgentResult:
    success: bool
    output: Any = None
    error: str | None = None
    agent_name: str = ""
    model_used: str | None = None
    iterations: int = 0
    tokens_used: int = 0
    latency_ms: float = 0.0
    task_id: str = field(default_factory=lambda: str(uuid4()))


class Agent(ABC):
    name: str = ""
    description: str = ""
    config: AgentConfig

    def __init__(self, config: AgentConfig | None = None):
        self.config = config or AgentConfig(name=self.name, description=self.description)
        self.conversation_history: list[dict[str, Any]] = []
        self.model_manager = None
        self.tool_manager = None

    @abstractmethod
    async def run(self, goal: str, **kwargs: Any) -> AgentResult: ...

    @abstractmethod
    async def run_with_tools(
        self, goal: str, tools: list[dict[str, Any]], **kwargs: Any
    ) -> AgentResult: ...

    def reset(self) -> None:
        self.conversation_history = []

    async def _call_llm(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        *,
        model: str | None = None,
        provider: str | None = None,
        max_tokens: int | None = None,
    ) -> Any:
        if not self.model_manager:
            raise RuntimeError("ModelManager not set on agent")
        return await self.model_manager.chat(
            messages=messages,
            system_prompt=None,
            model=model or self.config.model,
            provider=provider or self.config.provider,
            temperature=self.config.temperature,
            max_tokens=4096 if max_tokens is None else max_tokens,
            tools=tools,
        )

    async def _execute_tool_loop(self, goal: str, **kwargs: Any) -> AgentResult:
        start = time.monotonic()

        if not self.model_manager:
            return AgentResult(
                success=False, error="No model manager available", agent_name=self.name
            )

        self.conversation_history = []

        if self.config.system_prompt:
            self.conversation_history.append(
                {"role": "system", "content": self.config.system_prompt}
            )

        self.conversation_history.append({"role": "user", "content": goal})

        iterations = 0
        tokens_used = 0
        final_response = None
        termination_error = None
        all_tool_calls: list[dict[str, Any]] = []
        last_response = None
        max_iterations = int(kwargs.get("max_iterations", self.config.max_iterations))
        max_tokens = kwargs.get("max_tokens")
        model = kwargs.get("model")
        provider = kwargs.get("provider")

        while iterations < max_iterations:
            iterations += 1

            remaining_tokens = None
            if max_tokens is not None:
                remaining_tokens = max(64, int(max_tokens) - tokens_used)

            openai_tools = None
            if self.tool_manager and self.config.tools:
                openai_tools = self.tool_manager.get_tools_for_agent(self.config.tools)

            response = await self._call_llm(
                self.conversation_history,
                tools=openai_tools,
                model=model,
                provider=provider,
                max_tokens=remaining_tokens,
            )
            last_response = response

            if response.usage:
                tokens_used += response.usage.get("total_tokens", 0)

            if response.tool_calls:
                if max_tokens is not None and tokens_used >= int(max_tokens):
                    termination_error = "Agent reached token budget before another tool round"
                    break
                assistant_msg: dict[str, Any] = {
                    "role": "assistant",
                    "content": response.content or "",
                }
                assistant_msg["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": tc.type,
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    if hasattr(tc, "id")
                    else tc
                    for tc in response.tool_calls
                ]
                self.conversation_history.append(assistant_msg)

                for tc in response.tool_calls:
                    tc_id = tc.id if hasattr(tc, "id") else tc.get("id", "")
                    func = tc.function if hasattr(tc, "function") else tc.get("function", {})
                    tool_name = func.name if hasattr(func, "name") else func.get("name", "")
                    raw_args = (
                        func.arguments
                        if hasattr(func, "arguments")
                        else func.get("arguments", "{}")
                    )

                    try:
                        tool_args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                    except json.JSONDecodeError:
                        tool_args = {}

                    tool_result = await self.tool_manager.execute(tool_name, **tool_args)

                    tool_content = (
                        json.dumps(tool_result.output, default=str)
                        if tool_result.success
                        else (tool_result.error or "unknown error")
                    )
                    self.conversation_history.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc_id,
                            "name": tool_name,
                            "content": tool_content,
                        }
                    )

                    all_tool_calls.append(
                        {
                            "tool": tool_name,
                            "args": tool_args,
                            "success": tool_result.success,
                            "output": tool_result.output,
                        }
                    )
            else:
                final_response = response.content
                self.conversation_history.append({"role": "assistant", "content": response.content})
                break

        elapsed = (time.monotonic() - start) * 1000
        return AgentResult(
            success=final_response is not None,
            output={
                "response": final_response,
                "tool_calls": all_tool_calls,
                "iterations": iterations,
            },
            error=(
                None
                if final_response is not None
                else termination_error
                or "Agent reached max iterations without producing final response"
            ),
            agent_name=self.name,
            model_used=last_response.model if last_response else None,
            iterations=iterations,
            tokens_used=tokens_used,
            latency_ms=elapsed,
        )
