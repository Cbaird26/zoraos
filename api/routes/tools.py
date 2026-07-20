from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..dependencies import get_tool_manager
from tools.manager import ToolManager

router = APIRouter()


class ToolExecuteRequest(BaseModel):
    tool: str
    params: Dict[str, Any] = {}


@router.post("/tools/execute")
async def tool_execute(request: ToolExecuteRequest, tool_manager: ToolManager = Depends(get_tool_manager)):
    try:
        result = await tool_manager.execute(request.tool, **request.params)
        return {"success": result.success, "output": result.output, "error": result.error}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools")
async def list_tools(tool_manager: ToolManager = Depends(get_tool_manager)):
    return {"tools": tool_manager.list_tools()}
