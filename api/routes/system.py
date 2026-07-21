from __future__ import annotations

import json
import os
import time

from fastapi import APIRouter, Depends

from configs.settings import settings
from gateway.service import GatewayService

from ..dependencies import get_gateway

router = APIRouter()


def daemon_status() -> dict:
    state_dir = settings.data_path / "daemon"
    heartbeat_path = state_dir / "heartbeat.json"
    pid_path = state_dir / "daemon.pid"
    if not heartbeat_path.exists():
        return {"status": "not_started", "running": False}

    try:
        payload = json.loads(heartbeat_path.read_text())
    except (OSError, json.JSONDecodeError):
        return {"status": "unreadable", "running": False}

    running = False
    if pid_path.exists():
        try:
            os.kill(int(pid_path.read_text().strip()), 0)
            running = True
        except (OSError, TypeError, ValueError):
            running = False

    last_heartbeat = float(payload.get("last_heartbeat") or 0.0)
    return {
        "status": payload.get("status", "unknown"),
        "running": running,
        "continuous": bool(payload.get("continuous", False)),
        "provider": payload.get("provider"),
        "model": payload.get("model"),
        "fallback_provider": payload.get("fallback_provider"),
        "allow_web": bool(payload.get("allow_web", False)),
        "memory_tools_approved": bool(payload.get("memory_tools_approved", False)),
        "write_tools_approved": bool(payload.get("write_tools_approved", False)),
        "desktop_tools_approved": bool(payload.get("desktop_tools_approved", False)),
        "day": payload.get("day"),
        "daily_task_limit": payload.get("daily_task_limit", 0),
        "tasks_started_today": payload.get("tasks_started_today", 0),
        "tasks_completed_today": payload.get("tasks_completed_today", 0),
        "tasks_failed_today": payload.get("tasks_failed_today", 0),
        "daily_token_limit": payload.get("daily_token_limit", 0),
        "tokens_used_today": payload.get("tokens_used_today", 0),
        "last_task_id": payload.get("last_task_id"),
        "last_result_file": payload.get("last_result_file"),
        "result_available": bool(payload.get("last_result_file")),
        "last_error": payload.get("last_error"),
        "heartbeat_age_seconds": round(max(0.0, time.time() - last_heartbeat), 1),
    }


@router.get("/system/status")
async def system_status(gateway: GatewayService = Depends(get_gateway)):
    result = await gateway.health()
    result["daemon"] = daemon_status()
    return result


@router.get("/system/daemon")
async def get_daemon_status():
    return daemon_status()


@router.post("/system/daemon/stop")
async def stop_daemon():
    state_dir = settings.data_path / "daemon"
    state_dir.mkdir(parents=True, exist_ok=True)
    stop_path = state_dir / "stop"
    stop_path.write_text(f"stop requested at {time.time()}")
    return {"status": "stop_requested", "running": daemon_status()["running"]}
