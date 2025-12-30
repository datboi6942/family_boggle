# Family Boggle - Netflix-Style Multiplayer

A beautiful, animated, multiplayer Boggle game designed for family fun on local networks.

## Features
- **10 Animated Monsters**: Pick your character and play!
- **Multiplayer**: Support for up to 10 players on local network.
- **Custom Scoring**: Letters scored by difficulty (E=1, Q=8, etc.).
- **Power-ups**: Freeze, Blow Up, and Shuffle!
- **Mobile First**: Optimized for iPhones and Samsung phones with touch-swipe selection.
- **Netflix Style**: Smooth animations and aesthetically pleasing dark theme.

## How to Play
1. **Connect**: Everyone joins the same Wi-Fi.
2. **Host**: One person creates a lobby and shares the 8-character code.
3. **Select**: Pick your username and monster character.
4. **Ready**: Everyone hits "Ready" to start the 3-2-1 countdown.
5. **Play**: Swipe over letters to find words. Words 5+ letters long give you random power-ups!
6. **Win**: After 3 minutes, the results show who found the most unique and high-value words.

## Deployment (Docker)
The easiest way to run this on a Raspberry Pi or any local computer:

```bash
docker-compose up --build -d
```

Access the game at `http://<your-ip>` on your mobile browser.

## Tech Stack
- **Frontend**: React, Vite, Tailwind CSS, Framer Motion, Zustand.
- **Backend**: Python, FastAPI, WebSockets, NLTK.

