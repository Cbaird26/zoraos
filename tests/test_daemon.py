"""Tests for the operator-started bounded research daemon."""

from __future__ import annotations

import json

import pytest

from scripts.zora_daemon import ZoraDaemon


def test_continuous_mode_rejects_fast_cycles(tmp_path) -> None:
    with pytest.raises(ValueError, match="at least 15 minutes"):
        ZoraDaemon(
            goal="Test a bounded question",
            state_dir=tmp_path,
            continuous=True,
            interval_minutes=1,
        )


@pytest.mark.asyncio
async def test_daily_budget_state_survives_restart(tmp_path) -> None:
    daemon = ZoraDaemon(goal="Test a bounded question", state_dir=tmp_path)
    daemon.state.tasks_started_today = 2
    daemon.state.tokens_used_today = 1200
    await daemon.write_state()

    restored = ZoraDaemon(goal="Test a bounded question", state_dir=tmp_path)

    assert restored.state.tasks_started_today == 2
    assert restored.state.tokens_used_today == 1200


@pytest.mark.asyncio
async def test_research_request_uses_bounded_hy3_and_is_read_only(tmp_path, monkeypatch) -> None:
    daemon = ZoraDaemon(goal="Test a bounded question", state_dir=tmp_path)
    captured = {}

    async def fake_request(method, path, body=None):
        captured.update({"method": method, "path": path, "body": body})
        return {
            "task_id": "task-1",
            "result": {
                "success": True,
                "iterations": 1,
                "tokens_used": 42,
                "output": {"response": "Grounded final synthesis", "tool_calls": []},
            },
        }

    monkeypatch.setattr(daemon, "_api_request", fake_request)

    await daemon.run_research()

    assert captured["method"] == "POST"
    assert captured["path"] == "/api/v1/agents/run"
    assert captured["body"]["provider"] == "openrouter"
    assert captured["body"]["model"] == "tencent/hy3"
    assert "Always return a concise final synthesis" in captured["body"]["goal"]
    assert captured["body"]["approved_tools"] == [
        "memory_search",
        "memory_read",
        "pdf_reader",
    ]
    assert "filesystem" not in captured["body"]["approved_tools"]
    assert "memory_write" not in captured["body"]["approved_tools"]
    assert daemon.state.tasks_completed_today == 1
    assert daemon.state.tokens_used_today == 42
    assert daemon.state.last_result_file is not None

    result_files = list((tmp_path / "results").glob("*.json"))
    assert len(result_files) == 1
    saved_result = json.loads(result_files[0].read_text())
    assert saved_result["provider"] == "openrouter"
    assert saved_result["model"] == "tencent/hy3"
    assert saved_result["success"] is True

    heartbeat = json.loads((tmp_path / "heartbeat.json").read_text())
    assert heartbeat["provider"] == "openrouter"
    assert heartbeat["model"] == "tencent/hy3"
    assert heartbeat["fallback_provider"] == "ollama"
    assert heartbeat["write_tools_approved"] is False
    assert heartbeat["desktop_tools_approved"] is False


@pytest.mark.asyncio
async def test_research_retries_once_with_local_fallback(tmp_path, monkeypatch) -> None:
    daemon = ZoraDaemon(goal="Test a bounded question", state_dir=tmp_path)
    attempts = []

    async def fake_request(method, path, body=None):
        attempts.append(body)
        if body["provider"] == "openrouter":
            return None
        return {
            "task_id": "task-local",
            "result": {
                "success": True,
                "iterations": 1,
                "tokens_used": 12,
                "output": {"tool_calls": []},
            },
        }

    monkeypatch.setattr(daemon, "_api_request", fake_request)
    await daemon.run_research()

    assert [attempt["provider"] for attempt in attempts] == ["openrouter", "ollama"]
    assert attempts[1]["model"] == "zora:core"
    saved_result = json.loads(next((tmp_path / "results").glob("*.json")).read_text())
    assert saved_result["provider"] == "ollama"
    assert saved_result["preferred_provider"] == "openrouter"


@pytest.mark.asyncio
async def test_show_mode_can_run_without_any_tools(tmp_path, monkeypatch) -> None:
    daemon = ZoraDaemon(
        goal="Use these supplied facts for a short curtain call",
        state_dir=tmp_path,
        allow_memory=False,
    )
    captured = {}

    async def fake_request(method, path, body=None):
        captured.update(body)
        return {
            "task_id": "show-1",
            "result": {
                "success": True,
                "iterations": 1,
                "tokens_used": 25,
                "output": {"response": "Curtain call", "tool_calls": []},
            },
        }

    monkeypatch.setattr(daemon, "_api_request", fake_request)
    await daemon.run_research()

    assert captured["approved_tools"] == []
    assert "Do not call tools" in captured["goal"]
    assert daemon.state.tasks_completed_today == 1


@pytest.mark.asyncio
async def test_empty_final_response_is_recorded_as_failure(tmp_path, monkeypatch) -> None:
    daemon = ZoraDaemon(goal="Return a final answer", state_dir=tmp_path)

    async def fake_request(method, path, body=None):
        return {
            "task_id": "empty-1",
            "result": {
                "success": True,
                "iterations": 3,
                "tokens_used": 100,
                "output": {"response": "", "tool_calls": []},
            },
        }

    monkeypatch.setattr(daemon, "_api_request", fake_request)
    await daemon.run_research()

    assert daemon.state.tasks_completed_today == 0
    assert daemon.state.tasks_failed_today == 1
    assert daemon.state.last_error == "Agent completed without a final response"
