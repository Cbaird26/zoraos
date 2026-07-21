from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass
class Document:
    id: str = field(default_factory=lambda: str(uuid4()))
    collection: str = "default"
    title: str | None = None
    source: str | None = None
    content: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    embedding: list[float] | None = None
    token_count: int = 0
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)


@dataclass
class SearchResult:
    document: Document
    score: float
    snippet: str | None = None


@dataclass
class KnowledgeTriple:
    subject: str
    predicate: str
    obj: str
    weight: float = 1.0
    source: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
