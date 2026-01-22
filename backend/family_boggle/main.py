import asyncio

import structlog
from fastapi import FastAPI, Query, Request, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from family_boggle.config import settings
from family_boggle.game_engine import game_engine
from family_boggle.high_scores import get_leaderboard, get_player_stats, ip_tracker
from family_boggle.models import GameStateModel, WordSubmission
from family_boggle.websocket_manager import manager
from family_boggle.auth import user_manager, verify_token, create_access_token

# Rate limiting for login attempts
import time
from collections import defaultdict

login_attempts = defaultdict(list)
MAX_ATTEMPTS_PER_MINUTE = 5

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
    allow_origins=settings.ALLOWED_ORIGINS.split(",") if settings.ALLOWED_ORIGINS else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
 )

# Authentication
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Validates JWT token and returns user data."""
    token = credentials.credentials
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = user_manager.get_user_by_id(int(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


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


# Authentication endpoints
@app.post("/api/auth/register")
async def register_user(request: Request):
    """Registers a new user account."""
    # Rate limiting for registration
    client_ip = request.client.host if request.client else "unknown"
    register_key = f"register:{client_ip}"
    now = time.time()
    
    # Clean old attempts (older than 1 minute)
    if register_key in login_attempts:
        login_attempts[register_key] = [
            attempt_time for attempt_time in login_attempts[register_key]
            if now - attempt_time < 60
        ]
    
    # Check if exceeded limit (3 registrations per minute)
    if len(login_attempts.get(register_key, [])) >= 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many registration attempts. Please try again later."
        )
    
    # Record this attempt
    login_attempts[register_key].append(now)
    
    data = await request.json()
    username = data.get("username")
    password = data.get("password")
    email = data.get("email")
    
    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password are required"
        )
    
    # Password validation
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters"
        )
    
    success, message = user_manager.register_user(username, password, email)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )
    
    # Auto-login after successful registration
    user_data, auth_message = user_manager.authenticate_user(username, password)
    if user_data is None:
        # This shouldn't happen but handle gracefully
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration succeeded but auto-login failed"
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user_data["id"])})
    
    # Remove successful registration attempt from rate limiting
    if register_key in login_attempts and login_attempts[register_key]:
        login_attempts[register_key].pop()
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_data,
        "message": message
    }


@app.post("/api/auth/login")
async def login_user(request: Request):
    """Authenticates a user and returns JWT token."""
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    
    # Clean old attempts (older than 1 minute)
    if client_ip in login_attempts:
        login_attempts[client_ip] = [
            attempt_time for attempt_time in login_attempts[client_ip]
            if now - attempt_time < 60
        ]
    
    # Check if exceeded limit
    if len(login_attempts.get(client_ip, [])) >= MAX_ATTEMPTS_PER_MINUTE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later."
        )
    
    # Record this attempt
    login_attempts[client_ip].append(now)
    
    data = await request.json()
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password are required"
        )
    
    user_data, message = user_manager.authenticate_user(username, password)
    if user_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=message
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user_data["id"])})
    
    # Remove successful attempt from rate limiting
    if client_ip in login_attempts and login_attempts[client_ip]:
        login_attempts[client_ip].pop()
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_data
    }


@app.get("/api/auth/profile")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    """Returns the current user's profile."""
    return {"user": current_user}


@app.get("/api/auth/stats")
async def get_user_stats(current_user: dict = Depends(get_current_user)):
    """Returns the current user's game statistics."""
    stats = user_manager.get_user_stats(current_user["id"])
    if stats is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User statistics not found"
        )
    return {"stats": stats}


@app.post("/api/auth/link-ip")
async def link_ip_to_account(request: Request, current_user: dict = Depends(get_current_user)):
    """Links current IP address to user account for anonymous play migration."""
    # Get client IP
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "unknown"
    
    success = user_manager.link_ip_to_user(ip, current_user["id"])
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to link IP address"
        )
    
    return {"success": True, "message": f"IP {ip} linked to account"}


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
    mode: str = Query(default="join"),
    token: str = Query(None),
):
    await manager.connect(websocket, lobby_id)

    # Get client IP for high score tracking
    client_ip = get_client_ip(websocket)
    
    # Validate token if provided
    user_id = None
    if token:
        payload = verify_token(token)
        if payload:
            user_id_str = payload.get("sub")
            if user_id_str:
                try:
                    user_id = int(user_id_str)
                    # Verify user exists
                    user = user_manager.get_user_by_id(user_id)
                    if not user:
                        user_id = None
                        logger.warning("token_user_not_found", player_id=player_id, user_id=user_id_str)
                except (ValueError, TypeError):
                    logger.warning("invalid_user_id_in_token", player_id=player_id, user_id=user_id_str)
        else:
            logger.warning("invalid_token_provided", player_id=player_id)
    
    logger.info("client_connected", player_id=player_id, ip=client_ip, has_user=user_id is not None)

    # Register player IP and optional user for high score tracking
    ip_tracker.register_player(player_id, client_ip, user_id)

    # Handle create vs join modes
    lobby_exists = lobby_id in game_engine.lobbies

    if mode == "join" and not lobby_exists:
        # Trying to join a lobby that doesn't exist
        logger.warning(
            "join_failed_lobby_not_found", lobby_id=lobby_id, player_id=player_id
        )
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

    # First, send lobby state directly to the new connection to ensure they receive it
    lobby_dict = game_engine.lobbies[lobby_id].model_dump()
    await manager.send_personal(websocket, {"type": "lobby_update", "data": lobby_dict})

    # Small delay to ensure the personal message is processed
    await asyncio.sleep(0.05)

    # Then broadcast to all other players in the lobby
    await manager.broadcast(lobby_id, {"type": "lobby_update", "data": lobby_dict})

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            msg_data = data.get("data", {})

            if msg_type == "toggle_ready":
                game_engine.toggle_ready(lobby_id, player_id)
                await manager.broadcast(
                    lobby_id,
                    {
                        "type": "lobby_update",
                        "data": game_engine.lobbies[lobby_id].model_dump(),
                    },
                )

                # Check if all ready to start countdown
                lobby = game_engine.lobbies[lobby_id]
                if all(p.is_ready for p in lobby.players) and len(lobby.players) >= 1:
                    asyncio.create_task(run_game_loop(lobby_id))

            elif msg_type == "set_board_size":
                lobby = game_engine.lobbies[lobby_id]
                if lobby.host_id == player_id:
                    lobby.board_size = msg_data.get("size", 6)
                    await manager.broadcast(
                        lobby_id, {"type": "lobby_update", "data": lobby.model_dump()}
                    )

            elif msg_type == "set_game_mode":
                lobby = game_engine.lobbies[lobby_id]
                if lobby.host_id == player_id:
                    game_mode = msg_data.get("game_mode", "classic")
                    mode_settings = msg_data.get("mode_settings", {})
                    success = game_engine.set_game_mode(lobby_id, game_mode, mode_settings)
                    if success:
                        await manager.broadcast(
                            lobby_id, {"type": "lobby_update", "data": lobby.model_dump()}
                        )

            elif msg_type == "assign_teams":
                lobby = game_engine.lobbies[lobby_id]
                if lobby.host_id == player_id and lobby.game_mode == "team":
                    team_assignments = msg_data.get("team_assignments", {})
                    success = game_engine.assign_teams(lobby_id, team_assignments)
                    if success:
                        await manager.broadcast(
                            lobby_id, {"type": "lobby_update", "data": lobby.model_dump()}
                        )

            elif msg_type == "submit_word":
                submission = WordSubmission(**msg_data)
                result = await game_engine.submit_word(lobby_id, player_id, submission)
                await manager.send_personal(
                    websocket, {"type": "word_result", "data": result}
                )
                # If valid, broadcast updated scores
                if result.get("valid"):
                    await manager.broadcast(
                        lobby_id,
                        {
                            "type": "score_update",
                            "data": {
                                "player_id": player_id,
                                "score": result["total_score"],
                                "powerup": result.get("powerup"),
                            },
                        },
                    )

            elif msg_type == "use_powerup":
                powerup = msg_data.get("powerup")
                lobby = game_engine.lobbies[lobby_id]
                player = next((p for p in lobby.players if p.id == player_id), None)

                if player and powerup in player.powerups:
                    from family_boggle.powerups import powerup_manager

                    # Special handling for lock powerup - arm it instead of applying immediately
                    if powerup == "lock":
                        player.powerups.remove(powerup)
                        # Save current board state for this player
                        await powerup_manager.arm_lock(lobby_id, player_id, lobby.board)

                        # Broadcast that the powerup was consumed and lock is armed
                        await manager.broadcast(
                            lobby_id,
                            {
                                "type": "powerup_consumed",
                                "data": {
                                    "player_id": player_id,
                                    "powerups": list(player.powerups),
                                },
                            },
                        )
                        await manager.broadcast(
                            lobby_id,
                            {
                                "type": "powerup_event",
                                "data": {"type": "lock_armed", "by": player_id},
                            },
                        )
                        continue

                    player.powerups.remove(powerup)

                    # Broadcast that the powerup was consumed
                    await manager.broadcast(
                        lobby_id,
                        {
                            "type": "powerup_consumed",
                            "data": {
                                "player_id": player_id,
                                "powerups": list(player.powerups),
                            },
                        },
                    )

                    if powerup == "shuffle":
                        # Generate new board first
                        assert game_engine.board_gen is not None
                        game_engine.board_gen.generate()
                        lobby.board = game_engine.board_gen.grid
                        new_board = lobby.board

                        # Consume locks - protected players keep their saved boards,
                        # everyone else syncs to the new board
                        protected_players_boards = (
                            await powerup_manager.consume_locks_for_shuffle(
                                lobby_id, new_board
                            )
                        )
                        protected_player_ids = list(protected_players_boards.keys())

                        # Broadcast board update with each protected player's individual saved board
                        await manager.broadcast(
                            lobby_id,
                            {
                                "type": "board_update",
                                "data": {
                                    "board": new_board,
                                    "protected_players": protected_player_ids,
                                    "protected_boards": (
                                        protected_players_boards
                                        if protected_player_ids
                                        else None
                                    ),
                                    "shuffled_by": player_id,
                                },
                            },
                        )

                    effect = await powerup_manager.apply_powerup(
                        lobby_id, player_id, powerup, lobby.players
                    )

                    # For freeze, add 10 seconds of bonus time to the player
                    # This extends their game after the main timer expires
                    if powerup == "freeze":
                        effect["player_id"] = player_id
                        effect["bonus_seconds"] = 10
                        player.bonus_time += 10
                        effect["bonus_time"] = player.bonus_time

                    await manager.broadcast(
                        lobby_id, {"type": "powerup_event", "data": effect}
                    )

            elif msg_type == "want_play_again":
                # Mark this player as wanting to play again
                lobby_state: GameStateModel | None = game_engine.lobbies.get(lobby_id)
                if lobby_state and lobby_state.status == "summary":
                    player = next(
                        (p for p in lobby_state.players if p.id == player_id), None
                    )
                    if player:
                        player.wants_play_again = True

                        # Broadcast the updated play again status to all players
                        await manager.broadcast(
                            lobby_id,
                            {
                                "type": "play_again_update",
                                "data": {
                                    "player_id": player_id,
                                    "players_ready": [
                                        p.id
                                        for p in lobby_state.players
                                        if p.wants_play_again
                                    ],
                                    "all_ready": all(
                                        p.wants_play_again for p in lobby_state.players
                                    ),
                                },
                            },
                        )

                        # If all players want to play again, reset the lobby
                        if all(p.wants_play_again for p in lobby_state.players):
                            if game_engine.reset_lobby(lobby_id):
                                await manager.broadcast(
                                    lobby_id,
                                    {
                                        "type": "lobby_update",
                                        "data": game_engine.lobbies[
                                            lobby_id
                                        ].model_dump(),
                                    },
                                )

            elif msg_type == "reset_game":
                # Force reset the lobby for a new game (host only fallback)
                reset_lobby_state: GameStateModel | None = game_engine.lobbies.get(
                    lobby_id
                )
                if reset_lobby_state and reset_lobby_state.host_id == player_id:
                    if game_engine.reset_lobby(lobby_id):
                        await manager.broadcast(
                            lobby_id,
                            {
                                "type": "lobby_update",
                                "data": game_engine.lobbies[lobby_id].model_dump(),
                            },
                        )

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        ip_tracker.remove_player(player_id)
        # Remove player from lobby
        if game_engine.leave_lobby(lobby_id, player_id):
            # If lobby still exists, broadcast update
            if lobby_id in game_engine.lobbies:
                await manager.broadcast(
                    lobby_id,
                    {
                        "type": "lobby_update",
                        "data": game_engine.lobbies[lobby_id].model_dump(),
                    },
                )


async def run_game_loop(lobby_id: str):
    """Handles the 3-2-1 countdown and the game timer with per-player bonus time."""
    lobby = game_engine.lobbies.get(lobby_id)
    if not lobby:
        return

    # 1. Countdown Phase
    lobby.status = "countdown"
    for i in range(3, 0, -1):
        lobby.timer = i
        await manager.broadcast(
            lobby_id, {"type": "game_state", "data": lobby.model_dump()}
        )
        await asyncio.sleep(1)

    # 2. Playing Phase
    game_engine.start_game(lobby_id)  # Generates board
    lobby.status = "playing"
    # 4x4 boards get 2 minutes (less words available), larger boards get 3 minutes
    lobby.timer = 120 if lobby.board_size == 4 else settings.GAME_DURATION_SECONDS

    # Reset per-player time states
    for player in lobby.players:
        player.bonus_time = 0
        player.is_time_up = False

    # Send initial full state for playing phase
    await manager.broadcast(
        lobby_id, {"type": "game_state", "data": lobby.model_dump()}
    )

    # Main timer phase
    while lobby.timer > 0:
        await asyncio.sleep(1)
        lobby.timer -= 1

        # Broadcast timer update only (90% reduction in payload)
        await manager.broadcast(
            lobby_id, {"type": "timer_update", "data": {"timer": lobby.timer}}
        )

        # Check if game was forcibly ended or everyone left
        if lobby_id not in game_engine.lobbies:
            break

    # Check if lobby still exists
    if lobby_id not in game_engine.lobbies:
        return

    # 2b. Bonus Time Phase - handle players with extra time from freeze powerup
    # Mark players without bonus time as finished
    players_with_bonus = []
    for player in lobby.players:
        if player.bonus_time > 0:
            players_with_bonus.append(player)
        else:
            player.is_time_up = True

    # Notify players whose time is up that they're waiting
    if players_with_bonus:
        await manager.broadcast(
            lobby_id,
            {
                "type": "waiting_phase",
                "data": {
                    "players_finished": [p.id for p in lobby.players if p.is_time_up],
                    "players_with_bonus": [
                        {"player_id": p.id, "bonus_time": p.bonus_time}
                        for p in players_with_bonus
                    ],
                },
            },
        )

        # Continue until all bonus time is exhausted
        while any(p.bonus_time > 0 for p in lobby.players):
            await asyncio.sleep(1)

            # Check if game was forcibly ended or everyone left
            if lobby_id not in game_engine.lobbies:
                return

            # Decrement bonus time for each player and notify when they finish
            for player in lobby.players:
                if player.bonus_time > 0:
                    player.bonus_time -= 1
                    if player.bonus_time <= 0:
                        player.is_time_up = True
                        # Notify this specific player their time is up
                        await manager.broadcast(
                            lobby_id,
                            {
                                "type": "player_time_up",
                                "data": {"player_id": player.id},
                            },
                        )

            # Send bonus timer updates to players still playing
            active_players = [p for p in lobby.players if p.bonus_time > 0]
            if active_players:
                await manager.broadcast(
                    lobby_id,
                    {
                        "type": "bonus_timer_update",
                        "data": {
                            "players": [
                                {"player_id": p.id, "bonus_time": p.bonus_time}
                                for p in active_players
                            ]
                        },
                    },
                )

    # 3. Summary Phase
    if lobby_id in game_engine.lobbies:
        lobby.status = "summary"
        summary = game_engine.finalize_scores(lobby_id)

        # Update high scores for all players
        from family_boggle.high_scores import update_player_score

        winner_id = (
            summary.get("winner", {}).get("player_id")
            if summary.get("winner")
            else None
        )

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
                        challenges_completed=result.get("challenges_completed", 0),
                    )
                
                # Also update user stats if player is logged in
                user_id = ip_tracker.get_player_user(player_id)
                if user_id:
                    user_manager.update_user_stats(
                        user_id,
                        {
                            "score": result.get("score", 0),
                            "is_winner": (player_id == winner_id),
                            "challenges_completed": result.get("challenges_completed", 0),
                        }
                    )

        await manager.broadcast(lobby_id, {"type": "game_end", "data": summary})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.HOST, port=settings.PORT)
