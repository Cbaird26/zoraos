#!/usr/bin/env python3
"""Shared memory pipeline between pet bridge and daemon."""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

SHARED_MEMORY_DIR = Path("data/shared_memory")


def ensure_dir() -> Path:
    SHARED_MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    return SHARED_MEMORY_DIR


def write_pet_context(episode: dict[str, Any]) -> Path:
    """Write a pet conversation episode to shared memory for the daemon to consume."""
    d = ensure_dir()
    episode.update({
        "written_at": datetime.now(UTC).isoformat(),
        "written_at_epoch": time.time(),
    })
    path = d / f"pet_episode_{int(time.time())}.json"
    path.write_text(json.dumps(episode, indent=2, sort_keys=True))
    # Clean old files
    paths = sorted(d.glob("pet_episode_*.json"))
    for old in paths[:-50]:
        old.unlink(missing_ok=True)
    return path


def read_pet_context(limit: int = 5) -> list[dict[str, Any]]:
    """Read recent pet conversation episodes for daemon context injection."""
    d = ensure_dir()
    paths = sorted(d.glob("pet_episode_*.json"), reverse=True)[:limit]
    episodes = []
    for p in paths:
        try:
            episodes.append(json.loads(p.read_text()))
        except (json.JSONDecodeError, OSError):
            pass
    return episodes


def write_daemon_finding(finding: dict[str, Any]) -> Path:
    """Write a daemon research finding to shared memory for pet to reference."""
    d = ensure_dir()
    finding.update({
        "written_at": datetime.now(UTC).isoformat(),
        "written_at_epoch": time.time(),
    })
    path = d / f"daemon_finding_{int(time.time())}.json"
    path.write_text(json.dumps(finding, indent=2, sort_keys=True))
    paths = sorted(d.glob("daemon_finding_*.json"))
    for old in paths[:-50]:
        old.unlink(missing_ok=True)
    return path


def read_daemon_findings(limit: int = 5) -> list[dict[str, Any]]:
    """Read recent daemon findings for pet to reference in conversations."""
    d = ensure_dir()
    paths = sorted(d.glob("daemon_finding_*.json"), reverse=True)[:limit]
    findings = []
    for p in paths:
        try:
            findings.append(json.loads(p.read_text()))
        except (json.JSONDecodeError, OSError):
            pass
    return findings


def recent_context_summary(limit: int = 3) -> str:
    """Generate a text summary of recent pet ↔ daemon activity."""
    pets = read_pet_context(limit)
    findings = read_daemon_findings(limit)
    lines = []
    if pets:
        lines.append("Recent pet conversations:")
        for ep in pets:
            msg = ep.get("message", "")[:120]
            lines.append(f"  - {ep.get('written_at','?')}: {msg}")
    if findings:
        lines.append("Recent daemon findings:")
        for f in findings:
            summary = f.get("summary", f.get("goal", ""))[:120]
            lines.append(f"  - {f.get('written_at','?')}: {summary}")
    return "\n".join(lines) if lines else "No shared memory yet."
