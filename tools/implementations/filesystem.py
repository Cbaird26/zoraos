from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import aiofiles

from tools.base import Tool, ToolResult


class FilesystemTool(Tool):
    name = "filesystem"
    description = "Read and write files on the local filesystem"
    parameters = {
        "type": "object",
        "properties": {
            "operation": {
                "type": "string",
                "enum": ["read", "write", "list", "delete", "exists"],
                "description": "File operation to perform",
            },
            "path": {"type": "string", "description": "Absolute path to the file or directory"},
            "content": {"type": "string", "description": "Content to write (for write operation)"},
        },
        "required": ["operation", "path"],
    }
    required_permissions = ["filesystem"]

    def __init__(self, allowed_base_paths: list[str] | None = None):
        self._allowed_paths = allowed_base_paths or [os.path.expanduser("~")]

    def _validate_path(self, path_str: str) -> Path:
        p = Path(path_str).resolve()
        allowed = False
        for base in self._allowed_paths:
            base_path = Path(base).resolve()
            if str(p).startswith(str(base_path)):
                allowed = True
                break
        if not allowed:
            raise PermissionError(f"Access denied: {path_str}")
        return p

    async def execute(self, operation: str, path: str, content: str | None = None, **kwargs: Any) -> ToolResult:
        try:
            resolved = self._validate_path(path)
            if operation == "read":
                if not resolved.exists():
                    return ToolResult(success=False, error=f"Path does not exist: {path}")
                if resolved.is_dir():
                    items = [str(p.relative_to(resolved)) for p in resolved.iterdir()]
                    return ToolResult(success=True, output={"type": "directory", "entries": items})
                async with aiofiles.open(resolved, "r") as f:
                    data = await f.read()
                return ToolResult(success=True, output={"type": "file", "content": data, "size": len(data)})

            elif operation == "write":
                if content is None:
                    return ToolResult(success=False, error="content required for write operation")
                resolved.parent.mkdir(parents=True, exist_ok=True)
                async with aiofiles.open(resolved, "w") as f:
                    await f.write(content)
                return ToolResult(success=True, output={"path": str(resolved), "size": len(content)})

            elif operation == "list":
                if not resolved.exists():
                    return ToolResult(success=False, error=f"Path does not exist: {path}")
                items = []
                for p in resolved.iterdir():
                    items.append({"name": p.name, "type": "directory" if p.is_dir() else "file", "size": p.stat().st_size if p.is_file() else 0})
                return ToolResult(success=True, output={"path": str(resolved), "entries": items})

            elif operation == "delete":
                if not resolved.exists():
                    return ToolResult(success=False, error=f"Path does not exist: {path}")
                if resolved.is_file():
                    resolved.unlink()
                else:
                    import shutil
                    shutil.rmtree(resolved)
                return ToolResult(success=True, output={"deleted": str(resolved)})

            elif operation == "exists":
                return ToolResult(success=True, output={"exists": resolved.exists(), "path": str(resolved)})

            return ToolResult(success=False, error=f"Unknown operation: {operation}")
        except PermissionError as e:
            return ToolResult(success=False, error=str(e))
        except Exception as e:
            return ToolResult(success=False, error=f"Filesystem error: {e}")
