from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ExecutionBudget:
    max_tool_calls: int = 20
    max_iterations: int = 10
    max_tokens: int | None = None
    max_wall_seconds: int = 300
    tool_calls_used: int = 0

    def consume_tool_call(self) -> bool:
        if self.tool_calls_used >= self.max_tool_calls:
            return False
        self.tool_calls_used += 1
        return True


@dataclass
class ExecutionContext:
    task_id: str
    approved_tools: frozenset[str] = field(default_factory=frozenset)
    budget: ExecutionBudget = field(default_factory=ExecutionBudget)
    cancelled: bool = False

    def permits(self, tool_name: str) -> bool:
        return tool_name in self.approved_tools
