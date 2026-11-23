# Tanks With Friends — Game Specification

## Goal

Build a local, same-screen, top-down tank game for up to six players. The
placeholder title is **Tanks With Friends**. The game is inspired by the
general maze-tank genre; all visuals and audio are original and generated at
runtime.

## Gameplay

- Each round uses a newly generated grid maze. Generate a connected maze with a
  randomized recursive backtracker, then open a configurable number of
  interior walls to create loops and more open spaces.
- Maze dimensions are configurable and the board scales to the available
  window, including a 1920×1080 display.
- Support up to six tanks, each with a distinct color and a visible player
  number. Tank-style controls rotate and drive forward or backward; a separate
  fire input shoots.
- Bullets travel at constant speed and bounce off walls with continuous swept
  collision detection, so fast bullets do not tunnel through walls. Reflect
  velocity about the wall normal; handle corner contacts sensibly.
- Bullets expire after a configurable lifetime. Each tank has a configurable
  maximum number of live bullets. A hit consumes the bullet and destroys the
  tank, including when a tank is hit by its own bounced shot.
- Approximate tank-wall collision with circles and let tanks slide along walls.
- End a round when at most one tank remains. Award the survivor one point,
  display a brief round-over banner, then create a new maze and respawn all
  players at spread-out positions. End the match at the configured score.
- Keep stretch power-ups (laser, shotgun, shield, homing missile) out of scope
  until explicitly requested.

## Architecture

- Keep simulation logic in pure TypeScript modules without Phaser imports.
  Maze generation, input interpretation, movement, collision, bullets, and
  scoring should be independently testable.
- Use Phaser 3 for presentation and Vite for development and bundling.
- Advance gameplay on a fixed timestep (60 Hz by default), using an accumulator
  so outcomes are independent of rendering frame rate.
- Store gameplay tunables in `src/config.ts`: simulation step; maze dimensions,
  cell size, openings, and wall thickness; tank and bullet parameters;
  score-to-win; input dead zones; and presentation/audio settings.

## Input and lobby

- Every player is driven through an `InputSource` that returns
  `{ move: -1..1, turn: -1..1, fire: boolean }` for each simulation tick.
- Implement keyboard schemes for multiple simultaneous players and gamepad
  input by browser gamepad index using Standard mapping.
- Gamepad input supports the left stick and d-pad, a configurable dead zone,
  and A / right trigger / right bumper for fire. Account for controllers only
  becoming visible after their first button press and listen for connect and
  disconnect events.
- If a controller disconnects mid-match, pause and identify the affected
  player.
- In the lobby, players join by pressing their controller or keyboard scheme's
  fire key. Show a colored card and input device for each joined slot, up to six.
  Start when all intended players have joined and one confirms.

## Visuals and audio

- Draw tank bodies, turrets, bullets, thick maze walls, and explosions
  procedurally with Phaser Graphics.
- Keep visuals high-contrast and readable on a television. Tank color and
  player number both distinguish players.
- Generate fire, bounce, explosion, and round-win sounds with the Web Audio API
  behind one muteable audio module.

## Milestones

1. **M1 — Scaffold and maze:** project docs/tooling, pure maze generator and
   tests, Phaser scene rendering a generated maze.
2. **M2 — Tank movement:** one keyboard-controlled tank, rotation, movement, and
   sliding wall collision.
3. **M3 — Bullets:** firing, lifetime, ammo cap, swept wall bounces, and
   head-on, glancing, corner, and high-speed tunneling tests.
4. **M4 — Gamepad:** `InputSource` abstraction, gamepad handling, one
   gamepad-controlled tank.
5. **M5 — Combat:** multiple tanks, hits, death, and friendly fire.
6. **M6 — Rounds:** respawn, scoring, scoreboard, and match end.
7. **M7 — Lobby:** join-by-button for six players and disconnect handling.
8. **M8 — Polish:** procedural effects, explosion visuals, and audio.

Each milestone is validated with `npx tsc --noEmit`, `npm test`, and
`npm run build`, then committed before playtesting. Work stops at each
milestone boundary for player feedback.

## Decisions

- The initial maze defaults to 15 columns by 9 rows and opens 10 interior walls;
  these defaults provide a legible layout at TV resolutions and remain
  configurable.
- A maze cell is square, with its size reduced uniformly as needed to fit the
  viewport while preserving the maze aspect ratio.
- Keyboard tank controls use forward/back and left/right turn keys: WASD plus
  Space for player one. Six distinct keyboard schemes are configured for later
  lobby use.
- M2's tank starts in the center of the second cell in the top-left row, facing
  right. Simulation and wall collision use maze-cell world units; rendering
  scales the tank together with the maze.
