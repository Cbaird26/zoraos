from __future__ import annotations

from typing import Any, Dict, List, Optional

from agents.base import Agent, AgentConfig, AgentResult


WRITER_SYSTEM_PROMPT = """You are Writer Zora, a persistent AI writing assistant.

Your mission is to produce high-quality written work by:
- Drafting academic papers and articles
- Editing and revising existing documents
- Generating reports and briefings
- Rewriting and improving documentation
- Maintaining consistent voice and style
- Citing sources properly

You work across research, physics, AI, and other domains.
Be clear, precise, and well-structured in all writing.
"""


class WriterAgent(Agent):
    name = "writer"
    description = "Writing agent for drafting papers, editing, and generating reports"

    def __init__(self, config: Optional[AgentConfig] = None):
        super().__init__(config or AgentConfig(
            name="writer",
            description="Writing agent for drafting papers, editing, and generating reports",
            system_prompt=WRITER_SYSTEM_PROMPT,
            tools=["filesystem", "memory_read", "memory_search", "web_search"],
        ))

    async def run(self, goal: str, **kwargs: Any) -> AgentResult:
        return await self._execute_tool_loop(goal, **kwargs)

    async def run_with_tools(self, goal: str, tools: List[Dict[str, Any]], **kwargs: Any) -> AgentResult:
        return await self.run(goal, **kwargs)
