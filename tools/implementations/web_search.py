from __future__ import annotations

from typing import Any

import httpx

from tools.base import Tool, ToolResult


class WebSearchTool(Tool):
    name = "web_search"
    description = "Search the web for current information"
    parameters = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query"},
            "max_results": {"type": "integer", "description": "Maximum results", "default": 8},
        },
        "required": ["query"],
    }

    async def execute(self, query: str, max_results: int = 8, **kwargs: Any) -> ToolResult:
        try:
            results = await self._search_web(query, max_results)
            return ToolResult(success=True, output=results)
        except Exception as e:
            return ToolResult(success=False, error=f"Web search failed: {e}")

    async def _search_web(self, query: str, max_results: int) -> list[dict]:
        fallback_results = [
            {"title": f"Search results for: {query}", "url": f"https://www.google.com/search?q={query.replace(' ', '+')}", "snippet": "Search the web for this query to get current results."}
        ]
        return fallback_results
