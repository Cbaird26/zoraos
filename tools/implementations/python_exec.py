from __future__ import annotations

import sys
import traceback
from io import StringIO
from typing import Any

from tools.base import Tool, ToolResult


class PythonExecTool(Tool):
    name = "python_exec"
    description = "Execute Python code and return the output"
    parameters = {
        "type": "object",
        "properties": {
            "code": {"type": "string", "description": "Python code to execute"},
            "timeout": {"type": "integer", "description": "Execution timeout in seconds", "default": 30},
        },
        "required": ["code"],
    }

    async def execute(self, code: str, timeout: int = 30, **kwargs: Any) -> ToolResult:
        stdout_capture = StringIO()
        stderr_capture = StringIO()
        old_stdout = sys.stdout
        old_stderr = sys.stderr

        try:
            sys.stdout = stdout_capture
            sys.stderr = stderr_capture

            compiled = compile(code, "<zoraos_exec>", "exec", flags=0, dont_inherit=True)
            namespace: dict = {}
            exec(compiled, namespace)

            stdout = stdout_capture.getvalue()
            stderr = stderr_capture.getvalue()

            output = {"stdout": stdout, "stderr": stderr, "return_value": namespace.get("_result", None)}
            return ToolResult(success=True, output=output)
        except Exception:
            error = traceback.format_exc()
            return ToolResult(success=False, output={"stdout": stdout_capture.getvalue(), "stderr": stderr_capture.getvalue()}, error=error)
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr
