from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger("zoraos.scheduler")


class SchedulerRunner:
    def __init__(self):
        self._tasks: Dict[str, Dict[str, Any]] = {}
        self._running = False

    def register_workflow(self, name: str, cron_expression: str, agent: str, workflow: Dict[str, Any]) -> None:
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

    async def run_pending(self) -> List[Dict[str, Any]]:
        results = []
        for name, task in self._tasks.items():
            if not task["enabled"]:
                continue
            try:
                result = {"task": name, "status": "completed"}
                task["last_run"] = datetime.utcnow().isoformat()
                results.append(result)
            except Exception as e:
                results.append({"task": name, "status": "failed", "error": str(e)})
        return results

    def list_schedules(self) -> List[Dict[str, Any]]:
        return [
            {"name": name, "cron": task["cron"], "agent": task["agent"], "enabled": task["enabled"], "last_run": task["last_run"]}
            for name, task in self._tasks.items()
        ]


runner = SchedulerRunner()
