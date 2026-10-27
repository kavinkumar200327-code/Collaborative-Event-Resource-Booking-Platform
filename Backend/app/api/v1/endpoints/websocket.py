import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import jwt

from app.core.config import settings
from app.core.security import decode_access_token
from app.core.websocket import manager

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Real-Time WebSockets"],
)


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    user_id = None
    if token:
        try:
            payload = decode_access_token(token)
            user_id = int(payload.get("sub"))
        except Exception as e:
            logger.warning(f"WebSocket auth failed: {e}")

    await manager.connect(websocket, user_id=user_id)
    try:
        while True:
            # Keep connection alive & listen for client ping/messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id=user_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, user_id=user_id)
