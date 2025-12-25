import asyncio
from typing import Dict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Header, Query
from fastapi.middleware.cors import CORSMiddleware
import structlog

from family_boggle.config import settings
from family_boggle.websocket_manager import manager
from family_boggle.game_engine import game_engine
from family_boggle.models import WordSubmission

# Setup structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger()

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.websocket("/ws/{lobby_id}/{player_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    lobby_id: str, 
    player_id: str,
    username: str = Query(...),
    character: str = Query(...),
    mode: str = Query(default="join")
):
    await manager.connect(websocket, lobby_id)
    
    # Handle create vs join modes
    lobby_exists = lobby_id in game_engine.lobbies
    
    if mode == "join" and not lobby_exists:
        # Trying to join a lobby that doesn't exist
        logger.warning("join_failed_lobby_not_found", lobby_id=lobby_id, player_id=player_id)
        await websocket.close(code=1008, reason="Lobby not found")
        return
    
    if mode == "create" and not lobby_exists:
        # Create new lobby
        game_engine.create_lobby(player_id, username, character, lobby_id=lobby_id)
    elif lobby_exists:
        # Join existing lobby
        success = game_engine.join_lobby(lobby_id, player_id, username, character)
        if not success:
            await websocket.close(code=1008, reason="Lobby full or error joining")
            return
    
    # Broadcast updated lobby state
    await manager.broadcast(lobby_id, {
        "type": "lobby_update",
        "data": game_engine.lobbies[lobby_id].model_dump()
    })

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            msg_data = data.get("data", {})

            if msg_type == "toggle_ready":
                game_engine.toggle_ready(lobby_id, player_id)
                await manager.broadcast(lobby_id, {
                    "type": "lobby_update",
                    "data": game_engine.lobbies[lobby_id].model_dump()
                })
                
                # Check if all ready to start countdown
                lobby = game_engine.lobbies[lobby_id]
                if all(p.is_ready for p in lobby.players) and len(lobby.players) >= 1:
                    asyncio.create_task(run_game_loop(lobby_id))

            elif msg_type == "set_board_size":
                lobby = game_engine.lobbies[lobby_id]
                if lobby.host_id == player_id:
                    lobby.board_size = msg_data.get("size", 6)
                    await manager.broadcast(lobby_id, {
                        "type": "lobby_update",
                        "data": lobby.model_dump()
                    })

            elif msg_type == "submit_word":
                submission = WordSubmission(**msg_data)
                result = game_engine.submit_word(lobby_id, player_id, submission)
                await manager.send_personal(websocket, {
                    "type": "word_result",
                    "data": result
                })
                # If valid, broadcast updated scores
                if result.get("valid"):
                    await manager.broadcast(lobby_id, {
                        "type": "score_update",
                        "data": {
                            "player_id": player_id,
                            "score": result["total_score"],
                            "powerup": result.get("powerup")
                        }
                    })

            elif msg_type == "use_powerup":
                powerup = msg_data.get("powerup")
                lobby = game_engine.lobbies[lobby_id]
                player = next((p for p in lobby.players if p.id == player_id), None)
                
                if player and powerup in player.powerups:
                    player.powerups.remove(powerup)
                    
                    if powerup == "shuffle":
                        game_engine.board_gen.generate()
                        lobby.board = game_engine.board_gen.grid
                        await manager.broadcast(lobby_id, {
                            "type": "game_state",
                            "data": lobby.model_dump()
                        })
                    
                    from family_boggle.powerups import powerup_manager
                    effect = powerup_manager.apply_powerup(lobby_id, player_id, powerup, lobby.players)
                    
                    await manager.broadcast(lobby_id, {
                        "type": "powerup_event",
                        "data": effect
                    })

            elif msg_type == "reset_game":
                # Reset the lobby for a new game
                if game_engine.reset_lobby(lobby_id):
                    await manager.broadcast(lobby_id, {
                        "type": "lobby_update",
                        "data": game_engine.lobbies[lobby_id].model_dump()
                    })

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        # Remove player from lobby
        if game_engine.leave_lobby(lobby_id, player_id):
            # If lobby still exists, broadcast update
            if lobby_id in game_engine.lobbies:
                await manager.broadcast(lobby_id, {
                    "type": "lobby_update",
                    "data": game_engine.lobbies[lobby_id].model_dump()
                })

async def run_game_loop(lobby_id: str):
    """Handles the 3-2-1 countdown and the 3-minute game timer."""
    lobby = game_engine.lobbies.get(lobby_id)
    if not lobby: return

    # 1. Countdown Phase
    lobby.status = "countdown"
    for i in range(3, 0, -1):
        lobby.timer = i
        await manager.broadcast(lobby_id, {
            "type": "game_state",
            "data": lobby.model_dump()
        })
        await asyncio.sleep(1)

    # 2. Playing Phase
    game_engine.start_game(lobby_id) # Generates board
    lobby.status = "playing"
    lobby.timer = settings.GAME_DURATION_SECONDS
    
    # Send initial full state for playing phase
    await manager.broadcast(lobby_id, {
        "type": "game_state",
        "data": lobby.model_dump()
    })
    
    while lobby.timer > 0:
        await asyncio.sleep(1)
        lobby.timer -= 1
        
        # Broadcast timer update only (90% reduction in payload)
        await manager.broadcast(lobby_id, {
            "type": "timer_update",
            "data": {"timer": lobby.timer}
        })
        
        # Check if game was forcibly ended or everyone left
        if lobby_id not in game_engine.lobbies:
            break

    # 3. Summary Phase
    if lobby_id in game_engine.lobbies:
        lobby.status = "summary"
        summary = game_engine.finalize_scores(lobby_id)
        await manager.broadcast(lobby_id, {
            "type": "game_end",
            "data": summary
        })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)
