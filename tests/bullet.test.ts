import { describe, expect, it } from "vitest";
import { advanceBullet, tryCreateBullet } from "../src/game/bullet";
import type { BulletSettings, BulletState } from "../src/game/bullet";
import type { WallRect } from "../src/game/tankMovement";

const settings: BulletSettings = {
  speed: 100,
  lifetime: 8,
  maxPerTank: 2,
  radius: 1,
  collisionEpsilon: 0.01,
};

const verticalWall: WallRect = {
  left: 10,
  top: -100,
  right: 12,
  bottom: 100,
};

const bullet = (
  overrides: Partial<BulletState> = {},
): BulletState => ({
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

describe("advanceBullet", () => {
  it("reflects a head-on hit", () => {
    const { bullet: advanced } = advanceBullet(
      bullet(),
      0.2,
      [verticalWall],
      settings,
    );

    expect(advanced).not.toBeNull();
    expect(advanced!.velocityX).toBe(-100);
    expect(advanced!.x).toBeLessThan(9);
  });

  it("reflects only the normal component on a glancing hit", () => {
    const { bullet: advanced } = advanceBullet(
      bullet({ velocityY: 50 }),
      0.2,
      [verticalWall],
      settings,
    );

    expect(advanced).not.toBeNull();
    expect(advanced!.velocityX).toBe(-100);
    expect(advanced!.velocityY).toBe(50);
    expect(advanced!.y).toBeCloseTo(10);
  });

  it("reflects both velocity components at a corner", () => {
    const corner: WallRect = { left: 10, top: 10, right: 12, bottom: 12 };
    const { bullet: advanced } = advanceBullet(
      bullet({ velocityY: 100 }),
      0.2,
      [corner],
      settings,
    );

    expect(advanced).not.toBeNull();
    expect(advanced!.velocityX).toBe(-100);
    expect(advanced!.velocityY).toBe(-100);
    expect(advanced!.x).toBeLessThan(9);
    expect(advanced!.y).toBeLessThan(9);
  });

  it("detects a wall crossed in one fast frame", () => {
    const { bullet: advanced } = advanceBullet(
      bullet({ velocityX: 1000 }),
      0.02,
      [verticalWall],
      settings,
    );

    expect(advanced).not.toBeNull();
    expect(advanced!.velocityX).toBe(-1000);
    expect(advanced!.x).toBeLessThan(9);
  });

  it("expires after its lifetime, even when the update exceeds the remaining time", () => {
    const { bullet: advanced } = advanceBullet(
      bullet({ remainingLifetime: 0.05 }),
      0.1,
      [],
      settings,
    );

    expect(advanced).toBeNull();
  });

  it("decreases lifetime while moving", () => {
    const { bullet: advanced } = advanceBullet(
      bullet({ remainingLifetime: 0.2 }),
      0.05,
      [],
      settings,
    );

    expect(advanced).not.toBeNull();
    expect(advanced!.x).toBeCloseTo(5);
    expect(advanced!.remainingLifetime).toBeCloseTo(0.15);
  });

  it("allows no more than the configured number of bullets per owner", () => {
    const first = tryCreateBullet("player-1", { x: 0, y: 0 }, 0, [], settings);
    const second = tryCreateBullet(
      "player-1",
      { x: 0, y: 0 },
      0,
      [first!],
      settings,
    );
    const third = tryCreateBullet(
      "player-1",
      { x: 0, y: 0 },
      0,
      [first!, second!],
      settings,
    );
    const otherOwner = tryCreateBullet(
      "player-2",
      { x: 0, y: 0 },
      0,
      [first!, second!],
      settings,
    );

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(third).toBeNull();
    expect(otherOwner).not.toBeNull();
  });
});
