import { describe, expect, it } from "vitest";
import { generateMaze } from "../src/game/maze";

const seededRandom = (seed: number): (() => number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe("generateMaze", () => {
  it("creates a connected maze and keeps shared walls consistent", () => {
    const maze = generateMaze(8, 6, 7, seededRandom(42));
    const reached = new Set(["0,0"]);
    const queue = [{ column: 0, row: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const { walls } = maze.cells[current.row]![current.column]!;
      const neighbors = [
        { column: current.column, row: current.row - 1, wall: "top", opposite: "bottom" },
        { column: current.column + 1, row: current.row, wall: "right", opposite: "left" },
        { column: current.column, row: current.row + 1, wall: "bottom", opposite: "top" },
        { column: current.column - 1, row: current.row, wall: "left", opposite: "right" },
      ] as const;

      for (const neighbor of neighbors) {
        if (walls[neighbor.wall]) {
          continue;
        }
        expect(neighbor.column).toBeGreaterThanOrEqual(0);
        expect(neighbor.column).toBeLessThan(maze.columns);
        expect(neighbor.row).toBeGreaterThanOrEqual(0);
        expect(neighbor.row).toBeLessThan(maze.rows);
        expect(
          maze.cells[neighbor.row]![neighbor.column]!.walls[neighbor.opposite],
        ).toBe(false);
        const key = `${neighbor.column},${neighbor.row}`;
        if (!reached.has(key)) {
          reached.add(key);
          queue.push({ column: neighbor.column, row: neighbor.row });
        }
      }
    }

    expect(reached.size).toBe(maze.columns * maze.rows);
    expect(maze.cells).toHaveLength(maze.rows);
    expect(maze.cells[0]).toHaveLength(maze.columns);
  });

  it("opens the requested number of additional interior walls", () => {
    const columns = 5;
    const rows = 4;
    const openings = 5;
    const maze = generateMaze(columns, rows, openings, seededRandom(7));
    let openInteriorWalls = 0;

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (column < columns - 1 && !maze.cells[row]![column]!.walls.right) {
          openInteriorWalls += 1;
        }
        if (row < rows - 1 && !maze.cells[row]![column]!.walls.bottom) {
          openInteriorWalls += 1;
        }
      }
    }

    expect(openInteriorWalls).toBe(columns * rows - 1 + openings);
  });

  it("rejects invalid dimensions and opening counts", () => {
    expect(() => generateMaze(0, 2, 0)).toThrow(RangeError);
    expect(() => generateMaze(2, 1.5, 0)).toThrow(RangeError);
    expect(() => generateMaze(2, 2, -1)).toThrow(RangeError);
  });
});
