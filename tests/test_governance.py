"""Tests for the governed execution controls."""

import pytest

from governance.audit import AuditLedger
from governance.context import ExecutionBudget, ExecutionContext
from governance.policy import CapabilityClass, GovernancePolicy
from tools.base import Tool, ToolResult
from tools.manager import ToolManager
from tools.registry import ToolRegistry


class ExternalTool(Tool):
    name = "web_search"

    async def execute(self, **kwargs: object) -> ToolResult:
        return ToolResult(success=True, output={"ok": True})


class DesktopTool(Tool):
    name = "eq_send_keys"

    async def execute(self, **kwargs: object) -> ToolResult:
        return ToolResult(success=True, output={"ok": True})


@pytest.fixture
def governed_tools() -> tuple[ToolManager, AuditLedger]:
    original_tools = dict(ToolRegistry._tools)
    registry = ToolRegistry()
    registry.unregister("web_search")
    registry.unregister("eq_send_keys")
    registry.register(ExternalTool())
    registry.register(DesktopTool())
    ledger = AuditLedger()
    try:
        yield ToolManager(registry, GovernancePolicy(), ledger), ledger
    finally:
        ToolRegistry._tools = original_tools


@pytest.mark.asyncio
async def test_external_tool_requires_explicit_approval(
    governed_tools: tuple[ToolManager, AuditLedger],
) -> None:
    manager, ledger = governed_tools
    denied = await manager.execute("web_search", query="test")
    assert not denied.success
    assert "governed task context" in (denied.error or "")

    context = ExecutionContext(task_id="task-1", approved_tools=frozenset({"web_search"}))
    with manager.execution_context(context):
        allowed = await manager.execute("web_search", query="test")

    assert allowed.success
    assert ledger.verify()
    assert [event["event_type"] for event in ledger.events_for_task("task-1")] == [
        "tool_started",
        "tool_completed",
    ]


@pytest.mark.asyncio
async def test_third_party_desktop_control_is_denied_even_when_approved(
    governed_tools: tuple[ToolManager, AuditLedger],
) -> None:
    manager, _ = governed_tools
    context = ExecutionContext(task_id="task-2", approved_tools=frozenset({"eq_send_keys"}))
    with manager.execution_context(context):
        result = await manager.execute("eq_send_keys", keys="/say hello{enter}")

    assert not result.success
    assert "approved sandbox" in (result.error or "")


@pytest.mark.asyncio
async def test_tool_call_budget_is_enforced(
    governed_tools: tuple[ToolManager, AuditLedger],
) -> None:
    manager, ledger = governed_tools
    context = ExecutionContext(
        task_id="task-3",
        approved_tools=frozenset({"web_search"}),
        budget=ExecutionBudget(max_tool_calls=1),
    )
    with manager.execution_context(context):
        first = await manager.execute("web_search", query="first")
        second = await manager.execute("web_search", query="second")

    assert first.success
    assert not second.success
    assert "budget exceeded" in (second.error or "")
    assert ledger.verify()


def test_unknown_tool_is_default_denied() -> None:
    policy = GovernancePolicy()
    context = ExecutionContext(
        task_id="task-unknown",
        approved_tools=frozenset({"new_side_effecting_tool"}),
    )

    assert policy.classify("new_side_effecting_tool") is CapabilityClass.PROHIBITED
    allowed, reason = policy.authorize("new_side_effecting_tool", context)

    assert not allowed
    assert "not registered" in (reason or "")
