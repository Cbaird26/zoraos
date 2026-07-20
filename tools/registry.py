from __future__ import annotations

from typing import Any, Dict, Optional, Type

from .base import Tool


class ToolRegistry:
    _tools: Dict[str, Tool] = {}

    @classmethod
    def register(cls, tool: Tool) -> None:
        cls._tools[tool.name] = tool

    @classmethod
    def get(cls, name: str) -> Optional[Tool]:
        return cls._tools.get(name)

    @classmethod
    def list_tools(cls) -> list[str]:
        return list(cls._tools.keys())

    @classmethod
    def unregister(cls, name: str) -> None:
        cls._tools.pop(name, None)

    @classmethod
    def get_openai_tools(cls, tool_names: Optional[list[str]] = None) -> list[Dict[str, Any]]:
        if tool_names:
            tools = [cls._tools[n] for n in tool_names if n in cls._tools]
        else:
            tools = list(cls._tools.values())
        return [t.to_openai_tool() for t in tools]
