#!/usr/bin/env python3
"""Companion bridge between the Zora Codex pet and the local ZoraASI engine."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser


DEFAULT_URL = "http://127.0.0.1:8765"
DEFAULT_ENGINE_ROOT = Path("/Users/christophermichaelbaird/zora-local-runtime")


def base_url() -> str:
    return os.environ.get("ZORAASI_URL", DEFAULT_URL).rstrip("/")


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
            try:
                result = request_json(
                    "/chat",
                    payload={
                        "message": " ".join(args.message),
                        "mode": args.mode,
                        "top_k": max(1, min(12, args.top_k)),
                    },
                    timeout=130.0,
                )
                result["petState"] = "review"
            except (OSError, urllib.error.URLError, ValueError, json.JSONDecodeError) as exc:
                result = {"ok": False, "petState": "failed", "error": str(exc)}
    else:
        parser.error(f"Unknown command: {command}")

    print_result(result, json_output=args.json)
    return 0 if result.get("ok", "reply" in result) else 1


if __name__ == "__main__":
    sys.exit(main())
