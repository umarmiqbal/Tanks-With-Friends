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

M2 renders a generated maze and one keyboard-controlled tank. Multiplayer,
gamepad controls, combat, rounds, and the lobby are planned milestones and are
not implemented yet.
