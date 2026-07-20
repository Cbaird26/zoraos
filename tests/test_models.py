"""Tests for the model provider abstraction layer."""

import pytest

from models.base import Message, MessageRole, ModelRequest, ModelResponse, ProviderCapabilities
from models.registry import ProviderRegistry


class TestMessage:
    def test_create_user_message(self):
        msg = Message(role=MessageRole.USER, content="Hello")
        assert msg.role == MessageRole.USER
        assert msg.content == "Hello"

    def test_create_system_message(self):
        msg = Message(role=MessageRole.SYSTEM, content="You are a helpful assistant")
        assert msg.role == MessageRole.SYSTEM


class TestModelRequest:
    def test_create_request(self):
        msgs = [Message(role=MessageRole.USER, content="Hi")]
        request = ModelRequest(messages=msgs, temperature=0.5)
        assert len(request.messages) == 1
        assert request.temperature == 0.5

    def test_default_values(self):
        request = ModelRequest(messages=[])
        assert request.temperature == 0.7
        assert request.max_tokens == 4096
        assert request.stream is False
        assert request.tools is None


class TestModelResponse:
    def test_create_response(self):
        response = ModelResponse(
            content="Hello!",
            model="gpt-4o",
            provider="openai",
        )
        assert response.content == "Hello!"
        assert response.model == "gpt-4o"
        assert response.provider == "openai"


class TestProviderRegistry:
    def test_register_and_get(self):
        class FakeProvider:
            name = "test"
            pass

        ProviderRegistry.register("test_provider", FakeProvider)
        cls = ProviderRegistry.get("test_provider")
        assert cls == FakeProvider
        ProviderRegistry.unregister("test_provider")

    def test_get_nonexistent(self):
        with pytest.raises(Exception):
            ProviderRegistry.get("does_not_exist")

    def test_list_providers(self):
        providers = ProviderRegistry.list_providers()
        assert isinstance(providers, list)
