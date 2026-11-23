import { describe, expect, it } from "vitest";
import {
  advanceBullet,
  traceBulletPath,
  tryCreateBullet,
} from "../src/game/bullet";
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

  it("traces the same bounced path as an actual bullet over the same distance", () => {
    const start = bullet();
    const maxDistance = 50;
    const preview = traceBulletPath(
      start,
      [verticalWall],
      settings.collisionEpsilon,
      4,
      maxDistance,
    );
    const actual = advanceBullet(
      start,
      maxDistance / settings.speed,
      [verticalWall],
      settings,
    );

    expect(preview).toHaveLength(actual.path.length);
    for (const [index, segment] of preview.entries()) {
      expect(segment.start.x).toBeCloseTo(actual.path[index]!.start.x);
      expect(segment.start.y).toBeCloseTo(actual.path[index]!.start.y);
      expect(segment.end.x).toBeCloseTo(actual.path[index]!.end.x);
      expect(segment.end.y).toBeCloseTo(actual.path[index]!.end.y);
    }
  });

  it("detonates a rocket at its first wall contact without reflecting", () => {
    const result = advanceBullet(
      bullet({ kind: "rocket" }),
      0.2,
      [verticalWall],
      settings,
    );

    expect(result.bullet).toBeNull();
    expect(result.bounceCount).toBe(0);
    expect(result.detonation?.x).toBeCloseTo(9);
    expect(result.path).toHaveLength(1);
  });

  it("counts down a frag bomb fuse across fixed updates", () => {
    const frag = bullet({
      kind: "frag-bomb",
      fuseRemaining: 0.05,
    });
    const first = advanceBullet(frag, 0.02, [], settings);
    expect(first.detonation).toBeNull();
    expect(first.bullet?.fuseRemaining).toBeCloseTo(0.03);

    const second = advanceBullet(first.bullet!, 0.03, [], settings);
    expect(second.bullet).toBeNull();
    expect(second.detonation?.x).toBeCloseTo(5);
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
