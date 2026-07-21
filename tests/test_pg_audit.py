"""Pure verification tests for the PostgreSQL audit-chain implementation."""

import hashlib
import json

from governance.pg_audit import PgAuditLedger


def make_row(
    event_id: str,
    timestamp: float,
    task_id: str,
    event_type: str,
    payload: dict,
    previous_digest: str,
) -> dict:
    payload_digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    digest_input = (
        f"{event_id}:{timestamp}:{task_id}:{event_type}:{payload_digest}:{previous_digest}"
    )
    return {
        "id": event_id,
        "timestamp": timestamp,
        "task_id": task_id,
        "event_type": event_type,
        "payload": payload,
        "payload_digest": payload_digest,
        "previous_digest": previous_digest,
        "digest": hashlib.sha256(digest_input.encode()).hexdigest(),
    }


def test_verify_rows_accepts_valid_chain_and_rejects_tampering() -> None:
    first = make_row("one", 1.0, "task", "started", {"ok": True}, "0" * 64)
    second = make_row("two", 2.0, "task", "finished", {"ok": True}, first["digest"])

    assert PgAuditLedger.verify_rows([first, second])

    database_shaped = dict(second)
    database_shaped["payload"] = json.dumps(second["payload"], sort_keys=True)
    assert PgAuditLedger.verify_rows([first, database_shaped])

    tampered = dict(second)
    tampered["payload"] = {"ok": False}
    assert not PgAuditLedger.verify_rows([first, tampered])
