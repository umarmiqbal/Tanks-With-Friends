import { describe, expect, it } from "vitest";
import { config } from "../src/config";
import {
  findLaserTargets,
  getLaserBeamPath,
} from "../src/game/laser";
import type { WallRect } from "../src/game/tankMovement";

describe("laser beam geometry", () => {
  it("reflects at walls and includes bounce segments", () => {
    const wall: WallRect = {
      left: 100,
      top: -100,
      right: 110,
      bottom: 100,
    };
    const segments = getLaserBeamPath(
      { x: 50, y: 0 },
      0,
      [wall],
      config.bullet.speed,
      config.bullet.collisionEpsilon,
      3,
      500,
      config.bullet.radius,
    );

    expect(segments.length).toBeGreaterThan(1);
    expect(segments[0]!.end.x).toBeCloseTo(100 - config.bullet.radius);
  });

  it("hits tanks along reflected beam segments", () => {
    const segments = [
      {
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
      },
      {
        start: { x: 100, y: 0 },
        end: { x: 100, y: 100 },
      },
    ];
    const targets = [
      { id: "hit", x: 50, y: 2, radius: 5, alive: true },
      { id: "miss", x: 200, y: 200, radius: 5, alive: true },
    ];

    expect(findLaserTargets(targets, segments).map((target) => target.id)).toEqual([
      "hit",
    ]);
  });
});
