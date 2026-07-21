from __future__ import annotations

import hashlib
import json
import time
from typing import Any
from uuid import uuid4

try:
    import asyncpg
except ImportError:
    asyncpg = None


class PgAuditLedger:
    """PostgreSQL-backed hash-chained audit ledger.

    Schema creates an 'audit_events' table with a SHA-256 hash chain.
    Each event links to its predecessor via previous_digest.
    The chain can be verified at any time by replaying the SELECT in order.
    """

    SCHEMA_SQL = """
    CREATE TABLE IF NOT EXISTS audit_events (
        sequence    BIGSERIAL UNIQUE,
        id          TEXT PRIMARY KEY,
        timestamp   DOUBLE PRECISION NOT NULL,
        task_id     TEXT,
        event_type  TEXT NOT NULL,
        payload     JSONB NOT NULL DEFAULT '{}',
        payload_digest TEXT NOT NULL,
        previous_digest TEXT NOT NULL DEFAULT '0'::text,
        digest      TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE audit_events
        ADD COLUMN IF NOT EXISTS sequence BIGSERIAL;

    CREATE INDEX IF NOT EXISTS idx_audit_events_task_id ON audit_events(task_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);
    """

    def __init__(self, dsn: str, pool_min: int = 1, pool_max: int = 5):
        if asyncpg is None:
            raise ImportError("asyncpg is required for PgAuditLedger")
        self._dsn = dsn
        self._pool_min = pool_min
        self._pool_max = pool_max
        self._pool = None

    async def connect(self) -> None:
        self._pool = await asyncpg.create_pool(
            dsn=self._dsn,
            min_size=self._pool_min,
            max_size=self._pool_max,
        )
        async with self._pool.acquire() as conn:
            await conn.execute(self.SCHEMA_SQL)

    async def close(self) -> None:
        if self._pool:
            await self._pool.close()

    def _require_pool(self):
        if self._pool is None:
            raise RuntimeError("PgAuditLedger.connect() must be called before use")
        return self._pool

    async def record(
        self,
        event_type: str,
        payload: dict[str, Any],
        task_id: str | None = None,
    ) -> dict[str, Any]:
        payload_bytes = json.dumps(payload, sort_keys=True, default=str).encode()
        payload_digest = hashlib.sha256(payload_bytes).hexdigest()

        pool = self._require_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                # Serialize writers so two simultaneous events cannot select the
                # same predecessor and fork the chain.
                await conn.execute("SELECT pg_advisory_xact_lock($1)", 2_667_267_641)
                row = await conn.fetchrow(
                    "SELECT digest FROM audit_events ORDER BY sequence DESC LIMIT 1"
                )
                previous_digest = row["digest"] if row else "0" * 64

                event_id = str(uuid4())
                ts = time.time()
                digest_input = (
                    f"{event_id}:{ts}:{task_id}:{event_type}:{payload_digest}:{previous_digest}"
                )
                digest = hashlib.sha256(digest_input.encode()).hexdigest()

                await conn.execute(
                    """
                    INSERT INTO audit_events
                        (id, timestamp, task_id, event_type, payload,
                         payload_digest, previous_digest, digest)
                    VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
                    """,
                    event_id,
                    ts,
                    task_id,
                    event_type,
                    json.dumps(payload, sort_keys=True, default=str),
                    payload_digest,
                    previous_digest,
                    digest,
                )

        return {
            "id": event_id,
            "timestamp": ts,
            "task_id": task_id,
            "event_type": event_type,
            "payload": payload,
            "payload_digest": payload_digest,
            "previous_digest": previous_digest,
            "digest": digest,
        }

    async def events_for_task(self, task_id: str) -> list[dict[str, Any]]:
        pool = self._require_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM audit_events WHERE task_id = $1 ORDER BY sequence",
                task_id,
            )
            return [dict(r) for r in rows]

    async def verify(self) -> bool:
        pool = self._require_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, timestamp, task_id, event_type, payload,
                       payload_digest, previous_digest, digest
                FROM audit_events
                ORDER BY sequence
                """
            )
        return self.verify_rows([dict(row) for row in rows])

    @staticmethod
    def verify_rows(rows: list[dict[str, Any]]) -> bool:
        previous_digest = "0" * 64
        for row in rows:
            payload = row["payload"]
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except json.JSONDecodeError:
                    return False
            payload_bytes = json.dumps(
                payload,
                sort_keys=True,
                default=str,
            ).encode()
            payload_digest = hashlib.sha256(payload_bytes).hexdigest()
            if row["payload_digest"] != payload_digest:
                return False
            if row["previous_digest"] != previous_digest:
                return False
            digest_input = (
                f"{row['id']}:{row['timestamp']}:{row['task_id']}:"
                f"{row['event_type']}:{row['payload_digest']}:{previous_digest}"
            )
            if row["digest"] != hashlib.sha256(digest_input.encode()).hexdigest():
                return False
            previous_digest = row["digest"]
        return True
