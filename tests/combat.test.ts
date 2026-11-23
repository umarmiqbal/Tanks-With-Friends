import { describe, expect, it } from "vitest";
import { advanceCombat } from "../src/game/combat";
import type { CombatTank } from "../src/game/combat";
import type { BulletState, BulletSettings } from "../src/game/bullet";
import type { CombatState } from "../src/game/combat";
import { config } from "../src/config";
import {
  applyPassivePowerup,
  createTankPowerupState,
} from "../src/game/tankPowerups";
import type { WallRect } from "../src/game/tankMovement";

const settings: BulletSettings = {
  speed: 100,
  lifetime: 8,
  maxPerTank: 5,
  radius: 1,
  collisionEpsilon: 0.01,
};

const makeBullet = (overrides: Partial<BulletState> = {}): BulletState => ({
  ownerId: "player-1",
  x: 0,
  y: 0,
  velocityX: 100,
  velocityY: 0,
  radius: 1,
  remainingLifetime: 8,
  bounceCount: 0,
  ...overrides,
});

const makeTank = (overrides: Partial<CombatTank> = {}): CombatTank => ({
  id: "player-1",
  x: 0,
  y: 0,
  radius: 10,
  alive: true,
  powerups: createTankPowerupState(config.powerups.tankEffects),
  ...overrides,
});

describe("advanceCombat", () => {
  it("consumes a bullet and destroys the first tank it hits", () => {
    const state: CombatState = {
      tanks: [
        makeTank(),
        makeTank({ id: "player-2", x: 15, y: 0, radius: 3 }),
      ],
      bullets: [makeBullet()],
    };
    const next = advanceCombat(
      state,
      0.2,
      [],
      settings,
      config.powerups.tankEffects.invulnerabilityDuration,
    );

    expect(next.tanks[1]!.alive).toBe(false);
    expect(next.bullets).toHaveLength(0);
    expect(next.events).toContainEqual({
      type: "tank-destroyed",
      tankId: "player-2",
      x: 15,
      y: 0,
    });
    expect(state.tanks[1]!.alive).toBe(true);
    expect(state.bullets).toHaveLength(1);
  });

  it("does not hit its owner until the bullet has bounced", () => {
    const state: CombatState = {
      tanks: [makeTank()],
      bullets: [makeBullet()],
    };
    const next = advanceCombat(
      state,
      0.05,
      [],
      settings,
      config.powerups.tankEffects.invulnerabilityDuration,
    );

    expect(next.tanks[0]!.alive).toBe(true);
    expect(next.bullets).toHaveLength(1);
  });

  it("allows a bounced bullet to hit and destroy its owner", () => {
    const state: CombatState = {
      tanks: [makeTank({ x: -5, radius: 3 })],
      bullets: [makeBullet()],
    };
    const wall: WallRect = {
      left: 10,
      top: -100,
      right: 12,
      bottom: 100,
    };
    const next = advanceCombat(
      state,
      0.2,
      [wall],
      settings,
      config.powerups.tankEffects.invulnerabilityDuration,
    );

    expect(next.tanks[0]!.alive).toBe(false);
    expect(next.bullets).toHaveLength(0);
    expect(next.events).toContainEqual({
      type: "bounce",
      ownerId: "player-1",
    });
  });

  it("consumes a second same-step bullet during the invulnerability window", () => {
    const powerups = applyPassivePowerup(
      createTankPowerupState(config.powerups.tankEffects),
      "extra-life",
      config.powerups.tankEffects,
    );
    const state: CombatState = {
      tanks: [
        makeTank(),
        makeTank({ id: "player-2", x: 15, radius: 3, powerups }),
      ],
      bullets: [makeBullet(), makeBullet()],
    };

    const next = advanceCombat(
      state,
      0.2,
      [],
      settings,
      config.powerups.tankEffects.invulnerabilityDuration,
    );

    expect(next.tanks[1]!.alive).toBe(true);
    expect(next.tanks[1]!.powerups.hitPoints).toBe(1);
    expect(next.bullets).toHaveLength(0);
  });

  it("reports a bounce even when the bullet is consumed later in the same step", () => {
    const state: CombatState = {
      tanks: [makeTank({ id: "player-2", radius: 3 })],
      bullets: [makeBullet({ x: 5, velocityX: 100 })],
    };
    const wall: WallRect = {
      left: 10,
      top: -100,
      right: 12,
      bottom: 100,
    };
    const next = advanceCombat(
      state,
      0.2,
      [wall],
      settings,
      config.powerups.tankEffects.invulnerabilityDuration,
    );

    expect(next.bullets).toHaveLength(0);
    expect(next.events).toContainEqual({
      type: "bounce",
      ownerId: "player-1",
    });
    expect(next.events).toContainEqual({
      type: "tank-destroyed",
      tankId: "player-2",
      x: 0,
      y: 0,
    });
  });

  it("ignores tanks that have already been destroyed", () => {
    const state: CombatState = {
      tanks: [
        makeTank({ id: "player-2", x: 15, y: 0, radius: 3, alive: false }),
      ],
      bullets: [makeBullet()],
    };
    const next = advanceCombat(
      state,
      0.2,
      [],
      settings,
      config.powerups.tankEffects.invulnerabilityDuration,
    );

    expect(next.tanks[0]!.alive).toBe(false);
    expect(next.bullets).toHaveLength(1);
  });
});
