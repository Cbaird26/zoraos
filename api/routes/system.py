from __future__ import annotations

from fastapi import APIRouter, Depends

from ..dependencies import get_gateway
from gateway.service import GatewayService

router = APIRouter()


@router.get("/system/status")
async def system_status(gateway: GatewayService = Depends(get_gateway)):
    return await gateway.health()
