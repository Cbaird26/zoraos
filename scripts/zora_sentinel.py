#!/usr/bin/env python3
"""Local-only ZoraASI security sentinel.

This monitor observes local logs and service health.  It never executes remediation,
opens network connections, reads user documents, sends messages, or changes settings.
Alerts are written locally to data/sentinel for operator review.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = ROOT / "data" / "sentinel"
DAEMON_HEARTBEAT = ROOT / "data" / "daemon" / "heartbeat.json"
DAEMON_LOG = ROOT / "data" / "daemon" / "daemon.log"
STOP_FILE = STATE_DIR / "stop"


def stamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def append_alert(kind: str, detail: str) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"timestamp": stamp(), "kind": kind, "detail": detail}
    with (STATE_DIR / "alerts.jsonl").open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, sort_keys=True) + "\n")


def daemon_health() -> dict[str, object]:
    if not DAEMON_HEARTBEAT.exists():
        return {"status": "missing", "detail": "daemon heartbeat is absent"}
    try:
        heartbeat = json.loads(DAEMON_HEARTBEAT.read_text())
    except (OSError, json.JSONDecodeError):
        return {"status": "invalid", "detail": "daemon heartbeat is unreadable"}
    age = time.time() - float(heartbeat.get("last_heartbeat", 0))
    if age > 1_200:
        return {"status": "stale", "detail": f"daemon heartbeat is {round(age)} seconds old"}
    if heartbeat.get("last_error"):
        return {"status": "degraded", "detail": str(heartbeat["last_error"])}
    return {"status": "ok", "detail": "daemon heartbeat is current"}


def recent_security_events() -> list[str]:
    """Read a narrow, local-only slice of security-relevant macOS events."""
    predicate = 'process == "sshd" OR process == "sudo" OR process == "securityd"'
    try:
        result = subprocess.run(
            ["/usr/bin/log", "show", "--last", "2m", "--style", "syslog", "--predicate", predicate],
            capture_output=True,
            check=False,
            text=True,
            timeout=25,
        )
    except (OSError, subprocess.TimeoutExpired):
        return []
    return [line[-500:] for line in result.stdout.splitlines() if line.strip()][-40:]


def write_state(health: dict[str, object], security_events: int) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    (STATE_DIR / "state.json").write_text(json.dumps({
        "timestamp": stamp(),
        "mode": "observe_only",
        "daemon": health,
        "security_events_seen": security_events,
        "sources": ["macOS unified log (sshd, sudo, securityd)", "Zora daemon heartbeat", "Zora daemon log"],
    }, indent=2, sort_keys=True))


def run_once() -> None:
    health = daemon_health()
    if health["status"] != "ok":
        append_alert(f"daemon_{health['status']}", str(health["detail"]))
    events = recent_security_events()
    if events:
        append_alert("system_events_observed", f"{len(events)} local security events observed")
    write_state(health, len(events))


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the local-only ZoraASI sentinel")
    parser.add_argument("--interval", type=int, default=300)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    interval = max(60, min(args.interval, 3_600))
    STOP_FILE.unlink(missing_ok=True)
    while True:
        run_once()
        if args.once or STOP_FILE.exists():
            return
        time.sleep(interval)


if __name__ == "__main__":
    main()
