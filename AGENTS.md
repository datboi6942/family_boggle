# AGENTS.md

This file provides essential information for AI agents working in the Family Boggle repository.

## Project Overview

Family Boggle is a multiplayer word game with a Netflix-style dark theme UI. Players swipe letters on a grid to form words, earn points based on letter difficulty, and can use power-ups for competitive advantages.

**Performance Priority**: Smooth, fast animations are the highest priority. GameBoard touch/swipe interactions must feel instant and fluid. All UI transitions and animations should run at 60fps. Avoid heavy re-renders during gameplay.

## Development Commands

### Frontend (React/Vite/TypeScript)
```bash
cd frontend
npm install                # Install dependencies
npm run dev               # Start dev server with HMR (port 5173)
npm run build             # TypeScript check + production build
npm run lint              # ESLint
npm run preview           # Preview production build
```

### Backend (Python/FastAPI)
```bash
cd backend
poetry install            # Install dependencies
poetry run uvicorn family_boggle.main:app --reload  # Dev server (port 8000)
poetry run pytest         # Run all tests
poetry run black .        # Format code (Black)
poetry run ruff check .   # Lint (Ruff)
poetry run mypy .         # Type check
```

### Docker (Full Stack)
```bash
docker-compose up --build -d   # Build and run (frontend: 2727, backend: 2626)
```

### Running Single Tests
- **Backend**: `poetry run pytest -xvs backend/family_boggle/test_file.py::test_function`
- **Frontend**: No test framework currently configured.

## Project Structure

- **Frontend**: `frontend/src/` – React components, stores, contexts, hooks
- **Backend**: `backend/family_boggle/` – FastAPI app, game engine, models
- **Audio**: `audio_generator/` – Python audio synthesis scripts
- **Root**: `docker-compose.yml`, `CLAUDE.md`, `AGENTS.md`

## Code Style Guidelines

### TypeScript/React
- **Strict TypeScript**: `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`
- **ESLint**: Uses recommended configs with `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh`. Run `npm run lint` to check.
- **Imports**: Group in order: React, external libraries, internal modules, relative imports. Use `import type` for types when `verbatimModuleSyntax` is enabled.
- **Naming**: camelCase for variables/functions, PascalCase for components/interfaces/types.
- **Error Handling**: Use try/catch for async operations; log errors appropriately.
- **State Management**: Zustand stores with `useShallow` for performance. Store definitions in `frontend/src/stores/`.
- **Components**: Functional components with hooks. Use `framer-motion` for animations.
- **Tailwind CSS**: Use utility classes; follow existing design system (dark theme, purple accent color #8B5CF6).
- **Performance**: Memoize expensive calculations with `useMemo`, avoid unnecessary re-renders with `useCallback`. iOS-specific optimizations: no CSS transitions on touch events.

### Python/FastAPI
- **Formatting**: Black (line length 88). Run `poetry run black .` before committing.
- **Linting**: Ruff with select rules (E, F, I, N, UP, ASYNC). Run `poetry run ruff check .`
- **Type Checking**: mypy strict mode. Run `poetry run mypy .`
- **Imports**: Standard library → third-party → local modules. Use absolute imports within `family_boggle`.
- **Naming**: snake_case for variables/functions, PascalCase for classes.
- **Error Handling**: Use structured logging (`structlog`). Raise appropriate HTTPExceptions in endpoints.
- **Async/Await**: Use `asyncio` for async operations; ensure proper error handling in WebSocket handlers.
- **Models**: Pydantic v2 models in `models.py` for data validation.
- **Logging**: Use `logger = structlog.get_logger()` and log with key‑value pairs.

## Architecture Patterns

### Frontend
- **State Flow**: Session data persisted via Zustand + sessionStorage. Game status: `join` → `lobby` → `countdown` → `playing` → `waiting` → `summary`
- **WebSocket**: `WebSocketContext` manages connection to `/ws/{lobby_id}/{player_id}` with exponential backoff.
- **Components**: `GameBoard` (touch/swipe), `GameSummary` (results), `JoinScreen` (lobby creation), `Lobby` (ready‑up).
- **Audio**: `AudioContext` for sound effects; audio files in `audio_generator/output/`.

### Backend
- **WebSocket Server**: `main.py` handles `/ws/{lobby_id}/{player_id}`; game loop with countdown, main timer, bonus time.
- **Game Engine**: `GameEngine` class manages lobbies, word validation, scoring.
- **Modules**:
  - `board.py`: Boggle board generation with letter frequency distribution.
  - `dictionary.py`: NLTK‑based word validation.
  - `scoring.py`: Letter‑based scoring (E=1, Q=8, etc.).
  - `challenges.py`: Achievement system with difficulty tiers.
  - `powerups.py`: Freeze, Blowup, Shuffle effects.
- **Data Flow**: Players join via WebSocket → host sets board size → game loop broadcasts timer updates → word submissions validated → powerups affect players → final scores include word points + challenge bonuses.

### Audio Generation
- Python scripts in `audio_generator/`. Run `python generate_all.py` to regenerate sound effects.

## Important Notes
- **Animation Performance**: Any changes to `GameBoard.tsx` must preserve 60fps touch responsiveness. iOS requires CSS‑free transitions during touch.
- **Security**: Never commit secrets (.env, credentials). Use environment variables via `config.py`.
- **Code Quality**: Always run lint and typecheck commands (`npm run lint`, `poetry run black .`, `poetry run ruff check .`, `poetry run mypy .`) before committing.
- **Git Commits**: Only commit changes when explicitly asked by the user.
- **Pull Requests**: Always create PRs for new features/bug fixes so Greptile can review changes.
- **Production Server**: Only accessible via SSH; do not attempt direct commands unless explicitly stated.

## Cursor / Copilot Rules
No custom Cursor or Copilot rules detected. Follow the guidelines above.