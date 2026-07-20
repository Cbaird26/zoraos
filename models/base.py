from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncIterator, Dict, List, Optional


class MessageRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


@dataclass
class Message:
    role: MessageRole
    content: str
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_call_id: Optional[str] = None
    name: Optional[str] = None


@dataclass
class ModelRequest:
    messages: List[Message]
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 4096
    stream: bool = False
    tools: Optional[List[Dict[str, Any]]] = None
    tool_choice: Optional[str] = None
    stop: Optional[List[str]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ModelResponse:
    content: str
    model: str
    provider: str
    finish_reason: Optional[str] = None
    usage: Optional[Dict[str, Any]] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None
    latency_ms: Optional[float] = None


@dataclass
class ProviderCapabilities:
    streaming: bool = False
    tool_calling: bool = False
    vision: bool = False
    function_calling: bool = False
    max_context_length: int = 4096
    max_output_tokens: int = 4096
    supports_system_prompt: bool = True


class ModelProvider(ABC):
    name: str = ""
    capabilities: ProviderCapabilities = ProviderCapabilities()

    def __init__(self, config: Dict[str, Any]):
        self.config = config

    @abstractmethod
    async def chat(self, request: ModelRequest) -> ModelResponse:
        ...

    @abstractmethod
    async def chat_stream(self, request: ModelRequest) -> AsyncIterator[str]:
        ...

    @abstractmethod
    async def embed(self, texts: List[str]) -> List[List[float]]:
        ...

    @classmethod
    @abstractmethod
    def from_config(cls, config: Dict[str, Any]) -> ModelProvider:
        ...

    def get_context_window(self) -> int:
        return self.capabilities.max_context_length
