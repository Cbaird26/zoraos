from __future__ import annotations

from typing import Any

from memory.store import DocumentStore
from memory.vector import VectorStore
from memory.base import Document

from tools.base import Tool, ToolResult


class MemoryWriteTool(Tool):
    name = "memory_write"
    description = "Store a document into ZoraOS long-term memory"
    parameters = {
        "type": "object",
        "properties": {
            "content": {"type": "string", "description": "Document content to store"},
            "collection": {"type": "string", "description": "Memory collection (e.g., research, physics, ai, projects)"},
            "title": {"type": "string", "description": "Optional title"},
            "source": {"type": "string", "description": "Optional source URL or reference"},
            "metadata": {"type": "object", "description": "Additional metadata", "default": {}},
        },
        "required": ["content", "collection"],
    }

    def __init__(self, vector_store: VectorStore):
        self._vector_store = vector_store

    async def execute(self, content: str, collection: str, title: str | None = None, source: str | None = None, metadata: dict | None = None, **kwargs: Any) -> ToolResult:
        try:
            doc = Document(
                collection=collection,
                title=title,
                source=source,
                content=content,
                metadata=metadata or {},
            )
            doc_id = await self._vector_store.index_document(doc)
            return ToolResult(success=True, output={"id": doc_id, "collection": collection})
        except Exception as e:
            return ToolResult(success=False, error=f"Memory write error: {e}")


class MemoryReadTool(Tool):
    name = "memory_read"
    description = "Retrieve a document from long-term memory by ID"
    parameters = {
        "type": "object",
        "properties": {
            "id": {"type": "string", "description": "Document ID to retrieve"},
        },
        "required": ["id"],
    }

    def __init__(self, document_store: DocumentStore):
        self._doc_store = document_store

    async def execute(self, id: str, **kwargs: Any) -> ToolResult:
        try:
            doc = await self._doc_store.get_by_id(id)
            if not doc:
                return ToolResult(success=False, error=f"Document not found: {id}")
            return ToolResult(success=True, output={"id": doc.id, "collection": doc.collection, "title": doc.title, "source": doc.source, "content": doc.content[:5000], "metadata": doc.metadata})
        except Exception as e:
            return ToolResult(success=False, error=f"Memory read error: {e}")


class MemorySearchTool(Tool):
    name = "memory_search"
    description = "Semantic search across ZoraOS long-term memory"
    parameters = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query"},
            "collection": {"type": "string", "description": "Optional collection filter"},
            "top_k": {"type": "integer", "description": "Number of results", "default": 5},
        },
        "required": ["query"],
    }

    def __init__(self, vector_store: VectorStore):
        self._vector_store = vector_store

    async def execute(self, query: str, collection: str | None = None, top_k: int = 5, **kwargs: Any) -> ToolResult:
        try:
            results = await self._vector_store.search(query, collection=collection, top_k=top_k)
            output = [
                {
                    "id": r.document.id,
                    "title": r.document.title,
                    "collection": r.document.collection,
                    "score": round(r.score, 4),
                    "snippet": r.snippet,
                }
                for r in results
            ]
            return ToolResult(success=True, output={"results": output, "count": len(output)})
        except Exception as e:
            return ToolResult(success=False, error=f"Memory search error: {e}")
