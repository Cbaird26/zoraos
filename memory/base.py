from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4


@dataclass
class Document:
    id: str = field(default_factory=lambda: str(uuid4()))
    collection: str = "default"
    title: Optional[str] = None
    source: Optional[str] = None
    content: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[List[float]] = None
    token_count: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class SearchResult:
    document: Document
    score: float
    snippet: Optional[str] = None


@dataclass
class KnowledgeTriple:
    subject: str
    predicate: str
    obj: str
    weight: float = 1.0
    source: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
