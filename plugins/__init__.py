"""
ZoraOS Plugin System.

Every tool, agent, and model provider is a plugin.
Create a Python file in this directory or subdirectories to extend ZoraOS.
"""

from typing import Any, Dict


class Plugin:
    name: str = ""
    version: str = "0.1.0"
    description: str = ""

    def on_load(self, context: Dict[str, Any]) -> None:
        pass

    def on_unload(self) -> None:
        pass
