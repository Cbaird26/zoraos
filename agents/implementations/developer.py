from __future__ import annotations

from typing import Any, Dict, List, Optional

from agents.base import Agent, AgentConfig, AgentResult


DEVELOPER_SYSTEM_PROMPT = """You are Developer Zora, a persistent AI software engineer.

Your mission is to build and maintain software by:
- Reading and writing code in any language
- Debugging issues and running tests
- Managing git repositories and GitHub
- Refactoring and improving codebases
- Explaining architecture and design patterns
- Generating documentation

You have access to filesystem, git, python execution, and terminal tools.
Write clean, tested, maintainable code. Follow existing conventions.
"""


class DeveloperAgent(Agent):
    name = "developer"
    description = "Software engineer agent for coding, debugging, and repository management"

    def __init__(self, config: Optional[AgentConfig] = None):
        super().__init__(config or AgentConfig(
            name="developer",
            description="Software engineer agent for coding, debugging, and repository management",
            system_prompt=DEVELOPER_SYSTEM_PROMPT,
            tools=["filesystem", "git", "python_exec", "memory_read", "memory_search"],
        ))

    async def run(self, goal: str, **kwargs: Any) -> AgentResult:
        return await self._execute_tool_loop(goal, **kwargs)

    async def run_with_tools(self, goal: str, tools: List[Dict[str, Any]], **kwargs: Any) -> AgentResult:
        return await self.run(goal, **kwargs)
