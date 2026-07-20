from __future__ import annotations

import hashlib
import json
import time
from dataclasses import asdict, dataclass
from typing import Any
from uuid import uuid4


@dataclass(frozen=True)
class AuditEvent:
    id: str
    timestamp: float
    task_id: str | None
    event_type: str
    payload_digest: str
    previous_digest: str
    digest: str


class AuditLedger:
    """In-memory, hash-chained task events suitable for later durable storage."""

    def __init__(self) -> None:
        self._events: list[AuditEvent] = []

    def record(
        self,
        event_type: str,
        payload: dict[str, Any],
        task_id: str | None = None,
    ) -> AuditEvent:
        payload_bytes = json.dumps(payload, sort_keys=True, default=str).encode()
        payload_digest = hashlib.sha256(payload_bytes).hexdigest()
        previous_digest = self._events[-1].digest if self._events else "0" * 64
        timestamp = time.time()
        event_id = str(uuid4())
        digest_input = (
            f"{event_id}:{timestamp}:{task_id}:{event_type}:"
            f"{payload_digest}:{previous_digest}"
        )
        digest = hashlib.sha256(digest_input.encode()).hexdigest()
        event = AuditEvent(
            id=event_id,
            timestamp=timestamp,
            task_id=task_id,
            event_type=event_type,
            payload_digest=payload_digest,
            previous_digest=previous_digest,
            digest=digest,
        )
        self._events.append(event)
        return event

    def events_for_task(self, task_id: str) -> list[dict[str, Any]]:
        return [asdict(event) for event in self._events if event.task_id == task_id]

    def verify(self) -> bool:
        previous_digest = "0" * 64
        for event in self._events:
            digest_input = (
                f"{event.id}:{event.timestamp}:{event.task_id}:{event.event_type}:"
                f"{event.payload_digest}:{previous_digest}"
            )
            if event.previous_digest != previous_digest:
                return False
            if event.digest != hashlib.sha256(digest_input.encode()).hexdigest():
                return False
            previous_digest = event.digest
        return True
