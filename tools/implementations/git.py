from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

from tools.base import Tool, ToolResult


class GitTool(Tool):
    name = "git"
    description = "Execute git commands on a repository"
    parameters = {
        "type": "object",
        "properties": {
            "operation": {
                "type": "string",
                "enum": ["status", "diff", "log", "clone", "add", "commit", "push", "pull", "branch", "checkout"],
                "description": "Git operation to perform",
            },
            "repo_path": {"type": "string", "description": "Path to the git repository"},
            "args": {"type": "array", "items": {"type": "string"}, "description": "Additional arguments"},
        },
        "required": ["operation", "repo_path"],
    }

    async def execute(self, operation: str, repo_path: str, args: list[str] | None = None, **kwargs: Any) -> ToolResult:
        try:
            repo = Path(repo_path).resolve()
            if not repo.exists():
                return ToolResult(success=False, error=f"Repository path does not exist: {repo_path}")

            cmd = ["git"]
            if operation == "status":
                cmd.extend(["-C", str(repo), "status"])
            elif operation == "diff":
                cmd.extend(["-C", str(repo), "diff"] + (args or []))
            elif operation == "log":
                cmd.extend(["-C", str(repo), "log", "--oneline", "-20"])
            elif operation == "add":
                cmd.extend(["-C", str(repo), "add"] + (args or ["."]))
            elif operation == "commit":
                msg = args[0] if args else "ZoraOS auto-commit"
                cmd.extend(["-C", str(repo), "commit", "-m", msg])
            elif operation == "push":
                cmd.extend(["-C", str(repo), "push"] + (args or []))
            elif operation == "pull":
                cmd.extend(["-C", str(repo), "pull"] + (args or []))
            elif operation == "branch":
                cmd.extend(["-C", str(repo), "branch"] + (args or []))
            elif operation == "checkout":
                cmd.extend(["-C", str(repo), "checkout"] + (args or []))
            elif operation == "clone":
                if not args or len(args) < 1:
                    return ToolResult(success=False, error="clone requires url argument")
                cmd.extend(["clone"] + args)
            else:
                return ToolResult(success=False, error=f"Unknown git operation: {operation}")

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            return ToolResult(
                success=result.returncode == 0,
                output=result.stdout,
                error=result.stderr if result.returncode != 0 else None,
            )
        except subprocess.TimeoutExpired:
            return ToolResult(success=False, error="Git operation timed out")
        except Exception as e:
            return ToolResult(success=False, error=f"Git error: {e}")
