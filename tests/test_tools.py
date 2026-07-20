"""Tests for the tool system."""

import pytest

from tools.base import Tool, ToolResult, ToolSpec
from tools.registry import ToolRegistry


class TestToolSpec:
    def test_create_spec(self):
        spec = ToolSpec(
            name="test_tool",
            description="A test tool",
            parameters={"type": "object", "properties": {}},
        )
        assert spec.name == "test_tool"
        assert spec.description == "A test tool"


class TestToolResult:
    def test_success_result(self):
        result = ToolResult(success=True, output={"message": "done"})
        assert result.success is True
        assert result.output == {"message": "done"}
        assert result.error is None

    def test_error_result(self):
        result = ToolResult(success=False, error="Something went wrong")
        assert result.success is False
        assert result.error == "Something went wrong"


class TestToolRegistry:
    def test_register_and_list(self):
        registry = ToolRegistry()

        class FakeTool(Tool):
            name = "fake"
            description = "Fake tool"

            async def execute(self, **kwargs):
                return ToolResult(success=True)

        tool = FakeTool()
        registry.register(tool)
        assert "fake" in registry.list_tools()
        registry.unregister("fake")
        assert "fake" not in registry.list_tools()
