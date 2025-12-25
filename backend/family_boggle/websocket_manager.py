import json
from typing import Dict, Set
from fastapi import WebSocket
import structlog

logger = structlog.get_logger()

class WebSocketManager:
    """Manages WebSocket connections for multiple lobbies."""
    
    def __init__(self) -> None:
        """Initializes the manager."""
        # lobby_id -> set of websockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # websocket -> lobby_id
        self.connection_lobby: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, lobby_id: str) -> None:
        """Connects a new WebSocket to a lobby."""
        await websocket.accept()
        if lobby_id not in self.active_connections:
            self.active_connections[lobby_id] = set()
        self.active_connections[lobby_id].add(websocket)
        self.connection_lobby[websocket] = lobby_id
        logger.info("websocket_connected", lobby_id=lobby_id)

    def disconnect(self, websocket: WebSocket) -> None:
        """Disconnects a WebSocket."""
        lobby_id = self.connection_lobby.get(websocket)
        if lobby_id and lobby_id in self.active_connections:
            self.active_connections[lobby_id].remove(websocket)
            if not self.active_connections[lobby_id]:
                del self.active_connections[lobby_id]
        if websocket in self.connection_lobby:
            del self.connection_lobby[websocket]
        logger.info("websocket_disconnected", lobby_id=lobby_id)

    async def broadcast(self, lobby_id: str, message: dict) -> None:
        """Broadcasts a message to all players in a lobby."""
        if lobby_id not in self.active_connections:
            return
            
        message_json = json.dumps(message)
        # Copy the set to avoid RuntimeError if connections change during iteration
        connections = list(self.active_connections.get(lobby_id, set()))
        for connection in connections:
            try:
                await connection.send_text(message_json)
            except Exception as e:
                logger.error("broadcast_error", error=str(e), lobby_id=lobby_id)

    async def send_personal(self, websocket: WebSocket, message: dict) -> None:
        """Sends a message to a specific connection."""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error("send_personal_error", error=str(e))

manager = WebSocketManager()
