import { describe, expect, it } from "vitest";
import {
  spawnPowerupCrate,
  tankTouchesCrate,
} from "../src/game/crates";
import type { Maze } from "../src/game/maze";

const maze: Maze = {
  columns: 2,
  rows: 2,
  cells: Array.from({ length: 2 }, () =>
    Array.from({ length: 2 }, () => ({
      walls: { top: true, right: true, bottom: true, left: true },
    })),
  ),
};

const settings = {
  maxCrates: 2,
  cellSize: 96,
  wallThickness: 10,
  crateRadius: 16,
};

const weights = [
  { value: "double-shot", weight: 1 },
  { value: "shield", weight: 1 },
] as const;

describe("powerup crates", () => {
  it("spawns only in valid, unoccupied cells away from living tanks", () => {
    const crate = spawnPowerupCrate(
      maze,
      [{ column: 1, row: 0 }],
      [{ x: 48, y: 48, radius: 22, alive: true }],
      settings,
      weights,
      () => 0,
    );

    expect(crate).toEqual({
      column: 0,
      row: 1,
      powerupId: "double-shot",
    });
    expect(crate!.column).toBeGreaterThanOrEqual(0);
    expect(crate!.column).toBeLessThan(maze.columns);
    expect(crate!.row).toBeGreaterThanOrEqual(0);
    expect(crate!.row).toBeLessThan(maze.rows);
    expect(
      tankTouchesCrate(
        { x: 48, y: 48, radius: 22, alive: true },
        crate!,
        settings.cellSize,
        settings.crateRadius,
      ),
    ).toBe(false);
  });

  it("does not spawn above the configured cap or when every cell is blocked", () => {
    const random = (): number => {
      throw new Error("Random source should not be used when spawning is blocked.");
    };
    const atCapacity = spawnPowerupCrate(
      maze,
      [{ column: 0, row: 0 }, { column: 1, row: 0 }],
      [],
      settings,
      weights,
      random,
    );
    const allCellsOccupiedByTanks = spawnPowerupCrate(
      maze,
      [],
      [
        { x: 48, y: 48, radius: 70, alive: true },
        { x: 144, y: 48, radius: 70, alive: true },
        { x: 48, y: 144, radius: 70, alive: true },
        { x: 144, y: 144, radius: 70, alive: true },
      ],
      settings,
      weights,
      random,
    );

    expect(atCapacity).toBeNull();
    expect(allCellsOccupiedByTanks).toBeNull();
  });

});
