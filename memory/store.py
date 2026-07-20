from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from configs.settings import settings

from .base import Document, SearchResult


class DocumentStore:
    def __init__(self, database_url: Optional[str] = None):
        self._url = database_url or settings.database_url
        self._engine = create_async_engine(self._url, echo=False, pool_size=10, max_overflow=20)
        self._session_factory = async_sessionmaker(self._engine, class_=AsyncSession, expire_on_commit=False)

    async def insert(self, document: Document) -> str:
        content_hash = hashlib.sha256(document.content.encode()).hexdigest()
        async with self._session_factory() as session:
            result = await session.execute(
                text("""
                    INSERT INTO documents (id, collection, title, source, content, metadata, token_count, embedding)
                    VALUES (:id, :collection, :title, :source, :content, :metadata, :token_count, :embedding)
                    ON CONFLICT (id) DO UPDATE SET
                        content = EXCLUDED.content,
                        metadata = EXCLUDED.metadata,
                        updated_at = NOW()
                    RETURNING id
                """),
                {
                    "id": document.id,
                    "collection": document.collection,
                    "title": document.title,
                    "source": document.source,
                    "content": document.content.replace("\x00", ""),
                    "metadata": json.dumps(document.metadata),
                    "token_count": document.token_count,
                    "embedding": str(document.embedding) if document.embedding is not None else None,
                },
            )
            await session.commit()
            return result.scalar_one()

    async def insert_batch(self, documents: List[Document]) -> List[str]:
        ids = []
        async with self._session_factory() as session:
            for doc in documents:
                content_hash = hashlib.sha256(doc.content.encode()).hexdigest()
                result = await session.execute(
                    text("""
                        INSERT INTO documents (id, collection, title, source, content, metadata, token_count, embedding)
                        VALUES (:id, :collection, :title, :source, :content, :metadata, :token_count, :embedding)
                        ON CONFLICT (id) DO UPDATE SET
                            content = EXCLUDED.content,
                            metadata = EXCLUDED.metadata,
                            updated_at = NOW()
                        RETURNING id
                    """),
                    {
                        "id": doc.id,
                        "collection": doc.collection,
                        "title": doc.title,
                        "source": doc.source,
                        "content": doc.content.replace("\x00", ""),
                        "metadata": json.dumps(doc.metadata),
                        "token_count": doc.token_count,
                        "embedding": str(doc.embedding) if doc.embedding is not None else None,
                    },
                )
                ids.append(result.scalar_one())
            await session.commit()
        return ids

    async def semantic_search(
        self,
        query_embedding: List[float],
        collection: Optional[str] = None,
        top_k: int = 10,
        min_score: float = 0.0,
    ) -> List[SearchResult]:
        embedding_str = f"[{','.join(str(v) for v in query_embedding)}]"
        collection_filter = "AND collection = :collection" if collection else ""

        async with self._session_factory() as session:
            result = await session.execute(
                text(f"""
                    SELECT id, collection, title, source, content, metadata, token_count,
                           1 - (embedding <=> :embedding) AS score
                    FROM documents
                    WHERE embedding IS NOT NULL {collection_filter}
                      AND 1 - (embedding <=> :embedding) > :min_score
                    ORDER BY embedding <=> :embedding
                    LIMIT :top_k
                """),
                {
                    "embedding": embedding_str,
                    "collection": collection,
                    "top_k": top_k,
                    "min_score": min_score,
                },
            )
            rows = result.fetchall()

        results = []
        for row in rows:
            raw_meta = row[5]
            if isinstance(raw_meta, str):
                raw_meta = json.loads(raw_meta)
            doc = Document(
                id=row[0],
                collection=row[1],
                title=row[2],
                source=row[3],
                content=row[4],
                metadata=raw_meta if isinstance(raw_meta, dict) else {},
                token_count=row[6],
            )
            score = float(row[7])
            snippet = doc.content[:300] if doc.content else None
            results.append(SearchResult(document=doc, score=score, snippet=snippet))
        return results

    async def get_by_id(self, doc_id: str) -> Optional[Document]:
        async with self._session_factory() as session:
            result = await session.execute(
                text("SELECT id, collection, title, source, content, metadata, token_count, created_at, updated_at FROM documents WHERE id = :id"),
                {"id": doc_id},
            )
            row = result.fetchone()
        if not row:
            return None
        raw_meta = row[5]
        if isinstance(raw_meta, str):
            raw_meta = json.loads(raw_meta)
        return Document(
            id=row[0], collection=row[1], title=row[2], source=row[3],
            content=row[4], metadata=raw_meta if isinstance(raw_meta, dict) else {}, token_count=row[6],
        )

    async def delete(self, doc_id: str) -> bool:
        async with self._session_factory() as session:
            result = await session.execute(
                text("DELETE FROM documents WHERE id = :id RETURNING id"),
                {"id": doc_id},
            )
            await session.commit()
            return result.fetchone() is not None

    async def count(self, collection: Optional[str] = None) -> int:
        query = "SELECT COUNT(*) FROM documents"
        params = {}
        if collection:
            query += " WHERE collection = :collection"
            params["collection"] = collection
        async with self._session_factory() as session:
            result = await session.execute(text(query), params)
            return result.scalar() or 0

    async def list_collections(self) -> List[str]:
        async with self._session_factory() as session:
            result = await session.execute(
                text("SELECT DISTINCT collection FROM documents ORDER BY collection")
            )
            return [row[0] for row in result.fetchall()]
