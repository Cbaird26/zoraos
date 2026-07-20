from __future__ import annotations

from typing import Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from configs.settings import settings

from .base import KnowledgeTriple


class KnowledgeGraph:
    def __init__(self):
        self._engine = create_async_engine(settings.database_url, echo=False, pool_size=5)
        self._session_factory = async_sessionmaker(self._engine, class_=AsyncSession, expire_on_commit=False)

    async def insert(self, triple: KnowledgeTriple) -> str:
        async with self._session_factory() as session:
            result = await session.execute(
                text("""
                    INSERT INTO knowledge_graph (concept, relation, target_concept, weight, metadata)
                    VALUES (:concept, :relation, :target, :weight, :metadata)
                    RETURNING id
                """),
                {
                    "concept": triple.subject,
                    "relation": triple.predicate,
                    "target": triple.obj,
                    "weight": triple.weight,
                    "metadata": triple.metadata,
                },
            )
            await session.commit()
            return result.scalar_one()

    async def insert_batch(self, triples: List[KnowledgeTriple]) -> List[str]:
        ids = []
        async with self._session_factory() as session:
            for t in triples:
                result = await session.execute(
                    text("""
                        INSERT INTO knowledge_graph (concept, relation, target_concept, weight, metadata)
                        VALUES (:concept, :relation, :target, :weight, :metadata)
                        RETURNING id
                    """),
                    {
                        "concept": t.subject,
                        "relation": t.predicate,
                        "target": t.obj,
                        "weight": t.weight,
                        "metadata": t.metadata,
                    },
                )
                ids.append(result.scalar_one())
            await session.commit()
        return ids

    async def query(self, concept: str, relation: Optional[str] = None) -> List[KnowledgeTriple]:
        query = "SELECT concept, relation, target_concept, weight, metadata FROM knowledge_graph WHERE concept = :concept"
        params: Dict = {"concept": concept}
        if relation:
            query += " AND relation = :relation"
            params["relation"] = relation
        query += " ORDER BY weight DESC"

        async with self._session_factory() as session:
            result = await session.execute(text(query), params)
            rows = result.fetchall()

        return [
            KnowledgeTriple(
                subject=row[0], predicate=row[1], obj=row[2],
                weight=row[3], metadata=row[4],
            )
            for row in rows
        ]

    async def traverse(self, concept: str, max_depth: int = 2) -> List[KnowledgeTriple]:
        seen = {concept}
        results = []
        current = [concept]

        for _ in range(max_depth):
            if not current:
                break
            placeholders = ",".join(f"'{c}'" for c in current)
            async with self._session_factory() as session:
                result = await session.execute(
                    text(f"""
                        SELECT concept, relation, target_concept, weight, metadata
                        FROM knowledge_graph
                        WHERE concept IN ({placeholders})
                           OR target_concept IN ({placeholders})
                    """)
                )
                rows = result.fetchall()

            current = []
            for row in rows:
                triple = KnowledgeTriple(
                    subject=row[0], predicate=row[1], obj=row[2],
                    weight=row[3], metadata=row[4],
                )
                results.append(triple)
                for node in (row[0], row[2]):
                    if node not in seen:
                        seen.add(node)
                        current.append(node)

        return results

    async def delete_by_concept(self, concept: str) -> int:
        async with self._session_factory() as session:
            result = await session.execute(
                text("DELETE FROM knowledge_graph WHERE concept = :concept OR target_concept = :concept"),
                {"concept": concept},
            )
            await session.commit()
            return result.rowcount
