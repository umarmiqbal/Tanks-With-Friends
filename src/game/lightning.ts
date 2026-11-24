import type { BeamTarget } from "./laser";
import type { WallRect } from "./tankMovement";

export function segmentIntersectsWall(
  start: { x: number; y: number },
  end: { x: number; y: number },
  wall: WallRect,
): boolean {
  const insideStart =
    start.x >= wall.left &&
    start.x <= wall.right &&
    start.y >= wall.top &&
    start.y <= wall.bottom;
  const insideEnd =
    end.x >= wall.left &&
    end.x <= wall.right &&
    end.y >= wall.top &&
    end.y <= wall.bottom;
  if (insideStart || insideEnd) return true;

  const segments = [
    { a: { x: wall.left, y: wall.top }, b: { x: wall.right, y: wall.top } },
    { a: { x: wall.right, y: wall.top }, b: { x: wall.right, y: wall.bottom } },
    { a: { x: wall.right, y: wall.bottom }, b: { x: wall.left, y: wall.bottom } },
    { a: { x: wall.left, y: wall.bottom }, b: { x: wall.left, y: wall.top } },
  ];
  const cross = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
  ) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (const edge of segments) {
    const c1 = cross(start, end, edge.a);
    const c2 = cross(start, end, edge.b);
    const c3 = cross(edge.a, edge.b, start);
    const c4 = cross(edge.a, edge.b, end);
    if (((c1 > 0 && c2 < 0) || (c1 < 0 && c2 > 0)) &&
        ((c3 > 0 && c4 < 0) || (c3 < 0 && c4 > 0))) {
      return true;
    }
  }
  return false;
}

export function hasLineOfSight(
  start: { x: number; y: number },
  end: { x: number; y: number },
  walls: readonly WallRect[],
): boolean {
  return !walls.some((wall) => segmentIntersectsWall(start, end, wall));
}

export function selectLightningTargets(
  origin: BeamTarget,
  tanks: readonly BeamTarget[],
  walls: readonly WallRect[],
  range: number,
  chainRange: number,
  chainCount: number,
): BeamTarget[] {
  if (
    !Number.isFinite(range) ||
    !Number.isFinite(chainRange) ||
    !Number.isInteger(chainCount) ||
    chainCount < 0
  ) {
    throw new RangeError("Lightning settings must be valid.");
  }
  const selected: BeamTarget[] = [];
  const selectedIds = new Set<string>();
  let current: BeamTarget = origin;
  let currentRange = range;

  while (selected.length < chainCount + 1) {
    let nearest: BeamTarget | null = null;
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;
    for (const tank of tanks) {
      if (!tank.alive || tank.id === origin.id || selectedIds.has(tank.id)) continue;
      const distance = Math.hypot(tank.x - current.x, tank.y - current.y);
      if (distance > currentRange) continue;
      if (!hasLineOfSight(current, tank, walls)) continue;
      const distanceSquared = distance * distance;
      if (distanceSquared < nearestDistanceSquared) {
        nearest = tank;
        nearestDistanceSquared = distanceSquared;
      }
    }
    if (nearest === null) break;
    selected.push(nearest);
    selectedIds.add(nearest.id);
    current = nearest;
    currentRange = chainRange;
  }
  return selected;
}
