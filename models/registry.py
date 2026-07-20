from __future__ import annotations

from typing import Any, Dict, Optional, Type

from .base import ModelProvider


class RegistryError(Exception):
    pass


class ProviderRegistry:
    _providers: Dict[str, Type[ModelProvider]] = {}

    @classmethod
    def register(cls, name: str, provider_cls: Type[ModelProvider]) -> None:
        if name in cls._providers:
            raise RegistryError(f"Provider '{name}' already registered")
        cls._providers[name] = provider_cls

    @classmethod
    def get(cls, name: str) -> Type[ModelProvider]:
        if name not in cls._providers:
            raise RegistryError(f"Provider '{name}' not found. Available: {list(cls._providers.keys())}")
        return cls._providers[name]

    @classmethod
    def create(cls, name: str, config: Dict[str, Any]) -> ModelProvider:
        provider_cls = cls.get(name)
        return provider_cls.from_config(config)

    @classmethod
    def list_providers(cls) -> list[str]:
        return list(cls._providers.keys())

    @classmethod
    def unregister(cls, name: str) -> None:
        cls._providers.pop(name, None)
