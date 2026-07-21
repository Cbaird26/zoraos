from ..registry import AgentRegistry
from .developer import DeveloperAgent
from .gaming import GamingAgent
from .knowledge import KnowledgeAgent
from .research import ResearchAgent
from .writer import WriterAgent


def register_builtin_agents() -> None:
    """Register the bundled agent types.

    Registration is idempotent, so application factories can call this explicitly
    instead of depending on import side effects that formatters may remove.
    """
    AgentRegistry.register("research", ResearchAgent)
    AgentRegistry.register("developer", DeveloperAgent)
    AgentRegistry.register("writer", WriterAgent)
    AgentRegistry.register("knowledge", KnowledgeAgent)
    AgentRegistry.register("gaming", GamingAgent)


register_builtin_agents()
