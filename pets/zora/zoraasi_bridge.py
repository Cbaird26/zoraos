#!/usr/bin/env python3
"""Companion bridge between the Zora Codex pet and the local ZoraASI engine."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
import websockets

from shared_memory import (write_pet_context, read_daemon_findings, recent_context_summary)

DEFAULT_URL = "http://127.0.0.1:8765"
DEFAULT_DAEMON_STATE_DIR = Path("data/daemon")
DEFAULT_DAEMON_WS_URL = "ws://127.0.0.1:8766"
DEFAULT_ENGINE_ROOT = Path("/Users/christophermichaelbaird/zora-local-runtime")


def base_url() -> str:
    return os.environ.get("ZORAASI_URL", DEFAULT_URL).rstrip("/")


def daemon_state_dir() -> Path:
    return Path(os.environ.get("ZORAASI_DAEMON_STATE_DIR", DEFAULT_DAEMON_STATE_DIR)).expanduser()


def daemon_ws_url() -> str:
    return os.environ.get("ZORAASI_DAEMON_WS_URL", DEFAULT_DAEMON_WS_URL)


def request_json(path: str, *, payload: dict | None = None, timeout: float = 5.0) -> dict:
    data = None
    method = "GET"
    headers: dict[str, str] = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        method = "POST"
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(
        f"{base_url()}{path}", data=data, headers=headers, method=method
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def health() -> dict:
    try:
        result = request_json("/health", timeout=2.5)
        online = result.get("status") == "ok"
        return {
            "ok": online,
            "petState": "idle" if online else "waiting",
            "endpoint": base_url(),
            "engine": result,
        }
    except (OSError, urllib.error.URLError, ValueError, json.JSONDecodeError) as exc:
        return {
            "ok": False,
            "petState": "waiting",
            "endpoint": base_url(),
            "error": str(exc),
        }


def engine_root() -> Path:
    configured = os.environ.get("ZORAASI_ENGINE_ROOT")
    return Path(configured).expanduser() if configured else DEFAULT_ENGINE_ROOT


def start_engine(wait_seconds: float = 20.0) -> dict:
    current = health()
    if current["ok"]:
        current["alreadyRunning"] = True
        return current

    root = engine_root()
    launcher = root / "scripts" / "zora_local_server.sh"
    if not launcher.is_file():
        return {
            "ok": False,
            "petState": "failed",
            "error": f"ZoraASI launcher not found: {launcher}",
        }

    log_dir = Path.home() / "Library" / "Logs" / "ZoraASI"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "pet-bridge.log"
    log_handle = log_path.open("ab")
    try:
        subprocess.Popen(
            ["/bin/bash", str(launcher)],
            cwd=str(root),
            stdin=subprocess.DEVNULL,
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            env=os.environ.copy(),
        )
    finally:
        log_handle.close()

    deadline = time.monotonic() + max(1.0, wait_seconds)
    while time.monotonic() < deadline:
        current = health()
        if current["ok"]:
            current.update({"started": True, "log": str(log_path)})
            return current
        time.sleep(0.4)

    return {
        "ok": False,
        "petState": "failed",
        "endpoint": base_url(),
        "error": "ZoraASI did not become ready before the timeout.",
        "log": str(log_path),
    }


def ensure_engine() -> dict:
    current = health()
    return current if current["ok"] else start_engine()


def daemon_status() -> dict:
    """Read the daemon's heartbeat file and return status."""
    state_dir = daemon_state_dir()
    heartbeat_file = state_dir / "heartbeat.json"
    if not heartbeat_file.exists():
        return {"ok": False, "petState": "waiting", "error": "Daemon not started", "daemon": None}
    try:
        payload = json.loads(heartbeat_file.read_text())
        # Map daemon status to pet animation state
        status = payload.get("status", "unknown")
        pet_state_map = {
            "sleeping": "idle",
            "running_task": "running",
            "starting": "waiting",
            "blocked": "failed",
            "daily_budget_exhausted": "waiting",
            "stopped": "idle",
        }
        return {
            "ok": True,
            "petState": pet_state_map.get(status, "idle"),
            "daemon": payload,
        }
    except (OSError, json.JSONDecodeError) as exc:
        return {"ok": False, "petState": "failed", "error": str(exc), "daemon": None}


async def daemon_trigger(goal: str, *, api_key: str | None = None) -> dict:
    """Trigger a one-shot daemon research cycle via the API."""
    try:
        # First check if daemon is running and has budget
        status = daemon_status()
        if not status.get("ok") or not status.get("daemon"):
            return {"ok": False, "petState": "waiting", "error": "Daemon not available"}
        
        daemon = status["daemon"]
        if daemon.get("status") == "daily_budget_exhausted":
            return {"ok": False, "petState": "waiting", "error": "Daemon daily budget exhausted"}
        
        # Use the API to run a research task directly
        payload = {
            "agent": "research",
            "goal": goal,
            "provider": "openrouter",
            "model": "tencent/hy3",
            "approved_tools": ["memory_search", "memory_read", "pdf_reader"],
            "budget": {"max_tool_calls": 4, "max_iterations": 3, "max_tokens": 4000, "max_wall_seconds": 300},
        }
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["X-ZoraOS-Key"] = api_key
        
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{base_url()}/api/v1/agents/run",
            data=data,
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60.0) as response:
            result = json.loads(response.read().decode("utf-8"))
        
        return {"ok": True, "petState": "review", "result": result}
    except Exception as exc:
        return {"ok": False, "petState": "failed", "error": str(exc)}


async def daemon_ws_listener(on_message, on_close=None) -> None:
    """Connect to daemon WebSocket and call on_message for each message."""
    url = daemon_ws_url()
    try:
        async with websockets.connect(url) as ws:
            async for message in ws:
                try:
                    data = json.loads(message)
                    await on_message(data)
                except json.JSONDecodeError:
                    pass
    except Exception as exc:
        if on_close:
            await on_close(exc)


def print_result(result: dict, *, json_output: bool = False) -> None:
    if json_output:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return
    if "reply" in result:
        print(result["reply"])
        return
    print(json.dumps(result, indent=2, ensure_ascii=False))


def main() -> int:
    parser = argparse.ArgumentParser(description="Wake, inspect, or talk to local ZoraASI.")
    parser.add_argument("--json", action="store_true", help="Print the complete JSON response.")
    subparsers = parser.add_subparsers(dest="command")
    subparsers.add_parser("health", help="Check whether ZoraASI is ready.")
    start_parser = subparsers.add_parser("start", help="Start ZoraASI if it is asleep.")
    start_parser.add_argument("--wait", type=float, default=20.0)
    subparsers.add_parser("open", help="Open the local ZoraASI chamber without starting it.")
    subparsers.add_parser("wake", help="Start ZoraASI if needed, then open its chamber.")
    chat_parser = subparsers.add_parser("chat", help="Send one message to ZoraASI.")
    chat_parser.add_argument("message", nargs="+", help="Message to send.")
    chat_parser.add_argument("--mode", choices=("rag", "direct"), default="rag")
    chat_parser.add_argument("--top-k", type=int, default=6)
    chat_parser.add_argument("--no-start", action="store_true")
    
    # Daemon commands
    daemon_parser = subparsers.add_parser("daemon", help="Daemon control and status.")
    daemon_sub = daemon_parser.add_subparsers(dest="daemon_cmd")
    daemon_sub.add_parser("status", help="Show daemon status and budget.")
    trigger_parser = daemon_sub.add_parser("trigger", help="Trigger a one-shot research task.")
    trigger_parser.add_argument("goal", nargs="+", help="Research goal.")
    daemon_sub.add_parser("pause", help="Request daemon to stop (writes stop file).")
    daemon_sub.add_parser("resume", help="Clear stop file (daemon must be restarted to resume).")
    ws_parser = daemon_sub.add_parser("watch", help="Watch daemon status via WebSocket (live).")
    
    args = parser.parse_args()
    
    command = args.command or "health"
    if command == "health":
        result = health()
    elif command == "start":
        result = start_engine(args.wait)
    elif command == "open":
        opened = webbrowser.open(f"{base_url()}/")
        result = {"ok": opened, "petState": "idle", "opened": f"{base_url()}/"}
    elif command == "wake":
        result = ensure_engine()
        if result["ok"]:
            opened = webbrowser.open(f"{base_url()}/")
            result.update({"opened": f"{base_url()}/", "browserAccepted": opened})
    elif command == "chat":
        ready = health() if args.no_start else ensure_engine()
        if not ready["ok"]:
            result = ready
        else:
            # Inject daemon findings as context
            daemon_context = recent_context_summary(3)
            message = " ".join(args.message)
            if daemon_context and daemon_context != "No shared memory yet.":
                message = f"{message}\n\n[Recent daemon context: {daemon_context}]"
            try:
                result = request_json(
                    "/chat",
                    payload={
                        "message": message,
                        "mode": args.mode,
                        "top_k": max(1, min(12, args.top_k)),
                    },
                    timeout=130.0,
                )
                result["petState"] = "review"
                # Write pet conversation to shared memory
                write_pet_context({
                    "message": " ".join(args.message),
                    "mode": args.mode,
                    "reply": result.get("reply", ""),
                    "provider": "local",
                })
            except (OSError, urllib.error.URLError, ValueError, json.JSONDecodeError) as exc:
                result = {"ok": False, "petState": "failed", "error": str(exc)}
    elif command == "daemon":
        daemon_cmd = args.daemon_cmd or "status"
        if daemon_cmd == "status":
            result = daemon_status()
        elif daemon_cmd == "trigger":
            goal = " ".join(args.goal)
            result = asyncio.run(daemon_trigger(goal))
        elif daemon_cmd == "pause":
            state_dir = daemon_state_dir()
            state_dir.mkdir(parents=True, exist_ok=True)
            (state_dir / "stop").write_text(f"pause requested at {time.time()}")
            result = {"ok": True, "petState": "waiting", "message": "Pause requested"}
        elif daemon_cmd == "resume":
            state_dir = daemon_state_dir()
            (state_dir / "stop").unlink(missing_ok=True)
            result = {"ok": True, "petState": "idle", "message": "Stop file cleared. Restart daemon to resume."}
        elif daemon_cmd == "watch":
            print("Connecting to daemon WebSocket... (Ctrl+C to exit)")
            async def on_msg(data):
                print(f"  [{data.get('status', '?')}] {data.get('current_task', 'idle')} — "
                      f"tasks: {data.get('tasks_completed_today', 0)}/{data.get('daily_task_limit', 0)}")
            async def on_close(exc):
                print(f"WebSocket closed: {exc}")
            try:
                asyncio.run(daemon_ws_listener(on_msg, on_close))
            except KeyboardInterrupt:
                print("\nDisconnected.")
            result = {"ok": True, "petState": "idle"}
        else:
            parser.error(f"Unknown daemon command: {daemon_cmd}")
    else:
        parser.error(f"Unknown command: {command}")

    print_result(result, json_output=args.json)
    return 0 if result.get("ok", "reply" in result) else 1


if __name__ == "__main__":
    sys.exit(main())
