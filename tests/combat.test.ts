import { describe, expect, it } from "vitest";
import { advanceCombat } from "../src/game/combat";
import type { BulletState, BulletSettings } from "../src/game/bullet";
import type { CombatState } from "../src/game/combat";
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

describe("advanceCombat", () => {
  it("consumes a bullet and destroys the first tank it hits", () => {
    const state: CombatState = {
      tanks: [
        { id: "player-1", x: 0, y: 0, radius: 10, alive: true },
        { id: "player-2", x: 15, y: 0, radius: 3, alive: true },
      ],
      bullets: [makeBullet()],
    };
    const next = advanceCombat(state, 0.2, [], settings);

    expect(next.tanks[1]!.alive).toBe(false);
    expect(next.bullets).toHaveLength(0);
    expect(state.tanks[1]!.alive).toBe(true);
    expect(state.bullets).toHaveLength(1);
  });

  it("does not hit its owner until the bullet has bounced", () => {
    const state: CombatState = {
      tanks: [{ id: "player-1", x: 0, y: 0, radius: 10, alive: true }],
      bullets: [makeBullet()],
    };
    const next = advanceCombat(state, 0.05, [], settings);

    expect(next.tanks[0]!.alive).toBe(true);
    expect(next.bullets).toHaveLength(1);
  });

  it("allows a bounced bullet to hit and destroy its owner", () => {
    const state: CombatState = {
      tanks: [{ id: "player-1", x: -5, y: 0, radius: 3, alive: true }],
      bullets: [makeBullet()],
    };
    const wall: WallRect = {
      left: 10,
      top: -100,
      right: 12,
      bottom: 100,
    };
    const next = advanceCombat(state, 0.2, [wall], settings);

    expect(next.tanks[0]!.alive).toBe(false);
    expect(next.bullets).toHaveLength(0);
  });

  it("ignores tanks that have already been destroyed", () => {
    const state: CombatState = {
      tanks: [{ id: "player-2", x: 15, y: 0, radius: 3, alive: false }],
      bullets: [makeBullet()],
    };
    const next = advanceCombat(state, 0.2, [], settings);

    expect(next.tanks[0]!.alive).toBe(false);
    expect(next.bullets).toHaveLength(1);
  });
});
