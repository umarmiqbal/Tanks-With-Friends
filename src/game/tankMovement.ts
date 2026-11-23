import type { PlayerInput } from "../input/InputSource";
import type { Maze } from "./maze";

export interface TankState {
  x: number;
  y: number;
  angle: number;
}

export interface WallRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface TankMovementSettings {
  moveSpeed: number;
  turnSpeed: number;
  radius: number;
  collisionIterations: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

export function createMazeWallRects(
  maze: Maze,
  cellSize: number,
  wallThickness: number,
): WallRect[] {
  const halfThickness = wallThickness / 2;
  const walls: WallRect[] = [];

  for (let row = 0; row < maze.rows; row += 1) {
    for (let column = 0; column < maze.columns; column += 1) {
      const { walls: cellWalls } = maze.cells[row]![column]!;
      const left = column * cellSize;
      const top = row * cellSize;
      const right = left + cellSize;
      const bottom = top + cellSize;

      if (row === 0 && cellWalls.top) {
        walls.push({
          left: left - halfThickness,
          top: top - halfThickness,
          right: right + halfThickness,
          bottom: top + halfThickness,
        });
      }
      if (cellWalls.right) {
        walls.push({
          left: right - halfThickness,
          top: top - halfThickness,
          right: right + halfThickness,
          bottom: bottom + halfThickness,
        });
      }
      if (cellWalls.bottom) {
        walls.push({
          left: left - halfThickness,
          top: bottom - halfThickness,
          right: right + halfThickness,
          bottom: bottom + halfThickness,
        });
      }
      if (column === 0 && cellWalls.left) {
        walls.push({
          left: left - halfThickness,
          top: top - halfThickness,
          right: left + halfThickness,
          bottom: bottom + halfThickness,
        });
      }
    }
  }

  return walls;
}

function resolveCircleAgainstWall(
  x: number,
  y: number,
  radius: number,
  wall: WallRect,
): { x: number; y: number; collided: boolean } {
  const nearestX = clamp(x, wall.left, wall.right);
  const nearestY = clamp(y, wall.top, wall.bottom);
  const differenceX = x - nearestX;
  const differenceY = y - nearestY;
  const distanceSquared = differenceX ** 2 + differenceY ** 2;

  if (distanceSquared >= radius ** 2) {
    return { x, y, collided: false };
  }

  if (distanceSquared === 0) {
    const distances = [
      { distance: x - wall.left, x: wall.left - radius, y },
      { distance: wall.right - x, x: wall.right + radius, y },
      { distance: y - wall.top, x, y: wall.top - radius },
      { distance: wall.bottom - y, x, y: wall.bottom + radius },
    ];
    const nearestSide = distances.reduce((nearest, side) =>
      side.distance < nearest.distance ? side : nearest,
    );
    return { x: nearestSide.x, y: nearestSide.y, collided: true };
  }

  const distance = Math.sqrt(distanceSquared);
  const overlap = radius - distance;
  return {
    x: x + (differenceX / distance) * overlap,
    y: y + (differenceY / distance) * overlap,
    collided: true,
  };
}

function resolveCircleAgainstWalls(
  x: number,
  y: number,
  radius: number,
  walls: readonly WallRect[],
  iterations: number,
): { x: number; y: number } {
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let collided = false;
    for (const wall of walls) {
      const result = resolveCircleAgainstWall(x, y, radius, wall);
      x = result.x;
      y = result.y;
      collided ||= result.collided;
    }
    if (!collided) {
      break;
    }
  }
  return { x, y };
}

export function moveTank(
  tank: TankState,
  input: PlayerInput,
  deltaSeconds: number,
  walls: readonly WallRect[],
  settings: TankMovementSettings,
): TankState {
  const move = clamp(input.move, -1, 1);
  const turn = clamp(input.turn, -1, 1);
  const angle = tank.angle + turn * settings.turnSpeed * deltaSeconds;
  const distance = move * settings.moveSpeed * deltaSeconds;
  const deltaX = Math.cos(angle) * distance;
  const deltaY = Math.sin(angle) * distance;
  const substeps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(deltaX), Math.abs(deltaY)) / settings.radius),
  );
  const stepX = deltaX / substeps;
  const stepY = deltaY / substeps;
  let { x, y } = tank;

  for (let step = 0; step < substeps; step += 1) {
    ({ x, y } = resolveCircleAgainstWalls(
      x + stepX,
      y,
      settings.radius,
      walls,
      settings.collisionIterations,
    ));
    ({ x, y } = resolveCircleAgainstWalls(
      x,
      y + stepY,
      settings.radius,
      walls,
      settings.collisionIterations,
    ));
  }

  return { x, y, angle };
}
