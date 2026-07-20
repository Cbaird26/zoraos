from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..dependencies import get_gateway
from gateway.service import GatewayService

router = APIRouter()


class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    model: Optional[str] = None
    provider: Optional[str] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 4096
    stream: bool = False


class ChatResponse(BaseModel):
    response: str
    model: str
    provider: str
    usage: Optional[Dict[str, Any]] = None
    latency_ms: Optional[float] = None


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, gateway: GatewayService = Depends(get_gateway)):
    try:
        result = await gateway.chat(
            messages=request.messages,
            model=request.model,
            provider=request.provider,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
