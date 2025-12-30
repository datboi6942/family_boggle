import asyncio
from typing import Dict, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
import structlog

from family_boggle.config import settings
from family_boggle.websocket_manager import manager
from family_boggle.game_engine import game_engine
from family_boggle.models import WordSubmission
from family_boggle.high_scores import get_leaderboard, get_player_stats, ip_tracker

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


@app.get("/api/leaderboard")
async def leaderboard(limit: int = Query(default=10, le=50)):
    """Returns the high scores leaderboard."""
    return {"leaderboard": get_leaderboard(limit)}


@app.get("/api/player-stats")
async def player_stats(request: Request):
    """Returns the current player's stats based on their IP address."""
    # Get client IP - check forwarded headers first for proxy support
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "unknown"

    stats = get_player_stats(ip)
    if not stats:
        return {"stats": None, "is_new_player": True}
    return {"stats": stats, "is_new_player": False}


def get_client_ip(websocket: WebSocket) -> str:
    """Extract client IP from WebSocket connection."""
    # Check for forwarded headers (for proxied connections)
    forwarded = websocket.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()

    # Fall back to direct client connection
    if websocket.client:
        return websocket.client.host
    return "unknown"


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
    
    # Get client IP for high score tracking
    client_ip = get_client_ip(websocket)
    logger.info("client_connected", player_id=player_id, ip=client_ip)
    
    # Register player IP for high score tracking
    ip_tracker.register_player(player_id, client_ip)

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
                    
                    # Broadcast that the powerup was consumed
                    await manager.broadcast(lobby_id, {
                        "type": "powerup_consumed",
                        "data": {
                            "player_id": player_id,
                            "powerups": list(player.powerups)
                        }
                    })
                    
                    if powerup == "shuffle":
                        game_engine.board_gen.generate()
                        lobby.board = game_engine.board_gen.grid
                        # Broadcast the new board
                        await manager.broadcast(lobby_id, {
                            "type": "board_update",
                            "data": {"board": lobby.board}
                        })
                    
                    from family_boggle.powerups import powerup_manager
                    effect = powerup_manager.apply_powerup(lobby_id, player_id, powerup, lobby.players)
                    
                    # For freeze, include bonus time info
                    if powerup == "freeze":
                        effect["bonus_time"] = 10  # 10 seconds bonus
                    
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
        ip_tracker.remove_player(player_id)
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
        
        # Update high scores for all players
        from family_boggle.high_scores import update_player_score
        winner_id = summary.get("winner", {}).get("player_id") if summary.get("winner") else None
        
        for result in summary.get("results", []):
            player_id = result.get("player_id")
            if player_id:
                player_ip = ip_tracker.get_player_ip(player_id)
                if player_ip:
                    update_player_score(
                        ip_address=player_ip,
                        username=result.get("username", "Unknown"),
                        score=result.get("score", 0),
                        words_count=len(result.get("words", [])),
                        is_winner=(player_id == winner_id),
                        challenges_completed=result.get("challenges_completed", 0)
                    )
        
        await manager.broadcast(lobby_id, {
            "type": "game_end",
            "data": summary
        })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)

