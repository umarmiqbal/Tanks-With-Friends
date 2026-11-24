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
  maximum number of live bullets. A hit consumes the bullet and damages the
  tank, including when a tank is hit by its own bounced shot. Tanks start with
  one hit point.
- Approximate tank-wall collision with circles and let tanks slide along walls.
- End a round when at most one tank remains. Award the survivor one point,
  display a brief round-over banner, then create a new maze and respawn all
  players at spread-out positions. End the match at the configured score.
- Special weapons and powerups are introduced milestone-by-milestone; see
  **Powerups** below for the current scope.

## Architecture

- Keep simulation logic in pure TypeScript modules without Phaser imports.
  Maze generation, input interpretation, movement, collision, bullets, and
  scoring should be independently testable.
- Use Phaser 3 for presentation and Vite for development and bundling.
- Advance gameplay on a fixed timestep (60 Hz by default), using an accumulator
  so outcomes are independent of rendering frame rate.
- Route gameplay randomness through an injectable seeded random source so
  maze and powerup behavior can be reproduced in tests.
- Store gameplay tunables in `src/config.ts`: simulation step; maze dimensions,
  cell size, openings, and wall thickness; tank and bullet parameters;
  score-to-win; input dead zones; powerup weights and timings; and
  presentation/audio settings.

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
  fire key. A gamepad joins on any button press; keyboard schemes join on their
  configured fire key. Show six player cards with color, player number, input
  device, and connection status. A joined device pressing its join input again
  confirms the start. Only joined devices participate; every joined controller
  must be connected before the match can start.

## Visuals and audio

- Draw tank bodies, turrets, bullets, thick maze walls, and explosions
  procedurally with Phaser Graphics.
- Keep visuals high-contrast and readable on a television. Tank color and
  player number both distinguish players. Show shield bubbles and health pips
  procedurally when applicable.
- Generate fire, bounce, explosion, and round-win sounds with the Web Audio API
  behind one muteable audio module. Powerup pickups also have a distinct sound.

## Powerups

- M9 crates spawn at fixed intervals in valid maze cells, up to a configurable
  simultaneous cap. Weighted selection is driven by the match's seeded random
  source. Crates avoid living tanks and other crates, and animate in.
- A tank keeps its default cannon and at most one special weapon. Collecting a
  special replaces the previous one; death and round end clear the special
  without dropping it. Crates are cleared at round end.
- The M9 placeholder special is **Double Shot**: each trigger fires two parallel
  bullets, consumes one ammo charge, and is limited by both ammo and a timer.
  The scoreboard shows its `[2X]` icon and remaining ammo.
- M10 passive crates provide **Shield**, **Extra Life**, **Speed Boost**, and
  **Ghost**. They apply immediately and do not replace the held special.
- Each powerup crate displays a distinct procedural icon: parallel shots,
  rocket, fan pellets, bomb/fuse, shield, health cross, speed bolt, ghost, or
  dotted aim path.
- **Shield** absorbs one hit before breaking or expiring. **Extra Life** adds
  one hit point for the current round, up to a configurable maximum; a hit
  grants brief invulnerability. **Speed Boost** temporarily increases movement
  and turn speed. **Ghost** temporarily disables tank-wall collision, but
  bullets still hit the tank.
- M11 special weapons are **Rocket**, **Shotgun**, and **Frag Bomb**. Rockets
  travel straight and detonate on first wall or tank contact; the blast damages
  nearby tanks, including the shooter. Shotgun fires a short-lived bouncing
  fan. Frag Bombs detonate on fuse expiry or tank contact and release short-lived
  bouncing shrapnel.
- **Aim Guide** is a timed passive pickup. It continuously shows a subtle
  player-colored dotted preview through up to eight swept wall bounces.
- M12 adds **Homing Missile** and **Mine**. Homing missiles steer toward the
  nearest tank with a limited turn rate, bounce off walls, and become able to
  target their shooter after a short arming delay. Mines arm after a delay,
  detonate inside a trigger radius or at timeout, and use a small radial blast.
- M13 adds **Laser** and **Lightning**. Laser shows a charge telegraph, fires
  an instant reflected beam for a brief visual linger, and destroys tanks along
  all beam segments including the shooter. Lightning instantly hits the nearest
  unobstructed tank, chains through additional nearby tanks, and never targets
  the shooter.

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
9. **M9 — Weapon framework and crates:** default cannon interface, Double Shot,
   weighted crate spawning, pickup feedback, and weapon HUD.
10. **M10 — Defensive and utility powerups:** shield, extra life, speed boost,
    and ghost, with damage and expiry tests.
11. **M11 — Projectile weapons and aim guide:** rocket, shotgun, frag bomb, and
    a bounced-path preview sharing the live projectile collision logic.
12. **M12 — Homing missile and mine:** limited steering, target selection,
    mine arming/triggers, and pure homing/mine tests.
13. **M13 — Laser and lightning:** charge/linger beams, reflected beam geometry,
    line-of-sight lightning selection, and chain limits.

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
- Holding the fire key repeats shots at a configurable cooldown. A bullet starts
  at the edge of its tank's collision circle, and its lifetime and ammo slot
  begin at creation.
- Bullets default to a 5-second lifetime; the value remains configurable in
  `src/config.ts`.
- Gamepads use browser indices, and the lobby scans controller indices 0
  through 5. The left stick keeps both movement and steering; horizontal
  right-stick input optionally overrides steering, and D-pad input takes
  precedence on the same axis. In the lobby any gamepad button can join, while
  A, RB, or RT remains the in-match fire mapping. A joined player confirms the
  start by pressing its join input again; a single joined player may start, but
  all joined controllers must be connected. A disconnect during a match pauses
  play until all affected controllers reconnect.
- Player colors and numbers follow join order and remain assigned for the match.
- Audio is synthesized with Web Audio oscillators and noise; the in-game
  sound toggle mutes every effect.
- One gameplay RNG is seeded when a match starts and shared by maze generation
  and crate placement/selection. Audio noise uses its own seeded source.
- M9 crates first spawn after the configured interval. If the crate cap is
  reached or no valid cell is available, the next attempt waits for another
  interval. On a simultaneous pickup, the earliest joined living player gets
  the crate.
- Double Shot fires parallel projectiles and spends one charge per volley. The
  volley is all-or-nothing if the owner's bullet cap cannot fit both shots.
  Specials reset on death or round end; no weapon crates are dropped.
- To allow all five Double Shot charges to be used without waiting for older
  shots to expire, Double Shot may have up to 10 live bullets; the default
  cannon retains the standard five-bullet cap.
- M10 powerups use equal crate weights. Recollecting Shield, Speed Boost, or
  Ghost refreshes its effect instead of stacking it; an Extra Life crate at
  maximum hit points is consumed without adding health.
- M11 adds all projectile weapons and Aim Guide to the crate table at equal
  weights. Rocket blasts use radial distance and are not blocked by walls.
- Frag Bombs bounce normally until their fuse expires or they contact a tank;
  tank contact damages that tank and also releases shrapnel.
- Aim Guide is a timed passive pickup, does not replace a weapon, and appears
  continuously while active, does not replace a weapon, and predicts up to 8
  standard bouncing bullet reflections even while another special is held.
- The Rocket crate has a slightly higher weight than most crate types.
- Homing missiles use limited turn-rate steering and bounce off walls. The
  shooter becomes a valid target after the arming delay.
- Ghost may leave the maze while active because Ghost disables the normal tank
  wall collision. It remains a funny, all-player-usable behavior for M13.
- A Ghost tank that expires while overlapping a wall is moved to the nearest
  maze-cell center that can fit the tank. This uses a deterministic
  row-then-column tie break.
- Shield absorption also starts the brief invulnerability window, preventing
  another bullet in the same moment from immediately damaging health.
- If all tanks are destroyed in the same round, it is a draw and no player
  receives a point.
- The M6 scoreboard is a vertical list in a reserved right-side column so it
  stays clear of the maze and can accommodate six players.
