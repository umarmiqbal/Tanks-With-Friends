import { describe, expect, it } from "vitest";
import { createMazeWallRects, moveTank } from "../src/game/tankMovement";
import type { Maze } from "../src/game/maze";

const settings = {
  moveSpeed: 100,
  turnSpeed: 2,
  radius: 10,
  collisionIterations: 3,
};

const mazeWithDivider: Maze = {
  columns: 2,
  rows: 1,
  cells: [
    [
      { walls: { top: true, right: true, bottom: true, left: true } },
      { walls: { top: true, right: true, bottom: true, left: false } },
    ],
  ],
};

describe("moveTank", () => {
  it("moves forward and rotates at a fixed timestep", () => {
    const walls = createMazeWallRects(mazeWithDivider, 100, 10);
    const start = { x: 50, y: 50, angle: 0 };
    const forward = moveTank(
      start,
      { move: 1, turn: 0, fire: false },
      0.1,
      walls,
      settings,
    );
    const turned = moveTank(
      start,
      { move: 0, turn: -1, fire: false },
      0.5,
      walls,
      settings,
    );

    expect(forward.x).toBeCloseTo(60);
    expect(forward.y).toBeCloseTo(50);
    expect(turned.angle).toBeCloseTo(-1);
    expect(start).toEqual({ x: 50, y: 50, angle: 0 });
  });

  it("stops at a wall and slides along it", () => {
    const walls = createMazeWallRects(mazeWithDivider, 100, 10);
    const moved = moveTank(
      { x: 80, y: 30, angle: Math.PI / 4 },
      { move: 1, turn: 0, fire: false },
      0.5,
      walls,
      settings,
    );

    expect(moved.x).toBeLessThanOrEqual(85);
    expect(moved.y).toBeGreaterThan(30);
  });

  it("does not tunnel through a wall during a large movement step", () => {
    const walls = createMazeWallRects(mazeWithDivider, 100, 10);
    const moved = moveTank(
      { x: 50, y: 50, angle: 0 },
      { move: 1, turn: 0, fire: false },
      2,
      walls,
      settings,
    );

    expect(moved.x).toBeLessThanOrEqual(85);
  });
});
