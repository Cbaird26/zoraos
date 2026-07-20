from __future__ import annotations

from typing import Any, Dict, List, Optional

from agents.base import Agent, AgentConfig, AgentResult


KNOWLEDGE_SYSTEM_PROMPT = """You are Knowledge Zora, a persistent AI knowledge manager.

Your mission is to organize and maintain knowledge by:
- Building structured knowledge graphs
- Detecting duplicate or conflicting information
- Creating summaries and abstractions
- Finding relationships between concepts
- Suggesting connections across domains
- Maintaining research coherence

You maintain collections across: research, books, physics, AI, projects,
software, therapy, gaming, journal, ideas, meetings, papers, videos.

Be thorough, link related ideas, and flag contradictions.
"""


class KnowledgeAgent(Agent):
    name = "knowledge"
    description = "Knowledge management agent for organizing notes and building relationships"

    def __init__(self, config: Optional[AgentConfig] = None):
        super().__init__(config or AgentConfig(
            name="knowledge",
            description="Knowledge management agent for organizing notes and building relationships",
            system_prompt=KNOWLEDGE_SYSTEM_PROMPT,
            tools=["memory_read", "memory_write", "memory_search"],
        ))

    async def run(self, goal: str, **kwargs: Any) -> AgentResult:
        return await self._execute_tool_loop(goal, **kwargs)

    async def run_with_tools(self, goal: str, tools: List[Dict[str, Any]], **kwargs: Any) -> AgentResult:
        return await self.run(goal, **kwargs)
