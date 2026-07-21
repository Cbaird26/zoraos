#!/usr/bin/env python3
"""Operator-started, bounded research cycles for ZoraOS.

The daemon never starts with the API, never approves write or desktop-control tools,
and keeps a local Ollama fallback. Continuous mode must be requested explicitly.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import signal
import time
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
import websockets
import websockets.asyncio.server

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("zoraos.daemon")

DEFAULT_STATE_DIR = Path("data/daemon")
MIN_CONTINUOUS_INTERVAL_MINUTES = 15


def utc_day() -> str:
    return datetime.now(UTC).date().isoformat()


def write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(json.dumps(payload, indent=2, sort_keys=True))
    temporary.replace(path)


class DaemonWebSocket:
    """Broadcasts daemon status to connected pet bridge clients."""

    def __init__(self, host: str = "127.0.0.1", port: int = 8766) -> None:
        self.host = host
        self.port = port
        self.clients: set[websockets.asyncio.server.ServerConnection] = set()
        self._server: websockets.asyncio.server.WebSocketServer | None = None
        self._latest_state: dict[str, Any] = {}

    async def start(self) -> None:
        self._server = await websockets.asyncio.server.serve(
            self._handler, self.host, self.port
        )
        logger.info("Daemon WebSocket server started on ws://%s:%s", self.host, self.port)

    async def stop(self) -> None:
        if self._server:
            self._server.close()
            await self._server.wait_closed()
            logger.info("Daemon WebSocket server stopped")

    async def _handler(self, conn: websockets.asyncio.server.ServerConnection) -> None:
        self.clients.add(conn)
        try:
            # Send current state immediately on connect
            if self._latest_state:
                await conn.send(json.dumps(self._latest_state))
            async for message in conn:
                try:
                    cmd = json.loads(message)
                    if cmd.get("command") == "ping":
                        await conn.send(json.dumps({"status": "pong", "state": self._latest_state}))
                except json.JSONDecodeError:
                    pass
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.clients.discard(conn)

    async def broadcast(self, state: dict[str, Any]) -> None:
        self._latest_state = state
        if not self.clients:
            return
        message = json.dumps(state)
        disconnected = set()
        for client in self.clients:
            try:
                await client.send(message)
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)
        self.clients -= disconnected


@dataclass
class DaemonState:
    day: str = field(default_factory=utc_day)
    status: str = "stopped"
    daily_task_limit: int = 3
    daily_tool_call_limit: int = 12
    daily_token_limit: int = 12_000
    tasks_started_today: int = 0
    tasks_completed_today: int = 0
    tasks_failed_today: int = 0
    tool_calls_used_today: int = 0
    model_iterations_today: int = 0
    tokens_used_today: int = 0
    last_heartbeat: float = 0.0
    last_cycle_started: float | None = None
    last_cycle_completed: float | None = None
    current_task: str | None = None
    last_task_id: str | None = None
    last_result_file: str | None = None
    last_error: str | None = None

    def reset_for_new_day(self) -> None:
        self.day = utc_day()
        self.tasks_started_today = 0
        self.tasks_completed_today = 0
        self.tasks_failed_today = 0
        self.tool_calls_used_today = 0
        self.model_iterations_today = 0
        self.tokens_used_today = 0
        self.last_error = None


class ZoraDaemon:
    def __init__(
        self,
        *,
        goal: str,
        api_base: str = "http://127.0.0.1:8000",
        api_key: str | None = None,
        state_dir: Path = DEFAULT_STATE_DIR,
        continuous: bool = False,
        interval_minutes: int = 360,
        allow_web: bool = False,
        allow_memory: bool = True,
        provider: str = "openrouter",
        model: str = "tencent/hy3",
        fallback_provider: str | None = "ollama",
        daily_task_limit: int = 3,
        daily_tool_call_limit: int = 12,
        daily_token_limit: int = 12_000,
        task_tool_call_limit: int = 4,
        task_iteration_limit: int = 3,
        task_token_limit: int = 4_000,
        task_wall_seconds: int = 300,
        ws_enabled: bool = True,
        ws_port: int = 8766,
    ) -> None:
        if not goal.strip():
            raise ValueError("A non-empty research goal is required")
        if continuous and interval_minutes < MIN_CONTINUOUS_INTERVAL_MINUTES:
            raise ValueError(
                f"Continuous interval must be at least {MIN_CONTINUOUS_INTERVAL_MINUTES} minutes"
            )

        self.goal = goal.strip()
        self.api_base = api_base.rstrip("/")
        self.api_key = api_key
        self.state_dir = state_dir.resolve()
        self.continuous = continuous
        self.interval_seconds = interval_minutes * 60
        self.allow_web = allow_web
        self.allow_memory = allow_memory
        self.provider = provider.strip().lower()
        self.model = model.strip()
        self.fallback_provider = (
            fallback_provider.strip().lower() if fallback_provider else None
        )
        if self.provider not in {"openrouter", "ollama"}:
            raise ValueError("Daemon provider must be 'openrouter' or 'ollama'")
        if not self.model:
            raise ValueError("A non-empty model is required")
        if self.fallback_provider not in {None, "ollama"}:
            raise ValueError("Daemon fallback provider must be 'ollama' or disabled")
        self.task_tool_call_limit = max(0, min(task_tool_call_limit, 10))
        self.task_iteration_limit = max(1, min(task_iteration_limit, 8))
        self.task_token_limit = max(256, min(task_token_limit, 16_000))
        self.task_wall_seconds = max(30, min(task_wall_seconds, 900))
        self.ws_enabled = ws_enabled
        self.ws_port = ws_port
        self.ws_server = DaemonWebSocket(port=ws_port) if ws_enabled else None
        self.stop_file = self.state_dir / "stop"
        self.heartbeat_file = self.state_dir / "heartbeat.json"
        self.state_file = self.state_dir / "state.json"
        self.pid_file = self.state_dir / "daemon.pid"
        self.results_dir = self.state_dir / "results"
        self._stop_event = asyncio.Event()

        self.state = self._load_state(
            daily_task_limit=max(1, min(daily_task_limit, 12)),
            daily_tool_call_limit=max(0, min(daily_tool_call_limit, 100)),
            daily_token_limit=max(256, min(daily_token_limit, 200_000)),
        )

    def _load_state(
        self,
        *,
        daily_task_limit: int,
        daily_tool_call_limit: int,
        daily_token_limit: int,
    ) -> DaemonState:
        state = DaemonState(
            daily_task_limit=daily_task_limit,
            daily_tool_call_limit=daily_tool_call_limit,
            daily_token_limit=daily_token_limit,
        )
        if self.state_file.exists():
            try:
                raw = json.loads(self.state_file.read_text())
                allowed = {field.name for field in DaemonState.__dataclass_fields__.values()}
                restored = DaemonState(
                    **{key: value for key, value in raw.items() if key in allowed}
                )
                restored.daily_task_limit = daily_task_limit
                restored.daily_tool_call_limit = daily_tool_call_limit
                restored.daily_token_limit = daily_token_limit
                restored.status = "stopped"
                restored.current_task = None
                state = restored
            except (OSError, TypeError, ValueError, json.JSONDecodeError):
                logger.warning("Ignoring unreadable daemon state")
        if state.day != utc_day():
            state.reset_for_new_day()
        return state

    def _another_instance_running(self) -> bool:
        if not self.pid_file.exists():
            return False
        try:
            pid = int(self.pid_file.read_text().strip())
            if pid == os.getpid():
                return False
            os.kill(pid, 0)
            return True
        except (OSError, TypeError, ValueError):
            self.pid_file.unlink(missing_ok=True)
            return False

    async def _api_request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        import httpx

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-ZoraOS-Key"] = self.api_key

        try:
            timeout = self.task_wall_seconds + 30 if method == "POST" else 30
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.request(
                    method,
                    f"{self.api_base}{path}",
                    headers=headers,
                    json=body if body is not None else None,
                )
                response.raise_for_status()
                payload = response.json()
                return payload if isinstance(payload, dict) else None
        except Exception as exc:
            self.state.last_error = f"API {method} {path} failed ({type(exc).__name__})"
            logger.warning(self.state.last_error)
            return None

    async def health_check(self) -> bool:
        result = await self._api_request("GET", "/api/v1/system/status")
        if not result or result.get("status") != "ok":
            return False
        available_providers = result.get("providers", [])
        if self.provider not in available_providers:
            self.state.last_error = f"Configured provider is unavailable: {self.provider}"
            return False
        if self.fallback_provider and self.fallback_provider not in available_providers:
            self.state.last_error = (
                f"Fallback provider is unavailable: {self.fallback_provider}"
            )
            return False
        logger.info(
            "API healthy: provider=%s, model=%s, fallback=%s, audit=%s, durable=%s",
            self.provider,
            self.model,
            self.fallback_provider or "disabled",
            result.get("audit_chain_valid", False),
            result.get("durable_audit_connected", False),
        )
        return True

    def _reset_daily_if_needed(self) -> None:
        if self.state.day != utc_day():
            logger.info("UTC day changed; resetting daily budgets")
            self.state.reset_for_new_day()

    def _budget_exhausted(self) -> bool:
        return (
            self.state.tasks_started_today >= self.state.daily_task_limit
            or self.state.tool_calls_used_today >= self.state.daily_tool_call_limit
            or self.state.tokens_used_today >= self.state.daily_token_limit
        )

    def _remaining_task_budget(self) -> dict[str, int]:
        remaining_tools = max(
            0,
            self.state.daily_tool_call_limit - self.state.tool_calls_used_today,
        )
        remaining_tokens = max(
            256,
            self.state.daily_token_limit - self.state.tokens_used_today,
        )
        return {
            "max_tool_calls": min(self.task_tool_call_limit, remaining_tools),
            "max_iterations": self.task_iteration_limit,
            "max_tokens": min(self.task_token_limit, remaining_tokens),
            "max_wall_seconds": self.task_wall_seconds,
        }

    async def run_research(self) -> None:
        self.state.status = "running_task"
        self.state.current_task = self.goal
        self.state.last_cycle_started = time.time()
        self.state.tasks_started_today += 1
        self.state.last_error = None
        await self.write_state()

        approved_tools = (
            ["memory_search", "memory_read", "pdf_reader"] if self.allow_memory else []
        )
        if self.allow_web:
            approved_tools.append("web_search")
        task_budget = self._remaining_task_budget()
        if self.allow_memory or self.allow_web:
            task_constraint = (
                "Use no more than two tool rounds. Always return a concise final synthesis "
                "before the iteration limit, clearly separating observed evidence, "
                "inference, disagreement, and unknowns. If evidence is insufficient, say "
                "so instead of requesting another tool."
            )
        else:
            task_constraint = (
                "Do not call tools. Use only the facts in this goal and return a concise "
                "final response in the first model turn. Do not invent missing evidence."
            )
        task_goal = f"{self.goal}\n\nOperational constraint: {task_constraint}"

        logger.info(
            "Starting bounded research: provider=%s model=%s goal=%.100s",
            self.provider,
            self.model,
            self.goal,
        )
        selected_provider = self.provider
        selected_model = self.model
        request_body = {
                "agent": "research",
                "goal": task_goal,
                "provider": selected_provider,
                "model": selected_model,
                "approved_tools": approved_tools,
                "budget": task_budget,
        }
        result = await self._api_request("POST", "/api/v1/agents/run", request_body)

        if result is None and self.fallback_provider and self.provider != self.fallback_provider:
            selected_provider = self.fallback_provider
            selected_model = "zora:core"
            logger.warning(
                "Primary route unavailable; retrying once with %s/%s",
                selected_provider,
                selected_model,
            )
            request_body = {
                **request_body,
                "provider": selected_provider,
                "model": selected_model,
            }
            result = await self._api_request("POST", "/api/v1/agents/run", request_body)

        if result:
            self.state.last_task_id = str(result.get("task_id") or "") or None
            agent_result = result.get("result") or {}
            iterations = int(agent_result.get("iterations") or 0)
            tokens = int(agent_result.get("tokens_used") or 0)
            output = agent_result.get("output") or {}
            tool_calls = output.get("tool_calls") if isinstance(output, dict) else []
            tool_call_count = len(tool_calls) if isinstance(tool_calls, list) else 0
            self.state.model_iterations_today += iterations
            self.state.tokens_used_today += tokens
            self.state.tool_calls_used_today += tool_call_count

            response_text = output.get("response") if isinstance(output, dict) else None
            has_final_response = isinstance(response_text, str) and bool(response_text.strip())
            completed_successfully = bool(agent_result.get("success")) and has_final_response

            if completed_successfully:
                self.state.tasks_completed_today += 1
                logger.info(
                    "Research completed: task=%s, iterations=%d, tokens=%d, tools=%d",
                    self.state.last_task_id,
                    iterations,
                    tokens,
                    tool_call_count,
                )
            else:
                self.state.tasks_failed_today += 1
                self.state.last_error = str(
                    agent_result.get("error")
                    or (
                        "Agent completed without a final response"
                        if not has_final_response
                        else "Agent task failed"
                    )
                )
                logger.warning("Research failed: %s", self.state.last_error)

            timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
            task_suffix = (self.state.last_task_id or "unknown")[:8]
            result_path = self.results_dir / f"{timestamp}_{task_suffix}.json"
            write_json_atomic(
                result_path,
                {
                    "timestamp": datetime.now(UTC).isoformat(),
                    "task_id": self.state.last_task_id,
                    "goal": self.goal,
                    "provider": selected_provider,
                    "model": selected_model,
                    "preferred_provider": self.provider,
                    "preferred_model": self.model,
                    "approved_tools": approved_tools,
                    "budget": task_budget,
                    "route": result.get("route"),
                    "success": completed_successfully,
                    "error": self.state.last_error if not completed_successfully else None,
                    "iterations": iterations,
                    "tokens_used": tokens,
                    "output": output,
                },
            )
            self.state.last_result_file = result_path.name
        else:
            self.state.tasks_failed_today += 1

        self.state.current_task = None
        self.state.last_cycle_completed = time.time()
        self.state.status = "sleeping" if self.continuous else "stopped"
        await self.write_state()

    async def heartbeat(self) -> None:
        self.state.last_heartbeat = time.time()
        payload = {
            **asdict(self.state),
            "timestamp": datetime.now(UTC).isoformat(),
            "continuous": self.continuous,
            "interval_seconds": self.interval_seconds if self.continuous else None,
            "provider": self.provider,
            "model": self.model,
            "fallback_provider": self.fallback_provider,
            "allow_web": self.allow_web,
            "memory_tools_approved": self.allow_memory,
            "write_tools_approved": False,
            "desktop_tools_approved": False,
            "pid": os.getpid(),
        }
        write_json_atomic(self.heartbeat_file, payload)
        if self.ws_server:
            await self.ws_server.broadcast(payload)

    async def write_state(self) -> None:
        write_json_atomic(self.state_file, asdict(self.state))
        await self.heartbeat()

    def _stop_requested(self) -> bool:
        return self._stop_event.is_set() or self.stop_file.exists()

    async def _wait_interruptibly(self, seconds: int) -> None:
        deadline = time.monotonic() + seconds
        while not self._stop_requested() and time.monotonic() < deadline:
            remaining = max(0.0, deadline - time.monotonic())
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=min(60.0, remaining))
            except TimeoutError:
                await self.heartbeat()

    async def run(self) -> int:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        if self._another_instance_running():
            logger.error("Another daemon instance is already running")
            return 2

        self.stop_file.unlink(missing_ok=True)
        self.pid_file.write_text(str(os.getpid()))
        self.state.status = "starting"
        await self.write_state()

        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, self._stop_event.set)
            except NotImplementedError:
                pass

        logger.info(
            "Daemon starting: mode=%s, tasks/day=%d, tools/day=%d, tokens/day=%d",
            "continuous" if self.continuous else "one-shot",
            self.state.daily_task_limit,
            self.state.daily_tool_call_limit,
            self.state.daily_token_limit,
        )

        if self.ws_server:
            await self.ws_server.start()

        try:
            if not await self.health_check():
                self.state.status = "blocked"
                await self.write_state()
                return 1

            while not self._stop_requested():
                self._reset_daily_if_needed()
                if self._budget_exhausted():
                    self.state.status = "daily_budget_exhausted"
                    await self.write_state()
                    if not self.continuous:
                        break
                    await self._wait_interruptibly(300)
                    continue

                await self.run_research()
                if not self.continuous:
                    break
                await self._wait_interruptibly(self.interval_seconds)

            self.state.status = "stopped"
            return 0
        finally:
            self.state.current_task = None
            if self.state.status not in {"blocked", "daily_budget_exhausted"}:
                self.state.status = "stopped"
            await self.write_state()
            if self.ws_server:
                await self.ws_server.stop()
            self.pid_file.unlink(missing_ok=True)
            logger.info(
                "Daemon stopped: completed=%d, failed=%d, tokens=%d",
                self.state.tasks_completed_today,
                self.state.tasks_failed_today,
                self.state.tokens_used_today,
            )


def read_status(state_dir: Path) -> dict[str, Any]:
    heartbeat = state_dir.resolve() / "heartbeat.json"
    if not heartbeat.exists():
        return {"status": "not_started", "state_dir": str(state_dir.resolve())}
    try:
        payload = json.loads(heartbeat.read_text())
        return payload if isinstance(payload, dict) else {"status": "invalid"}
    except (OSError, json.JSONDecodeError):
        return {"status": "unreadable", "state_dir": str(state_dir.resolve())}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Bounded local ZoraOS research daemon")
    parser.add_argument("--api", default="http://127.0.0.1:8000", help="ZoraOS API base URL")
    parser.add_argument("--key", help="X-ZoraOS-Key; prefer ZORA_DAEMON_KEY")
    parser.add_argument("--goal", help="Exact research question (required to start)")
    parser.add_argument("--state-dir", type=Path, default=DEFAULT_STATE_DIR)
    parser.add_argument("--continuous", action="store_true", help="Repeat within daily limits")
    parser.add_argument("--interval-minutes", type=int, default=360)
    parser.add_argument("--allow-web", action="store_true", help="Approve web_search for tasks")
    parser.add_argument(
        "--no-memory",
        action="store_true",
        help="Disable memory_search, memory_read, and pdf_reader for this daemon",
    )
    parser.add_argument(
        "--provider",
        choices=("openrouter", "ollama"),
        default=os.environ.get("ZORA_DAEMON_PROVIDER", "openrouter"),
    )
    parser.add_argument(
        "--model",
        default=os.environ.get("ZORA_DAEMON_MODEL", "tencent/hy3"),
    )
    parser.add_argument(
        "--no-local-fallback",
        action="store_true",
        help="Do not retry an unavailable remote route with local Ollama",
    )
    parser.add_argument("--daily-tasks", type=int, default=3)
    parser.add_argument("--daily-tool-calls", type=int, default=12)
    parser.add_argument("--daily-tokens", type=int, default=12_000)
    parser.add_argument("--task-tool-calls", type=int, default=4)
    parser.add_argument("--task-iterations", type=int, default=3)
    parser.add_argument("--task-tokens", type=int, default=4_000)
    parser.add_argument("--task-wall-seconds", type=int, default=300)
    parser.add_argument("--stop", action="store_true", help="Request a running daemon to stop")
    parser.add_argument("--status", action="store_true", help="Print the last heartbeat and exit")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print limits only")
    parser.add_argument("--ws-port", type=int, default=8766, help="Daemon WebSocket port")
    parser.add_argument("--no-ws", action="store_true", help="Disable WebSocket server")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    state_dir = args.state_dir.resolve()

    if args.stop:
        state_dir.mkdir(parents=True, exist_ok=True)
        (state_dir / "stop").write_text(f"stop requested at {time.time()}")
        print(f"Stop requested via {state_dir / 'stop'}")
        return
    if args.status:
        print(json.dumps(read_status(state_dir), indent=2, sort_keys=True))
        return
    if not args.goal or not args.goal.strip():
        parser.error("--goal is required unless --stop or --status is used")

    daemon = ZoraDaemon(
        goal=args.goal,
        api_base=args.api,
        api_key=args.key or os.environ.get("ZORA_DAEMON_KEY"),
        state_dir=state_dir,
        continuous=args.continuous,
        interval_minutes=args.interval_minutes,
        allow_web=args.allow_web,
        allow_memory=not args.no_memory,
        provider=args.provider,
        model=args.model,
        fallback_provider=None if args.no_local_fallback else "ollama",
        daily_task_limit=args.daily_tasks,
        daily_tool_call_limit=args.daily_tool_calls,
        daily_token_limit=args.daily_tokens,
        task_tool_call_limit=args.task_tool_calls,
        task_iteration_limit=args.task_iterations,
        task_token_limit=args.task_tokens,
        task_wall_seconds=args.task_wall_seconds,
        ws_enabled=not args.no_ws,
        ws_port=args.ws_port,
    )

    if args.dry_run:
        print(
            json.dumps(
                {
                    "mode": "continuous" if daemon.continuous else "one-shot",
                    "provider": daemon.provider,
                    "model": daemon.model,
                    "fallback_provider": daemon.fallback_provider,
                    "goal": daemon.goal,
                    "allow_web": daemon.allow_web,
                    "allow_memory": daemon.allow_memory,
                    "daily_task_limit": daemon.state.daily_task_limit,
                    "daily_tool_call_limit": daemon.state.daily_tool_call_limit,
                    "daily_token_limit": daemon.state.daily_token_limit,
                    "task_budget": daemon._remaining_task_budget(),
                    "state_dir": str(daemon.state_dir),
                },
                indent=2,
                sort_keys=True,
            )
        )
        return

    raise SystemExit(asyncio.run(daemon.run()))


if __name__ == "__main__":
    main()
