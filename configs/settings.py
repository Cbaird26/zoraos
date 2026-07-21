from __future__ import annotations

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class ProviderConfig(BaseSettings):
    api_key: str | None = None
    model: str = "gpt-4o"
    api_base: str | None = None
    max_tokens: int = 4096
    temperature: float = 0.7
    timeout: int = 120


class ModelProviderSettings(BaseSettings):
    openai: ProviderConfig = ProviderConfig(model="gpt-4o")
    anthropic: ProviderConfig = ProviderConfig(model="claude-sonnet-4-20250514")
    deepseek: ProviderConfig = ProviderConfig(
        model="deepseek-chat",
        api_base="https://api.deepseek.com",
    )
    kimi: ProviderConfig = ProviderConfig(
        model="kimi-k2",
        api_base="https://api.moonshot.cn",
    )
    qwen: ProviderConfig = ProviderConfig(
        model="qwen-max",
        api_base="https://dashscope.aliyuncs.com",
    )
    grok: ProviderConfig = ProviderConfig(
        model="grok-3",
        api_base="https://api.x.ai",
    )
    openrouter: ProviderConfig = ProviderConfig(
        model="openrouter/tencent/hy3:free",
        api_base="https://openrouter.ai/api/v1",
    )
    ollama: ProviderConfig = ProviderConfig(
        model="zora:core",
        api_base="http://localhost:11434",
        api_key="ollama",
    )


class MemorySettings(BaseSettings):
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    top_k: int = 10
    collections: str = (
        "research,books,physics,ai,projects,software,therapy,gaming,"
        "journal,ideas,meetings,papers,videos"
    )

    @property
    def collection_list(self) -> list[str]:
        return [c.strip() for c in self.collections.split(",")]


class ClusterSettings(BaseSettings):
    node_name: str = "m5-orchestrator"
    node_role: str = "orchestrator"
    node_capabilities: str = "orchestrator,models,tools"

    @property
    def capabilities(self) -> list[str]:
        return [c.strip() for c in self.node_capabilities.split(",")]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        env_nested_delimiter="__",
    )

    environment: str = "development"
    debug: bool = True
    log_level: str = "DEBUG"
    data_dir: str = "./data"

    database_url: str = "postgresql+asyncpg://zoraos:zoraos@localhost:5432/zoraos"
    database_url_sync: str = "postgresql://zoraos:zoraos@localhost:5432/zoraos"
    redis_url: str = "redis://localhost:6379/0"

    vector_store_type: str = "chroma"
    chroma_persist_dir: str = "./data/chroma"

    gateway_host: str = "127.0.0.1"
    gateway_port: int = 8000
    gateway_secret_key: str = "change-me-to-a-random-string"

    default_provider: str = "ollama"
    default_model: str = "zora:core"

    scheduler_enabled: bool = True

    providers: ModelProviderSettings = ModelProviderSettings()
    memory: MemorySettings = MemorySettings()
    cluster: ClusterSettings = ClusterSettings()

    @property
    def data_path(self) -> Path:
        return Path(self.data_dir)

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if v.upper() not in allowed:
            raise ValueError(f"Invalid log level: {v}. Must be one of {allowed}")
        return v.upper()


settings = Settings()
