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

const projectileSettings = {
  rocketExplosionRadius: config.powerups.rocket.explosionRadius,
  shrapnel: {
    count: config.powerups.fragBomb.shrapnelCount,
    speed: config.powerups.fragBomb.shrapnelSpeed,
    lifetime: config.powerups.fragBomb.shrapnelLifetime,
    radius: config.powerups.fragBomb.shrapnelRadius,
  },
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
      projectileSettings,
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
      projectileSettings,
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
      projectileSettings,
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
      projectileSettings,
    );

    expect(next.tanks[1]!.alive).toBe(true);
    expect(next.tanks[1]!.powerups.hitPoints).toBe(1);
    expect(next.bullets).toHaveLength(0);
  });

  it("rocket blast damages nearby tanks, including its shooter, without bouncing", () => {
    const extraLife = (id: string, x: number): CombatTank => {
      const powerups = applyPassivePowerup(
        createTankPowerupState(config.powerups.tankEffects),
        "extra-life",
        config.powerups.tankEffects,
      );
      return makeTank({ id, x, radius: 1, powerups });
    };
    const state: CombatState = {
      tanks: [extraLife("player-1", 84), extraLife("player-2", 101)],
      bullets: [
        makeBullet({
          kind: "rocket",
          x: 85,
          radius: config.powerups.rocket.radius,
          velocityX: config.powerups.rocket.speed,
        }),
      ],
    };
    const next = advanceCombat(
      state,
      0.2,
      [
        {
          left: 100,
          top: -100,
          right: 102,
          bottom: 100,
        },
      ],
      settings,
      config.powerups.tankEffects.invulnerabilityDuration,
      { ...projectileSettings, rocketExplosionRadius: 8 },
    );

    expect(next.bullets).toHaveLength(0);
    expect(next.tanks[0]!.powerups.hitPoints).toBe(1);
    expect(next.tanks[1]!.powerups.hitPoints).toBe(1);
    expect(next.events).toContainEqual(
      expect.objectContaining({ type: "explosion", ownerId: "player-1" }),
    );
    expect(next.events.some((event) => event.type === "bounce")).toBe(false);
  });

  it("frag bomb fuse spawns configured shrapnel", () => {
    const state: CombatState = {
      tanks: [makeTank({ x: -30 })],
      bullets: [
        makeBullet({
          kind: "frag-bomb",
          x: 0,
          velocityX: config.powerups.fragBomb.speed,
          fuseRemaining: config.powerups.fragBomb.fuse,
          remainingLifetime: config.powerups.fragBomb.lifetime,
        }),
      ],
    };
    const next = advanceCombat(
      state,
      config.powerups.fragBomb.fuse,
      [],
      settings,
      config.powerups.tankEffects.invulnerabilityDuration,
      projectileSettings,
    );

    expect(next.bullets).toHaveLength(config.powerups.fragBomb.shrapnelCount);
    expect(next.bullets.every((bullet) => bullet.kind === "shrapnel")).toBe(true);
    expect(next.bullets[0]!.x).toBeCloseTo(
      config.powerups.fragBomb.speed * config.powerups.fragBomb.fuse,
    );
    expect(next.events).toContainEqual(
      expect.objectContaining({ type: "explosion" }),
    );
  });

  it("frag bomb detonates on tank contact and damages the contacted tank", () => {
    const state: CombatState = {
      tanks: [
        makeTank(),
        makeTank({ id: "player-2", x: 15, y: 0, radius: 3 }),
      ],
      bullets: [
        makeBullet({
          kind: "frag-bomb",
          x: 0,
          velocityX: config.powerups.fragBomb.speed,
          radius: config.powerups.fragBomb.radius,
          fuseRemaining: config.powerups.fragBomb.fuse,
          remainingLifetime: config.powerups.fragBomb.lifetime,
        }),
      ],
    };
    const next = advanceCombat(
      state,
      0.2,
      [],
      settings,
      config.powerups.tankEffects.invulnerabilityDuration,
      projectileSettings,
    );

    expect(next.tanks[1]!.alive).toBe(false);
    expect(next.bullets).toHaveLength(config.powerups.fragBomb.shrapnelCount);
    expect(next.events).toContainEqual(
      expect.objectContaining({ type: "explosion", ownerId: "player-1" }),
    );
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
      projectileSettings,
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
      projectileSettings,
    );

    expect(next.tanks[0]!.alive).toBe(false);
    expect(next.bullets).toHaveLength(1);
  });
});
