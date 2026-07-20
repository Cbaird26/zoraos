from .research import ResearchAgent
from .developer import DeveloperAgent
from .writer import WriterAgent
from .knowledge import KnowledgeAgent
from .gaming import GamingAgent
from ..registry import AgentRegistry

AgentRegistry.register("research", ResearchAgent)
AgentRegistry.register("developer", DeveloperAgent)
AgentRegistry.register("writer", WriterAgent)
AgentRegistry.register("knowledge", KnowledgeAgent)
AgentRegistry.register("gaming", GamingAgent)
