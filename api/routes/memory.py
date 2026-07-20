from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..dependencies import get_vector_store, get_document_store
from memory.vector import VectorStore
from memory.store import DocumentStore

router = APIRouter()


class MemoryWriteRequest(BaseModel):
    content: str
    collection: str = "default"
    title: Optional[str] = None
    source: Optional[str] = None
    metadata: Dict[str, Any] = {}


@router.post("/memory/write")
async def memory_write(request: MemoryWriteRequest, vector_store: VectorStore = Depends(get_vector_store)):
    from memory.base import Document
    try:
        doc = Document(
            collection=request.collection,
            title=request.title,
            source=request.source,
            content=request.content,
            metadata=request.metadata,
        )
        doc_id = await vector_store.index_document(doc)
        return {"id": doc_id, "collection": request.collection}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/memory/search")
async def memory_search(
    query: str = Query(..., description="Search query"),
    collection: Optional[str] = None,
    top_k: int = 5,
    vector_store: VectorStore = Depends(get_vector_store),
):
    try:
        results = await vector_store.search(query, collection=collection, top_k=top_k)
        return {
            "results": [
                {
                    "id": r.document.id,
                    "title": r.document.title,
                    "collection": r.document.collection,
                    "score": round(r.score, 4),
                    "snippet": r.snippet,
                }
                for r in results
            ],
            "count": len(results),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/memory/{doc_id}")
async def memory_get(doc_id: str, document_store: DocumentStore = Depends(get_document_store)):
    doc = await document_store.get_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": doc.id,
        "collection": doc.collection,
        "title": doc.title,
        "source": doc.source,
        "content": doc.content[:5000],
        "metadata": doc.metadata,
    }


@router.get("/memory")
async def memory_list(document_store: DocumentStore = Depends(get_document_store)):
    try:
        collections = await document_store.list_collections()
        counts = {}
        for c in collections:
            counts[c] = await document_store.count(c)
        return {"collections": collections, "counts": counts, "status": "connected"}
    except Exception as e:
        return {
            "collections": [],
            "counts": {},
            "status": "disconnected",
            "note": "PostgreSQL not running. Start with: docker compose up -d postgres",
            "detail": str(e),
        }
