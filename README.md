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

M11 builds on the M7 lobby: press **Space**, **Enter**, or another keyboard
scheme's fire key to join, or press any button on a Standard-mapped controller.
A joined player presses that same fire input again to start; all joined
controllers must be connected. Up to six players can join. If a controller
disconnects during a match, play pauses and identifies the affected player
until it reconnects.

The scoreboard is stacked vertically on the right, and the first player to
five points wins. Keyboard schemes and controller mappings are shown in the
lobby. Controllers use the left stick for movement and steering, optional
right-stick horizontal steering, and D-pad overrides; **A**, **RB**, or **RT**
fires. Tanks start with one hit point; bounced bullets can damage their owner.
Crates begin spawning after eight seconds, with at most three active; they do
not spawn on a living tank or another crate. Drive over one to pick it up.
**Double Shot** replaces your current special, fires two parallel bullets per
trigger, and has five volleys or twelve seconds before reverting to the cannon.
The scoreboard shows `[2X]` and remaining volleys. Specials are cleared on
death or round end, and are not dropped.

Passive crates also provide:

- **Shield** — absorbs one hit or expires after its timer; a bubble shows while
  it is active.
- **Extra Life** — adds one hit point for the round, up to three; health pips
  appear near the tank. Hits briefly grant invulnerability.
- **Speed Boost** — temporarily increases movement and turn speed.
- **Ghost** — temporarily lets the tank pass through walls. If it expires
  inside a wall, the tank is moved to the nearest open cell center; bullets
  still hit it.
- **Rocket** — a fast shot that explodes on wall or tank contact, damaging
  nearby tanks, including its shooter.
- **Shotgun** — a fan of short-lived bullets that bounce off walls.
- **Frag Bomb** — a slow bomb that detonates on a fuse or tank contact and
  releases bouncing shrapnel.
- **Aim Guide** — while this timed pickup is active, a subtle dotted preview
  of the bouncing cannon path stays visible continuously through eight bounces.
- **Homing Missile** — a bouncing missile that steers toward the nearest tank
  and becomes able to target its shooter after arming.
- **Mine** — a delayed-arming explosive that blinks when armed, triggers on
  nearby tanks, or detonates after its timeout.

Every crate now has a distinct procedural icon indicating its pickup: paired
shots, rocket, pellet fan, bomb, shield, health cross, speed bolt, ghost, or
aim path.

Tank explosions, crate pickups, glowing bullets, and crate spawn-ins are drawn
procedurally. Fire, bounce, explosion, pickup, and round-win sounds are
synthesized in the browser; click the **SOUND ON/OFF** label in the upper-right
to mute or unmute them.
