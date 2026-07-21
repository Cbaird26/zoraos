"""Tests for the router engine."""

import pytest

from router.engine import RouterEngine


class TestRouterEngine:
    @pytest.mark.asyncio
    async def test_route_research(self):
        router = RouterEngine()
        decision = await router.route("Research quantum gravity papers", ["deepseek", "ollama"])
        assert decision.provider == "deepseek"

    @pytest.mark.asyncio
    async def test_route_coding(self):
        router = RouterEngine()
        decision = await router.route("Write Python code for data analysis", ["kimi", "ollama"])
        assert decision.provider == "kimi"

    @pytest.mark.asyncio
    async def test_route_fallback(self):
        router = RouterEngine()
        decision = await router.route("Hello world", ["ollama"])
        assert decision.provider == "ollama"

    @pytest.mark.asyncio
    async def test_route_writing(self):
        router = RouterEngine()
        decision = await router.route("Write a paper on quantum mechanics", ["anthropic", "ollama"])
        assert decision.provider == "anthropic"

    def test_model_for_explicit_local_provider(self):
        router = RouterEngine()
        assert router.model_for_provider("ollama") == "zora:core"

    def test_update_task_map(self):
        router = RouterEngine()
        router.update_task_map("research", "kimi")
        assert router._task_provider_map["research"] == "kimi"
