import type { WallRect } from "./tankMovement";
import { traceBulletPath, type BulletPathSegment } from "./bullet";

export interface BeamTarget {
  id: string;
  x: number;
  y: number;
  radius: number;
  alive: boolean;
}

export function getLaserBeamPath(
  origin: { x: number; y: number },
  angle: number,
  walls: readonly WallRect[],
  speed: number,
  collisionEpsilon: number,
  maxBounces: number,
  maxDistance: number,
  radius: number,
): BulletPathSegment[] {
  return traceBulletPath(
    {
      x: origin.x,
      y: origin.y,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      radius,
    },
    walls,
    collisionEpsilon,
    maxBounces,
    maxDistance,
  );
}

export function distanceToSegment(
  point: { x: number; y: number },
  segment: BulletPathSegment,
): number {
  const deltaX = segment.end.x - segment.start.x;
  const deltaY = segment.end.y - segment.start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - segment.start.x, point.y - segment.start.y);
  }
  const projection =
    ((point.x - segment.start.x) * deltaX +
      (point.y - segment.start.y) * deltaY) /
    lengthSquared;
  const clamped = Math.max(0, Math.min(1, projection));
  const nearestX = segment.start.x + deltaX * clamped;
  const nearestY = segment.start.y + deltaY * clamped;
  return Math.hypot(point.x - nearestX, point.y - nearestY);
}

export function findLaserTargets(
  targets: readonly BeamTarget[],
  segments: readonly BulletPathSegment[],
): BeamTarget[] {
  const hitTargets: BeamTarget[] = [];
  for (const target of targets) {
    if (!target.alive) continue;
    if (
      segments.some(
        (segment) =>
          distanceToSegment(target, segment) <= target.radius,
      )
    ) {
      hitTargets.push(target);
    }
  }
  return hitTargets;
}
