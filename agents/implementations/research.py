from __future__ import annotations

from typing import Any, Dict, List, Optional

from agents.base import Agent, AgentConfig, AgentResult


RESEARCH_SYSTEM_PROMPT = """You are Research Zora, a persistent AI research assistant.

Your mission is to advance scientific knowledge by:
- Reading and summarizing academic papers (PDFs)
- Comparing findings across papers
- Identifying contradictions and gaps
- Producing literature reviews
- Tracking developments in quantum physics, AI, consciousness, and philosophy
- Cross-referencing with existing knowledge in long-term memory

You have access to tools for web search, PDF reading, and memory operations.
Be thorough, cite sources, and flag uncertainty clearly.
"""


class ResearchAgent(Agent):
    name = "research"
    description = "Research agent for reading papers, summarizing, and literature reviews"

    def __init__(self, config: Optional[AgentConfig] = None):
        super().__init__(config or AgentConfig(
            name="research",
            description="Research agent for reading papers, summarizing, and literature reviews",
            system_prompt=RESEARCH_SYSTEM_PROMPT,
            tools=["web_search", "pdf_reader", "memory_write", "memory_read", "memory_search"],
        ))

    async def run(self, goal: str, **kwargs: Any) -> AgentResult:
        return await self._execute_tool_loop(goal, **kwargs)

    async def run_with_tools(self, goal: str, tools: List[Dict[str, Any]], **kwargs: Any) -> AgentResult:
        return await self.run(goal, **kwargs)
