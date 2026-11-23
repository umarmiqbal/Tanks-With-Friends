import { randomIndex, type RandomSource } from "./random";

export interface MazeCell {
  walls: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
}

export interface Maze {
  columns: number;
  rows: number;
  cells: MazeCell[][];
}

interface Neighbor {
  column: number;
  row: number;
  wall: keyof MazeCell["walls"];
  oppositeWall: keyof MazeCell["walls"];
}

interface Wall {
  column: number;
  row: number;
  wall: keyof MazeCell["walls"];
  neighborColumn: number;
  neighborRow: number;
  oppositeWall: keyof MazeCell["walls"];
}

const neighborsFor = (column: number, row: number): Neighbor[] => [
  { column, row: row - 1, wall: "top", oppositeWall: "bottom" },
  { column: column + 1, row, wall: "right", oppositeWall: "left" },
  { column, row: row + 1, wall: "bottom", oppositeWall: "top" },
  { column: column - 1, row, wall: "left", oppositeWall: "right" },
];

export function generateMaze(
  columns: number,
  rows: number,
  extraOpenings: number,
  random: RandomSource,
): Maze {
  if (!Number.isInteger(columns) || columns < 1) {
    throw new RangeError("Maze columns must be a positive integer.");
  }
  if (!Number.isInteger(rows) || rows < 1) {
    throw new RangeError("Maze rows must be a positive integer.");
  }
  if (!Number.isInteger(extraOpenings) || extraOpenings < 0) {
    throw new RangeError("Extra openings must be a non-negative integer.");
  }

  const cells: MazeCell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => ({
      walls: { top: true, right: true, bottom: true, left: true },
    })),
  );
  const visited = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => false),
  );
  const startColumn = randomIndex(columns, random);
  const startRow = randomIndex(rows, random);
  const stack = [{ column: startColumn, row: startRow }];
  visited[startRow]![startColumn] = true;

  while (stack.length > 0) {
    const current = stack[stack.length - 1]!;
    const unvisitedNeighbors = neighborsFor(current.column, current.row).filter(
      ({ column, row }) =>
        column >= 0 &&
        column < columns &&
        row >= 0 &&
        row < rows &&
        !visited[row]![column],
    );

    if (unvisitedNeighbors.length === 0) {
      stack.pop();
      continue;
    }

    const next = unvisitedNeighbors[randomIndex(unvisitedNeighbors.length, random)]!;
    cells[current.row]![current.column]!.walls[next.wall] = false;
    cells[next.row]![next.column]!.walls[next.oppositeWall] = false;
    visited[next.row]![next.column] = true;
    stack.push({ column: next.column, row: next.row });
  }

  const interiorWalls: Wall[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (column < columns - 1) {
        if (cells[row]![column]!.walls.right) {
          interiorWalls.push({
            column,
            row,
            wall: "right",
            neighborColumn: column + 1,
            neighborRow: row,
            oppositeWall: "left",
          });
        }
      }
      if (row < rows - 1) {
        if (cells[row]![column]!.walls.bottom) {
          interiorWalls.push({
            column,
            row,
            wall: "bottom",
            neighborColumn: column,
            neighborRow: row + 1,
            oppositeWall: "top",
          });
        }
      }
    }
  }

  for (let index = interiorWalls.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1, random);
    [interiorWalls[index], interiorWalls[swapIndex]] = [
      interiorWalls[swapIndex]!,
      interiorWalls[index]!,
    ];
  }

  const openingsToAdd = Math.min(extraOpenings, interiorWalls.length);
  for (const wall of interiorWalls.slice(0, openingsToAdd)) {
    cells[wall.row]![wall.column]!.walls[wall.wall] = false;
    cells[wall.neighborRow]![wall.neighborColumn]!.walls[wall.oppositeWall] =
      false;
  }

  return { columns, rows, cells };
}
