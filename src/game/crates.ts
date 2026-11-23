import type { Maze } from "./maze";
import { randomIndex, type RandomSource } from "./random";
import { selectWeighted, type WeightedEntry } from "./weightedSelection";

export interface CrateCell {
  column: number;
  row: number;
}

export interface PowerupCrate<T extends string = string> extends CrateCell {
  powerupId: T;
}

export interface CrateTank {
  x: number;
  y: number;
  radius: number;
  alive: boolean;
}

export interface CrateSpawnSettings {
  maxCrates: number;
  cellSize: number;
  wallThickness: number;
  crateRadius: number;
}

export function spawnPowerupCrate<T extends string>(
  maze: Maze,
  crates: readonly CrateCell[],
  tanks: readonly CrateTank[],
  settings: CrateSpawnSettings,
  weights: readonly WeightedEntry<T>[],
  random: RandomSource,
): PowerupCrate<T> | null {
  if (!Number.isInteger(settings.maxCrates) || settings.maxCrates < 0) {
    throw new RangeError("Maximum crate count must be a non-negative integer.");
  }
  if (crates.length >= settings.maxCrates) {
    return null;
  }
  if (
    !Number.isFinite(settings.cellSize) ||
    settings.cellSize <= 0 ||
    !Number.isFinite(settings.wallThickness) ||
    settings.wallThickness < 0 ||
    !Number.isFinite(settings.crateRadius) ||
    settings.crateRadius < 0 ||
    settings.crateRadius + settings.wallThickness / 2 >=
      settings.cellSize / 2
  ) {
    throw new RangeError("Crate size must fit inside a maze cell.");
  }

  const occupiedCells = new Set(
    crates.map(({ column, row }) => `${column},${row}`),
  );
  const minimumDistanceSquaredForTank = (tank: CrateTank): number =>
    (tank.radius + settings.crateRadius) ** 2;
  const validCells: CrateCell[] = [];

  for (let row = 0; row < maze.rows; row += 1) {
    for (let column = 0; column < maze.columns; column += 1) {
      if (occupiedCells.has(`${column},${row}`)) {
        continue;
      }
      const x = (column + 0.5) * settings.cellSize;
      const y = (row + 0.5) * settings.cellSize;
      const overlapsTank = tanks.some((tank) => {
        if (!tank.alive) {
          return false;
        }
        const distanceX = tank.x - x;
        const distanceY = tank.y - y;
        return (
          distanceX ** 2 + distanceY ** 2 <=
          minimumDistanceSquaredForTank(tank)
        );
      });
      if (!overlapsTank) {
        validCells.push({ column, row });
      }
    }
  }

  if (validCells.length === 0) {
    return null;
  }
  const cell = validCells[randomIndex(validCells.length, random)]!;
  return {
    ...cell,
    powerupId: selectWeighted(weights, random),
  };
}

export function crateCenter(
  crate: CrateCell,
  cellSize: number,
): { x: number; y: number } {
  return {
    x: (crate.column + 0.5) * cellSize,
    y: (crate.row + 0.5) * cellSize,
  };
}

export function tankTouchesCrate(
  tank: CrateTank,
  crate: CrateCell,
  cellSize: number,
  crateRadius: number,
): boolean {
  if (!tank.alive) {
    return false;
  }
  const center = crateCenter(crate, cellSize);
  const distanceX = tank.x - center.x;
  const distanceY = tank.y - center.y;
  return (
    distanceX ** 2 + distanceY ** 2 <= (tank.radius + crateRadius) ** 2
  );
}
