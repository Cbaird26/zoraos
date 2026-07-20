from __future__ import annotations

from typing import Any, Dict, List, Optional

from configs.settings import settings

from .base import Document, SearchResult
from .store import DocumentStore


class VectorStore:
    def __init__(self, document_store: DocumentStore):
        self._doc_store = document_store
        self._embedding_model: Optional[Any] = None

    async def _get_embedder(self):
        if self._embedding_model is None:
            from sentence_transformers import SentenceTransformer
            self._embedding_model = SentenceTransformer(
                settings.memory.embedding_model,
                trust_remote_code=True,
            )
        return self._embedding_model

    async def embed(self, texts: List[str]) -> List[List[float]]:
        embedder = await self._get_embedder()
        embeddings = embedder.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return [emb.tolist() for emb in embeddings]

    async def index_document(self, document: Document) -> str:
        if document.embedding is None:
            embeddings = await self.embed([document.content])
            document.embedding = embeddings[0]
        return await self._doc_store.insert(document)

    async def index_documents(self, documents: List[Document]) -> List[str]:
        texts = [d.content for d in documents if d.embedding is None]
        if texts:
            embeddings = await self.embed(texts)
            emb_idx = 0
            for doc in documents:
                if doc.embedding is None:
                    doc.embedding = embeddings[emb_idx]
                    emb_idx += 1
        return await self._doc_store.insert_batch(documents)

    async def search(
        self,
        query: str,
        collection: Optional[str] = None,
        top_k: int = 10,
    ) -> List[SearchResult]:
        query_emb = (await self.embed([query]))[0]
        return await self._doc_store.semantic_search(
            query_embedding=query_emb,
            collection=collection,
            top_k=top_k,
        )
