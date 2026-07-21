from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("zoraos.scheduler")


class SchedulerRunner:
    def __init__(self):
        self._tasks: dict[str, dict[str, Any]] = {}
        self._running = False

    def register_workflow(
        self, name: str, cron_expression: str, agent: str, workflow: dict[str, Any]
    ) -> None:
        self._tasks[name] = {
            "cron": cron_expression,
            "agent": agent,
            "workflow": workflow,
            "enabled": True,
            "last_run": None,
        }

    async def start(self) -> None:
        self._running = True
        logger.info("Scheduler started")

    async def stop(self) -> None:
        self._running = False
        logger.info("Scheduler stopped")

    async def run_pending(self) -> list[dict[str, Any]]:
        """Report registered workflows without pretending to execute them.

        Cron parsing and gateway dispatch are not implemented yet. Returning a skipped
        result keeps monitoring honest and prevents a placeholder scheduler from being
        mistaken for continuous research.
        """

        results = []
        for name, task in self._tasks.items():
            if not task["enabled"]:
                continue
            results.append(
                {
                    "task": name,
                    "status": "skipped",
                    "reason": "scheduler execution is not implemented",
                }
            )
        return results

    def list_schedules(self) -> list[dict[str, Any]]:
        return [
            {
                "name": name,
                "cron": task["cron"],
                "agent": task["agent"],
                "enabled": task["enabled"],
                "last_run": task["last_run"],
            }
            for name, task in self._tasks.items()
        ]


runner = SchedulerRunner()
