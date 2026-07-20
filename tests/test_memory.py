"""Tests for the memory layer."""

import pytest

from memory.base import Document, SearchResult, KnowledgeTriple


class TestDocument:
    def test_create_document(self):
        doc = Document(
            collection="physics",
            title="Test Paper",
            content="This is test content",
            metadata={"author": "Test"},
        )
        assert doc.collection == "physics"
        assert doc.title == "Test Paper"
        assert doc.content == "This is test content"
        assert doc.id is not None

    def test_default_collection(self):
        doc = Document(content="test")
        assert doc.collection == "default"


class TestSearchResult:
    def test_create_result(self):
        doc = Document(content="test")
        result = SearchResult(document=doc, score=0.95)
        assert result.score == 0.95
        assert result.document == doc
        assert result.snippet is None


class TestKnowledgeTriple:
    def test_create_triple(self):
        triple = KnowledgeTriple(
            subject="Quantum Gravity",
            predicate="is_a",
            obj="Theory",
            weight=1.0,
        )
        assert triple.subject == "Quantum Gravity"
        assert triple.predicate == "is_a"
        assert triple.obj == "Theory"
