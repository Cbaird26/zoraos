"""
Example ZoraOS plugin.
Shows how to extend the system with custom functionality.
"""

from typing import Any, Dict

from plugins import Plugin


class ArxivSearchPlugin(Plugin):
    name = "arxiv_search"
    version = "0.1.0"
    description = "Search and fetch papers from arXiv"

    def on_load(self, context: Dict[str, Any]) -> None:
        tool_registry = context.get("tool_registry")
        if tool_registry:
            from tools.base import Tool, ToolResult

            class ArxivSearchTool(Tool):
                name = "arxiv_search"
                description = "Search arXiv for academic papers"
                parameters = {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"},
                        "max_results": {"type": "integer", "default": 10},
                    },
                    "required": ["query"],
                }

                async def execute(self, query: str, max_results: int = 10, **kwargs: Any) -> ToolResult:
                    import httpx
                    import xml.etree.ElementTree as ET

                    url = f"http://export.arxiv.org/api/query?search_query=all:{query}&max_results={max_results}"
                    async with httpx.AsyncClient() as client:
                        response = await client.get(url)
                        root = ET.fromstring(response.content)

                    ns = {"a": "http://www.w3.org/2005/Atom"}
                    entries = []
                    for entry in root.findall("a:entry", ns):
                        title = entry.find("a:title", ns)
                        summary = entry.find("a:summary", ns)
                        entries.append({
                            "title": title.text.strip() if title is not None else "",
                            "summary": summary.text.strip()[:500] if summary is not None else "",
                        })

                    return ToolResult(success=True, output={"results": entries})

            tool_registry.register(ArxivSearchTool())

    def on_unload(self) -> None:
        pass
