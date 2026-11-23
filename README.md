# Tanks With Friends

A local multiplayer top-down tank game for up to six players sharing one screen.
All game art is drawn at runtime; no external game assets are required.

## Requirements

- Node.js LTS (the project was scaffolded with Node.js 26 LTS)
- npm

With [nvm](https://github.com/nvm-sh/nvm), select the latest LTS release:

```sh
nvm install --lts
nvm use --lts
```

## Install and run

```sh
npm install
npm run dev
```

Vite listens on `http://localhost:5173` and binds to all interfaces, so it can
be opened from a Windows browser when the project is running in WSL2.

## Test and build

```sh
npm test
npx tsc --noEmit
npm run build
```

The test suite uses Vitest. The production build is written to `dist/`.

## Current milestone

M6 renders a generated maze with two tanks, combat, rounds, and a scoreboard.
The first player to five points wins. Player 1 uses the
gamepad at index 0 when active, or **W/S** to drive, **A/D** to turn, and
**Space** to fire. Player 2 uses the arrow keys to drive/turn and **Enter** to
fire. On a Standard-mapped gamepad, the left stick drives and turns; horizontal
right-stick input optionally steers, and the D-pad overrides stick input.
**A**, **RB**, or **RT** fires. One hit destroys a tank, including its own
bounced bullets. Disconnecting a detected controller pauses until it
reconnects. The lobby and presentation/audio polish remain planned milestones.
