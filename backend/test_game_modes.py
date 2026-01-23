#!/usr/bin/env python3
"""
Integration test for Family Boggle game modes.
Tests team mode, timed attack mode, and word race mode functionality.
"""

import asyncio
import json
import random
import string
import websockets
import sys
import time

# Configuration
BASE_WS_URL = "ws://localhost:8000/ws"
BASE_HTTP_URL = "http://localhost:8000"


def generate_id(length=8):
    """Generate a random ID for lobby or player."""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


async def connect_player(
    lobby_id,
    player_id,
    username,
    character="Blobby",
    mode="join",
    token=None,
    password=None,
):
    """Connect a player to the WebSocket server."""
    # Build query parameters
    params = f"?username={username}&character={character}&mode={mode}"
    if token:
        params += f"&token={token}"
    if password:
        params += f"&password={password}"

    url = f"{BASE_WS_URL}/{lobby_id}/{player_id}{params}"
    print(f"Connecting to {url}")

    try:
        websocket = await websockets.connect(url)
        # Wait for initial lobby update
        response = await asyncio.wait_for(websocket.recv(), timeout=5)
        data = json.loads(response)
        print(f"Player {username} connected, received: {data.get('type')}")
        return websocket, data
    except Exception as e:
        print(f"Failed to connect player {username}: {e}")
        raise


async def send_message(websocket, msg_type, data=None):
    """Send a WebSocket message."""
    message = {"type": msg_type, "data": data or {}}
    await websocket.send(json.dumps(message))


async def receive_message(websocket, timeout=2):
    """Receive a WebSocket message with timeout."""
    try:
        response = await asyncio.wait_for(websocket.recv(), timeout=timeout)
        return json.loads(response)
    except asyncio.TimeoutError:
        return None


async def drain_messages(websocket, timeout=0.1):
    """Drain all pending messages from WebSocket buffer."""
    drained = []
    while True:
        try:
            response = await asyncio.wait_for(websocket.recv(), timeout=timeout)
            drained.append(json.loads(response))
        except (asyncio.TimeoutError, websockets.exceptions.ConnectionClosed):
            break
    return drained


async def test_team_mode():
    """Test team mode functionality."""
    print("\n=== Testing Team Mode ===")

    # Generate IDs
    lobby_id = generate_id(6)
    host_id = generate_id(8)
    player2_id = generate_id(8)

    # Host creates lobby
    host_ws, initial_data = await connect_player(
        lobby_id, host_id, "HostPlayer", character="Blobby", mode="create"
    )

    # Player 2 joins
    player2_ws, _ = await connect_player(
        lobby_id, player2_id, "Player2", character="Globby", mode="join"
    )

    # Drain any pending messages from initial connections
    print("Draining pending messages...")
    host_drained = await drain_messages(host_ws)
    player2_drained = await drain_messages(player2_ws)
    print(
        f"Drained {len(host_drained)} messages from host, {len(player2_drained)} from player2"
    )

    # Host sets game mode to team
    print("Host setting game mode to 'team'")
    await send_message(
        host_ws, "set_game_mode", {"game_mode": "team", "mode_settings": {}}
    )

    # Both players should receive lobby update
    host_update = await receive_message(host_ws)
    player2_update = await receive_message(player2_ws)

    if host_update and host_update.get("type") == "lobby_update":
        game_mode = host_update.get("data", {}).get("game_mode")
        print(f"Host received lobby update, game_mode: {game_mode}")
        assert game_mode == "team", f"Expected game_mode 'team', got '{game_mode}'"
    else:
        print(f"ERROR: Host didn't receive lobby update, got: {host_update}")
        return False

    # Host assigns teams (host to team_a, player2 to team_b)
    print("Host assigning teams")
    await send_message(
        host_ws,
        "assign_teams",
        {"team_assignments": {host_id: "team_a", player2_id: "team_b"}},
    )

    # Check team assignments
    host_team_update = await receive_message(host_ws)
    player2_team_update = await receive_message(player2_ws)

    if host_team_update and host_team_update.get("type") == "lobby_update":
        players = host_team_update.get("data", {}).get("players", [])
        host_player = next((p for p in players if p.get("id") == host_id), None)
        player2_player = next((p for p in players if p.get("id") == player2_id), None)

        if host_player:
            print(f"Host team assignment: {host_player.get('team_id')}")
            assert host_player.get("team_id") == "team_a"

        if player2_player:
            print(f"Player2 team assignment: {player2_player.get('team_id')}")
            assert player2_player.get("team_id") == "team_b"

    print("Team mode test passed!")

    # Cleanup
    await host_ws.close()
    await player2_ws.close()
    return True


async def test_timed_attack_mode():
    """Test timed attack mode initialization."""
    print("\n=== Testing Timed Attack Mode ===")

    lobby_id = generate_id(6)
    player_id = generate_id(8)

    # Create lobby
    ws, initial_data = await connect_player(
        lobby_id, player_id, "TimedTestPlayer", mode="create"
    )

    # Drain any pending messages from initial connection
    drained = await drain_messages(ws)
    print(f"Drained {len(drained)} messages from connection")

    # Set game mode to timed_attack
    print("Setting game mode to 'timed_attack'")
    await send_message(
        ws, "set_game_mode", {"game_mode": "timed_attack", "mode_settings": {}}
    )

    # Check lobby update
    update = await receive_message(ws)
    if update and update.get("type") == "lobby_update":
        game_mode = update.get("data", {}).get("game_mode")
        mode_settings = update.get("data", {}).get("mode_settings", {})
        print(f"Game mode set to: {game_mode}")
        print(f"Mode settings: {mode_settings}")
        assert game_mode == "timed_attack"
        # Should have round_duration, powerup_drop_interval, etc.
        assert "round_duration" in mode_settings
        assert mode_settings["round_duration"] == 60
    else:
        print(f"ERROR: No lobby update received, got: {update}")
        return False

    print("Timed attack mode test passed!")
    await ws.close()
    return True


async def test_word_race_mode():
    """Test word race mode initialization."""
    print("\n=== Testing Word Race Mode ===")

    lobby_id = generate_id(6)
    player_id = generate_id(8)

    # Create lobby
    ws, initial_data = await connect_player(
        lobby_id, player_id, "WordRacePlayer", mode="create"
    )

    # Drain any pending messages from initial connection
    drained = await drain_messages(ws)
    print(f"Drained {len(drained)} messages from connection")

    # Set game mode to word_race
    print("Setting game mode to 'word_race'")
    await send_message(
        ws, "set_game_mode", {"game_mode": "word_race", "mode_settings": {}}
    )

    # Check lobby update
    update = await receive_message(ws)
    if update and update.get("type") == "lobby_update":
        game_mode = update.get("data", {}).get("game_mode")
        target_words = update.get("data", {}).get("target_words", [])
        print(f"Game mode set to: {game_mode}")
        print(f"Target words count: {len(target_words)}")
        assert game_mode == "word_race"
        # Target words should be empty until game starts
        assert target_words == []
    else:
        print(f"ERROR: No lobby update received, got: {update}")
        return False

    print("Word race mode test passed!")
    await ws.close()
    return True


async def main():
    """Run all game mode tests."""
    print("Starting Family Boggle Game Modes Integration Tests")
    print("=" * 50)

    # Check if server is running
    try:
        import urllib.request

        with urllib.request.urlopen(f"{BASE_HTTP_URL}/health") as response:
            if response.getcode() != 200:
                print("ERROR: Backend server is not responding")
                return 1
    except Exception as e:
        print(f"ERROR: Cannot connect to backend server: {e}")
        print("Make sure backend is running on port 8000")
        return 1

    results = []

    try:
        # Test team mode
        results.append(await test_team_mode())
    except Exception as e:
        print(f"Team mode test failed with error: {e}")
        import traceback

        traceback.print_exc()
        results.append(False)

    try:
        # Test timed attack mode
        results.append(await test_timed_attack_mode())
    except Exception as e:
        print(f"Timed attack mode test failed with error: {e}")
        import traceback

        traceback.print_exc()
        results.append(False)

    try:
        # Test word race mode
        results.append(await test_word_race_mode())
    except Exception as e:
        print(f"Word race mode test failed with error: {e}")
        import traceback

        traceback.print_exc()
        results.append(False)

    # Summary
    print("\n" + "=" * 50)
    print("TEST SUMMARY:")
    print(f"Team Mode: {'PASS' if results[0] else 'FAIL'}")
    print(f"Timed Attack Mode: {'PASS' if results[1] else 'FAIL'}")
    print(f"Word Race Mode: {'PASS' if results[2] else 'FAIL'}")

    all_passed = all(results)
    print(f"\nOverall: {'ALL TESTS PASSED' if all_passed else 'SOME TESTS FAILED'}")

    return 0 if all_passed else 1


if __name__ == "__main__":
    # Install websockets if not available
    try:
        import websockets
    except ImportError:
        print("Installing websockets library...")
        import subprocess

        subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"])
        import websockets

    exit_code = asyncio.run(main())
    sys.exit(exit_code)
