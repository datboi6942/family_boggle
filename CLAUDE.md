# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Boggle is a multiplayer word game with a Netflix-style dark theme UI. Players swipe letters on a grid to form words, earn points based on letter difficulty, and can use power-ups for competitive advantages.

## Development Commands

### Frontend (React/Vite/TypeScript)
```bash
cd frontend
npm install      # Install dependencies
npm run dev      # Start dev server with HMR
npm run build    # TypeScript check + production build
npm run lint     # ESLint
```

### Backend (Python/FastAPI)
```bash
cd backend
poetry install          # Install dependencies
poetry run uvicorn family_boggle.main:app --reload  # Dev server on port 8000
poetry run pytest       # Run tests
poetry run black .      # Format code
poetry run ruff check . # Lint
poetry run mypy .       # Type check
```

### Docker (Full Stack)
```bash
docker-compose up --build -d   # Build and run (frontend: 2727, backend: 2626)
```

## Architecture

### Frontend (`frontend/src/`)

**State Management**: Zustand store at `stores/gameStore.ts` manages all game state including:
- Session data (lobbyId, playerId, username, character)
- Game status flow: `join` -> `lobby` -> `countdown` -> `playing` -> `waiting` -> `summary`
- Board state, players, powerups, challenges

**WebSocket Communication**: `contexts/WebSocketContext.tsx` handles all real-time communication:
- Connects via nginx proxy at `/ws/{lobby_id}/{player_id}`
- Handles message types: `lobby_update`, `game_state`, `timer_update`, `word_result`, `game_end`, `powerup_event`, `board_update`
- Includes reconnection logic with exponential backoff

**Key Components**:
- `GameBoard.tsx` - Main game interface with touch/swipe word selection
- `GameSummary.tsx` - End-of-game results with word awards and challenge progress
- `JoinScreen.tsx` - Lobby creation/joining with QR code support
- `Lobby.tsx` - Pre-game player ready-up screen

### Backend (`backend/family_boggle/`)

**WebSocket Server**: `main.py` - FastAPI app handling:
- WebSocket endpoint at `/ws/{lobby_id}/{player_id}`
- Game loop with countdown, main timer, and bonus time phases
- Message routing for word submissions, powerups, ready states

**Game Logic**:
- `game_engine.py` - Core GameEngine class managing lobbies, word validation, scoring
- `board.py` - Boggle board generation with letter frequency distribution
- `dictionary.py` - NLTK-based word validation
- `scoring.py` - Letter-based scoring (E=1, Q=8, etc.)
- `challenges.py` - Achievement system with difficulty tiers (easy/medium/hard/very_hard)
- `powerups.py` - Freeze (bonus time), Blowup (block cells), Shuffle effects

**Data Flow**:
1. Players join lobby via WebSocket with username/character
2. Host sets board size, all players ready up
3. Game loop broadcasts timer updates, validates word submissions
4. Powerups affect individual players or entire lobby
5. Final scores include word points + challenge bonuses

### Audio (`audio_generator/`)
Python scripts generating game audio using synthesis. Run `generate_all.py` to regenerate sound effects.

## Key Patterns

- Frontend uses persisted Zustand state in sessionStorage for session recovery
- Backend uses Pydantic models (`models.py`) for validation
- WebSocket messages follow `{type: string, data: object}` format
- Challenges use inheritance pattern with base `Challenge` class and specialized subclasses
