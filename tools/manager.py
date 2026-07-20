from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Dict, List, Optional

from governance.audit import AuditLedger
from governance.context import ExecutionContext
from governance.policy import GovernancePolicy

from .base import Tool, ToolResult
from .registry import ToolRegistry


class ToolManager:
    def __init__(
        self,
        registry: ToolRegistry,
        policy: GovernancePolicy | None = None,
        audit_ledger: AuditLedger | None = None,
    ):
        self._registry = registry
        self._policy = policy
        self._audit_ledger = audit_ledger
        self._execution_context: ContextVar[ExecutionContext | None] = ContextVar(
            "zoraos_execution_context",
            default=None,
        )

    @contextmanager
    def execution_context(self, context: ExecutionContext):
        token = self._execution_context.set(context)
        try:
            yield
        finally:
            self._execution_context.reset(token)

    async def execute(self, tool_name: str, **kwargs: Any) -> ToolResult:
        context = self._execution_context.get()
        task_id = context.task_id if context else None
        if self._policy:
            allowed, reason = self._policy.authorize(tool_name, context)
            if not allowed:
                if self._audit_ledger:
                    self._audit_ledger.record(
                        "tool_denied",
                        {"tool": tool_name, "reason": reason},
                        task_id,
                    )
                return ToolResult(success=False, error=reason)
        if context and not context.budget.consume_tool_call():
            if self._audit_ledger:
                self._audit_ledger.record(
                    "budget_exceeded",
                    {"tool": tool_name, "max_tool_calls": context.budget.max_tool_calls},
                    task_id,
                )
            return ToolResult(success=False, error="Task tool-call budget exceeded")

        tool = self._registry.get(tool_name)
        if not tool:
            return ToolResult(success=False, error=f"Tool '{tool_name}' not found")
        if self._audit_ledger:
            self._audit_ledger.record(
                "tool_started",
                {"tool": tool_name, "argument_keys": sorted(kwargs.keys())},
                task_id,
            )
        try:
            result = await tool.execute(**kwargs)
            if self._audit_ledger:
                self._audit_ledger.record(
                    "tool_completed",
                    {"tool": tool_name, "success": result.success},
                    task_id,
                )
            return result
        except Exception as e:
            if self._audit_ledger:
                self._audit_ledger.record(
                    "tool_failed",
                    {"tool": tool_name, "error_type": type(e).__name__},
                    task_id,
                )
            return ToolResult(success=False, error=f"Tool '{tool_name}' execution failed: {e}")

    def get_tool(self, name: str) -> Optional[Tool]:
        return self._registry.get(name)

    def list_tools(self) -> list[str]:
        return self._registry.list_tools()

    def get_tools_for_agent(self, tool_names: List[str]) -> List[Dict[str, Any]]:
        return self._registry.get_openai_tools(tool_names)
