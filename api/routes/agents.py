from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..dependencies import get_gateway
from gateway.service import GatewayService

router = APIRouter()


class AgentRunRequest(BaseModel):
    agent: str
    goal: str
    context: Optional[Dict[str, Any]] = None
    approved_tools: List[str] = Field(default_factory=list)
    budget: Optional[Dict[str, int]] = None


@router.post("/agents/run")
async def run_agent(request: AgentRunRequest, gateway: GatewayService = Depends(get_gateway)):
    try:
        result = await gateway.run_agent(
            agent_type=request.agent,
            goal=request.goal,
            context=request.context,
            approved_tools=request.approved_tools,
            budget=request.budget,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agents/run/stream")
async def run_agent_stream(request: AgentRunRequest, gateway: GatewayService = Depends(get_gateway)):
    return StreamingResponse(
        gateway.run_agent_stream(
            agent_type=request.agent,
            goal=request.goal,
            context=request.context,
            approved_tools=request.approved_tools,
            budget=request.budget,
        ),
        media_type="text/event-stream",
    )


@router.get("/agents/tasks")
async def list_tasks(gateway: GatewayService = Depends(get_gateway)):
    return {"tasks": gateway.list_tasks()}


@router.get("/agents/tasks/{task_id}")
async def get_task(task_id: str, gateway: GatewayService = Depends(get_gateway)):
    task = gateway.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task not found: {task_id}")
    return task


@router.post("/agents/tasks/{task_id}/cancel")
async def cancel_task(task_id: str, gateway: GatewayService = Depends(get_gateway)):
    if not gateway.cancel_task(task_id):
        raise HTTPException(status_code=409, detail="Task cannot be cancelled")
    return {"task_id": task_id, "status": "cancelling"}


@router.get("/agents/tasks/{task_id}/audit")
async def task_audit(task_id: str, gateway: GatewayService = Depends(get_gateway)):
    if not gateway.get_task(task_id):
        raise HTTPException(status_code=404, detail=f"Task not found: {task_id}")
    return {"task_id": task_id, "events": gateway.task_audit(task_id)}


@router.get("/agents")
async def list_agents(gateway: GatewayService = Depends(get_gateway)):
    return {"agents": gateway._agent_manager.list_agents()}
