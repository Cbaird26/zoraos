#!/usr/bin/env python3
"""
ZoraOS Persistent Bounded Queue Runner.

Usage:
    python scripts/agent_runner.py --agent research --goal "Summarize latest papers"
    python scripts/agent_runner.py --daemon           # Continuous goal queue mode
    python scripts/agent_runner.py --file goals.json    # Batch goals from file

Safety:
    - Kill switch: touch /tmp/zoraos_kill
    - 30-minute HTTP client timeout per goal (not a server-side cancellation guarantee)
    - Every action logged with timestamp
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("zoraos.agent_runner")

KILL_SWITCH_PATH = "/tmp/zoraos_kill"
MAX_WALL_CLOCK_SECONDS = 30 * 60
LOG_DIR = Path("logs")


class AgentRunner:
    def __init__(self, api_base: str = "http://localhost:8000/api/v1"):
        self.api_base = api_base
        self._running = True
        self._active_tasks: dict[str, float] = {}
        self._setup_logging()

    def _setup_logging(self) -> None:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        date_str = datetime.now(UTC).strftime("%Y%m%d")
        fh = logging.FileHandler(LOG_DIR / f"agent_runner_{date_str}.log")
        fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
        logger.addHandler(fh)

    def _kill_switch_triggered(self) -> bool:
        if os.path.exists(KILL_SWITCH_PATH):
            logger.warning("Kill switch detected at %s — shutting down", KILL_SWITCH_PATH)
            return True
        return False

    async def run_single(
        self,
        agent: str,
        goal: str,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        import httpx

        logger.info("Running agent=%s goal=%s", agent, goal[:100])
        payload: dict[str, Any] = {"agent": agent, "goal": goal}
        if context:
            payload["context"] = context

        start = time.monotonic()
        async with httpx.AsyncClient(timeout=MAX_WALL_CLOCK_SECONDS) as client:
            response = await client.post(
                f"{self.api_base}/agents/run",
                json=payload,
            )
            response.raise_for_status()
            result = response.json()

        elapsed = time.monotonic() - start
        logger.info(
            "Agent %s completed in %.1fs — success=%s",
            agent,
            elapsed,
            result.get("result", {}).get("success", False),
        )
        return result

    async def run_daemon(self, initial_goals: list[dict[str, Any]] | None = None) -> None:
        logger.info("Agent runner daemon started")
        queue: list[dict[str, Any]] = initial_goals or []
        while self._running:
            if self._kill_switch_triggered():
                break

            if queue:
                item = queue.pop(0)
                try:
                    result = await self.run_single(item["agent"], item["goal"])
                    logger.info("Result: %s", json.dumps(result, default=str)[:500])
                except Exception as e:
                    logger.error("Failed: %s", e)
            else:
                await asyncio.sleep(10)

        logger.info("Agent runner daemon stopped")

    def stop(self) -> None:
        self._running = False


async def main():
    parser = argparse.ArgumentParser(description="ZoraOS bounded agent queue runner")
    parser.add_argument(
        "--agent",
        default="research",
        help="Agent type (research, developer, writer, knowledge)",
    )
    parser.add_argument("--goal", help="Single goal to run")
    parser.add_argument("--file", help="JSON file with goals array")
    parser.add_argument("--daemon", action="store_true", help="Run as persistent daemon")
    parser.add_argument(
        "--api-base",
        default="http://localhost:8000/api/v1",
        help="ZoraOS API base URL",
    )
    args = parser.parse_args()

    runner = AgentRunner(api_base=args.api_base)

    if args.daemon:
        initial = []
        if args.file:
            with open(args.file) as f:
                initial = json.load(f)
        if args.goal:
            initial.append({"agent": args.agent, "goal": args.goal})
        await runner.run_daemon(initial)
    elif args.goal:
        result = await runner.run_single(args.agent, args.goal)
        print(json.dumps(result, indent=2, default=str))
    elif args.file:
        with open(args.file) as f:
            goals = json.load(f)
        for item in goals:
            result = await runner.run_single(item.get("agent", args.agent), item["goal"])
            print(json.dumps(result, indent=2, default=str))
    else:
        parser.print_help()


if __name__ == "__main__":
    asyncio.run(main())
