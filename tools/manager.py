from __future__ import annotations

from typing import Any, Dict, List, Optional

from .base import Tool, ToolResult
from .registry import ToolRegistry


class ToolManager:
    def __init__(self, registry: ToolRegistry):
        self._registry = registry

    async def execute(self, tool_name: str, **kwargs: Any) -> ToolResult:
        tool = self._registry.get(tool_name)
        if not tool:
            return ToolResult(success=False, error=f"Tool '{tool_name}' not found")
        try:
            return await tool.execute(**kwargs)
        except Exception as e:
            return ToolResult(success=False, error=f"Tool '{tool_name}' execution failed: {e}")

    def get_tool(self, name: str) -> Optional[Tool]:
        return self._registry.get(name)

    def list_tools(self) -> list[str]:
        return self._registry.list_tools()

    def get_tools_for_agent(self, tool_names: List[str]) -> List[Dict[str, Any]]:
        return self._registry.get_openai_tools(tool_names)
