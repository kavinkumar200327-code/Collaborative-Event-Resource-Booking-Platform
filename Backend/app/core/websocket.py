import asyncio
import json
import logging
from typing import Dict, List, Optional
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # Map user_id -> list of WebSockets
        self.active_connections: Dict[int, List[WebSocket]] = {}
        # All connected sockets for general broadcast
        self.broadcast_connections: List[WebSocket] = []
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    async def connect(self, websocket: WebSocket, user_id: Optional[int] = None):
        try:
            self.loop = asyncio.get_running_loop()
        except RuntimeError:
            pass
        await websocket.accept()
        self.broadcast_connections.append(websocket)
        if user_id is not None:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []
            self.active_connections[user_id].append(websocket)
        logger.info(f"WebSocket client connected. user_id={user_id}")

    def disconnect(self, websocket: WebSocket, user_id: Optional[int] = None):
        if websocket in self.broadcast_connections:
            self.broadcast_connections.remove(websocket)
        if user_id is not None and user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"WebSocket client disconnected. user_id={user_id}")

    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            text = json.dumps(message)
            dead_sockets = []
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_text(text)
                except Exception:
                    dead_sockets.append(connection)
            for dead in dead_sockets:
                self.disconnect(dead, user_id)

    async def broadcast(self, message: dict):
        text = json.dumps(message)
        dead_sockets = []
        for connection in list(self.broadcast_connections):
            try:
                await connection.send_text(text)
            except Exception:
                dead_sockets.append(connection)
        for dead in dead_sockets:
            if dead in self.broadcast_connections:
                self.broadcast_connections.remove(dead)

    def send_personal_sync(self, message: dict, user_id: int):
        if not self.loop or not self.loop.is_running():
            try:
                self.loop = asyncio.get_event_loop()
            except RuntimeError:
                pass
        if self.loop and self.loop.is_running():
            if user_id in self.active_connections:
                asyncio.run_coroutine_threadsafe(self.send_personal_message(message, user_id), self.loop)

    def broadcast_sync(self, message: dict):
        if not self.loop or not self.loop.is_running():
            try:
                self.loop = asyncio.get_event_loop()
            except RuntimeError:
                pass
        if self.loop and self.loop.is_running():
            asyncio.run_coroutine_threadsafe(self.broadcast(message), self.loop)


manager = ConnectionManager()
