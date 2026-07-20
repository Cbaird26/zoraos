from .litellm_provider import LiteLLMProvider
from .openrouter_provider import OpenRouterProvider
from ..registry import ProviderRegistry

ProviderRegistry.register("litellm", LiteLLMProvider)
ProviderRegistry.register("openrouter", OpenRouterProvider)
