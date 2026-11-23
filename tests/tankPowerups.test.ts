import { describe, expect, it } from "vitest";
import { config } from "../src/config";
import {
  advanceTankPowerups,
  applyPassivePowerup,
  applyTankHit,
  createTankPowerupState,
  getTankMovementEffects,
} from "../src/game/tankPowerups";
import {
  createMazeWallRects,
  isTankOverlappingWalls,
  pushTankToNearestOpenSpace,
} from "../src/game/tankMovement";
import type { Maze } from "../src/game/maze";
import { DoubleShotWeapon, WeaponLoadout } from "../src/game/weapons";

const settings = config.powerups.tankEffects;
const invulnerabilityDuration = settings.invulnerabilityDuration;

describe("tank powerups", () => {
  it("destroys a tank when its last hit point is lost", () => {
    const damage = applyTankHit(
      createTankPowerupState(settings),
      invulnerabilityDuration,
    );

    expect(damage.healthDamaged).toBe(true);
    expect(damage.destroyed).toBe(true);
    expect(damage.state.hitPoints).toBe(0);
  });

  it("uses a shield hit before health and expires the shield after absorption", () => {
    const shielded = applyPassivePowerup(
      createTankPowerupState(settings),
      "shield",
      settings,
    );
    const timerExpired = advanceTankPowerups(
      shielded,
      settings.shieldDuration,
    ).state;
    expect(timerExpired.shieldCharges).toBe(0);

    const absorbed = applyTankHit(shielded, invulnerabilityDuration);

    expect(absorbed.shieldAbsorbed).toBe(true);
    expect(absorbed.state.hitPoints).toBe(settings.baseHitPoints);
    expect(absorbed.state.shieldCharges).toBe(0);
    expect(absorbed.state.shieldRemaining).toBe(0);

    const afterInvulnerability = advanceTankPowerups(
      absorbed.state,
      invulnerabilityDuration,
    ).state;
    const nextHit = applyTankHit(afterInvulnerability, invulnerabilityDuration);
    expect(nextHit.healthDamaged).toBe(true);
    expect(nextHit.state.hitPoints).toBe(settings.baseHitPoints - 1);
  });

  it("stacks extra life up to the configured health maximum", () => {
    let state = createTankPowerupState(settings);
    state = applyPassivePowerup(state, "extra-life", settings);
    state = applyPassivePowerup(state, "extra-life", settings);
    state = applyPassivePowerup(state, "extra-life", settings);

    expect(state.hitPoints).toBe(settings.maxHitPoints);
  });

  it("ignores further hits during the invulnerability window", () => {
    let state = applyPassivePowerup(
      createTankPowerupState(settings),
      "extra-life",
      settings,
    );
    state = applyTankHit(state, invulnerabilityDuration).state;
    const ignored = applyTankHit(state, invulnerabilityDuration);

    expect(ignored.healthDamaged).toBe(false);
    expect(ignored.state.hitPoints).toBe(state.hitPoints);

    const afterInvulnerability = advanceTankPowerups(
      ignored.state,
      invulnerabilityDuration,
    ).state;
    const applied = applyTankHit(afterInvulnerability, invulnerabilityDuration);
    expect(applied.healthDamaged).toBe(true);
    expect(applied.state.hitPoints).toBe(state.hitPoints - 1);
  });

  it("does not replace a held special when applying a passive pickup", () => {
    const loadout = new WeaponLoadout();
    const special = new DoubleShotWeapon();
    loadout.pickUp(special);

    applyPassivePowerup(
      createTankPowerupState(settings),
      "speed-boost",
      settings,
    );

    expect(loadout.specialWeapon).toBe(special);
  });

  it("applies speed and turn multipliers only while speed boost is active", () => {
    const baseSettings = {
      moveSpeed: 100,
      turnSpeed: 2,
      radius: 10,
      collisionIterations: 3,
    };
    const boosted = applyPassivePowerup(
      createTankPowerupState(settings),
      "speed-boost",
      settings,
    );
    const effects = getTankMovementEffects(baseSettings, boosted, settings);

    expect(effects.movementSettings.moveSpeed).toBe(
      baseSettings.moveSpeed * settings.speedBoostMoveMultiplier,
    );
    expect(effects.movementSettings.turnSpeed).toBe(
      baseSettings.turnSpeed * settings.speedBoostTurnMultiplier,
    );
    expect(effects.ignoresWalls).toBe(false);
  });

  it("pushes a ghost tank to the nearest open cell when ghost expires in a wall", () => {
    const maze: Maze = {
      columns: 2,
      rows: 1,
      cells: [
        [
          { walls: { top: true, right: true, bottom: true, left: true } },
          { walls: { top: true, right: true, bottom: true, left: false } },
        ],
      ],
    };
    const walls = createMazeWallRects(maze, 100, 10);
    const wallPosition = { x: 100, y: 50, angle: 0 };
    const ghost = applyPassivePowerup(
      createTankPowerupState(settings),
      "ghost",
      settings,
    );
    const ghostMovement = getTankMovementEffects(
      {
        moveSpeed: 100,
        turnSpeed: 2,
        radius: 10,
        collisionIterations: 3,
      },
      ghost,
      settings,
    );
    const update = advanceTankPowerups(ghost, settings.ghostDuration);
    const resolved = update.ghostExpired
      ? pushTankToNearestOpenSpace(wallPosition, maze, 100, 10, walls)
      : wallPosition;

    expect(ghostMovement.ignoresWalls).toBe(true);
    expect(update.ghostExpired).toBe(true);
    expect(isTankOverlappingWalls(resolved, 10, walls)).toBe(false);
    expect(resolved.x).toBe(50);
    expect(resolved.angle).toBe(wallPosition.angle);
  });
});
