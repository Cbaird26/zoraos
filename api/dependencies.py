from __future__ import annotations

import os
from functools import lru_cache

from agents.implementations import (
    ResearchAgent,
    DeveloperAgent,
    WriterAgent,
    KnowledgeAgent,
    GamingAgent,
)
from agents.manager import AgentManager
from agents.registry import AgentRegistry
from gateway.service import GatewayService
from governance.audit import AuditLedger
from governance.policy import GovernancePolicy
from memory.store import DocumentStore
from memory.vector import VectorStore
from models.manager import ModelManager
from models.providers import LiteLLMProvider, OpenRouterProvider
from planner.engine import PlannerEngine
from router.engine import RouterEngine
from tools.implementations import (
    FilesystemTool,
    WebSearchTool,
    PythonExecTool,
    PDFReaderTool,
    GitTool,
    EQSendKeysTool,
    ECScreenReaderTool,
    EQWaitTool,
)
from tools.manager import ToolManager
from tools.registry import ToolRegistry


def get_model_manager() -> ModelManager:
    from configs.settings import settings
    manager = ModelManager()

    always_register = {"ollama", "openrouter"}

    for name, cfg in {
        "openai": settings.providers.openai,
        "deepseek": settings.providers.deepseek,
        "kimi": settings.providers.kimi,
        "qwen": settings.providers.qwen,
        "anthropic": settings.providers.anthropic,
        "grok": settings.providers.grok,
        "ollama": settings.providers.ollama,
        "openrouter": settings.providers.openrouter,
    }.items():
        api_key = cfg.api_key or os.environ.get("OPENROUTER_API_KEY")
        if api_key or name in always_register:
            if name == "openrouter":
                provider = OpenRouterProvider({
                    "api_key": api_key,
                    "api_base": cfg.api_base,
                    "model": cfg.model,
                })
            else:
                provider = LiteLLMProvider({
                    "api_key": cfg.api_key,
                    "api_base": cfg.api_base,
                    "model": cfg.model,
                    "provider_name": name,
                })
            manager.register_provider(name, provider)

    return manager


def get_document_store() -> DocumentStore:
    return DocumentStore()


def get_vector_store() -> VectorStore:
    return VectorStore(get_document_store())


def get_tool_registry() -> ToolRegistry:
    registry = ToolRegistry()
    vector_store = get_vector_store()
    doc_store = get_document_store()

    registry.register(FilesystemTool())
    registry.register(WebSearchTool())
    registry.register(PythonExecTool())
    registry.register(PDFReaderTool())
    registry.register(GitTool())
    from tools.implementations.memory_tools import MemoryWriteTool, MemoryReadTool, MemorySearchTool
    registry.register(MemoryWriteTool(vector_store))
    registry.register(MemoryReadTool(doc_store))
    registry.register(MemorySearchTool(vector_store))
    registry.register(EQSendKeysTool())
    registry.register(ECScreenReaderTool())
    registry.register(EQWaitTool())

    return registry


def get_tool_manager() -> ToolManager:
    return ToolManager(get_tool_registry(), GovernancePolicy(), AuditLedger())


def get_agent_manager() -> AgentManager:
    registry = get_tool_registry()
    tool_manager = ToolManager(registry, GovernancePolicy(), AuditLedger())
    return AgentManager(get_model_manager(), registry, tool_manager)


def get_planner() -> PlannerEngine:
    planner = PlannerEngine()
    planner.configure(get_model_manager(), get_agent_manager())
    return planner


def get_router() -> RouterEngine:
    return RouterEngine()


@lru_cache
def get_gateway() -> GatewayService:
    model_manager = get_model_manager()
    tool_registry = get_tool_registry()
    audit_ledger = AuditLedger()
    tool_manager = ToolManager(tool_registry, GovernancePolicy(), audit_ledger)
    agent_manager = AgentManager(model_manager, tool_registry, tool_manager)
    planner = PlannerEngine()
    planner.configure(model_manager, agent_manager)
    return GatewayService(
        model_manager=model_manager,
        agent_manager=agent_manager,
        tool_manager=tool_manager,
        planner=planner,
        router=get_router(),
        audit_ledger=audit_ledger,
    )
