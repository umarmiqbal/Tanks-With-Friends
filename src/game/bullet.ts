import type { WallRect } from "./tankMovement";

export interface BulletState {
  kind?: "bullet" | "rocket" | "frag-bomb" | "shrapnel";
  ownerId: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  remainingLifetime: number;
  bounceCount: number;
  fuseRemaining?: number;
}

export interface BulletTarget {
  id: string;
  x: number;
  y: number;
  radius: number;
  alive: boolean;
}

export interface BulletAdvanceResult {
  bullet: BulletState | null;
  hitTankId: string | null;
  bounceCount: number;
  detonation: { x: number; y: number } | null;
  path: BulletPathSegment[];
}

export interface BulletPathSegment {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export function createBulletOrigin(
  tank: { x: number; y: number; angle: number },
  tankRadius: number,
  bulletRadius: number,
): { x: number; y: number } {
  const muzzleDistance = tankRadius - bulletRadius;
  return {
    x: tank.x + Math.cos(tank.angle) * muzzleDistance,
    y: tank.y + Math.sin(tank.angle) * muzzleDistance,
  };
}

export interface BulletSettings {
  speed: number;
  lifetime: number;
  maxPerTank: number;
  radius: number;
  collisionEpsilon: number;
}

interface SweepHit {
  time: number;
  normalX: number;
  normalY: number;
}

const getTimeTolerance = (
  deltaX: number,
  deltaY: number,
  collisionEpsilon: number,
): number =>
  collisionEpsilon /
  Math.max(Math.abs(deltaX), Math.abs(deltaY), collisionEpsilon);

const sweepPointAgainstWall = (
  x: number,
  y: number,
  deltaX: number,
  deltaY: number,
  wall: WallRect,
  radius: number,
  timeTolerance: number,
): SweepHit | null => {
  const left = wall.left - radius;
  const right = wall.right + radius;
  const top = wall.top - radius;
  const bottom = wall.bottom + radius;
  let entryTime = Number.NEGATIVE_INFINITY;
  let exitTime = Number.POSITIVE_INFINITY;
  let normalX = 0;
  let normalY = 0;

  const axes = [
    { origin: x, delta: deltaX, minimum: left, maximum: right, normalAxis: "x" },
    { origin: y, delta: deltaY, minimum: top, maximum: bottom, normalAxis: "y" },
  ] as const;

  for (const axis of axes) {
    if (axis.delta === 0) {
      if (axis.origin < axis.minimum || axis.origin > axis.maximum) {
        return null;
      }
      continue;
    }

    const firstTime = (axis.minimum - axis.origin) / axis.delta;
    const secondTime = (axis.maximum - axis.origin) / axis.delta;
    const nearTime = Math.min(firstTime, secondTime);
    const farTime = Math.max(firstTime, secondTime);
    if (nearTime > entryTime + timeTolerance) {
      entryTime = nearTime;
      normalX = axis.normalAxis === "x" ? (axis.delta > 0 ? -1 : 1) : 0;
      normalY = axis.normalAxis === "y" ? (axis.delta > 0 ? -1 : 1) : 0;
    } else if (Math.abs(nearTime - entryTime) <= timeTolerance) {
      if (axis.normalAxis === "x") {
        normalX = axis.delta > 0 ? -1 : 1;
      } else {
        normalY = axis.delta > 0 ? -1 : 1;
      }
    }

    exitTime = Math.min(exitTime, farTime);
    if (entryTime > exitTime + timeTolerance) {
      return null;
    }
  }

  if (
    entryTime < -timeTolerance ||
    entryTime > 1 + timeTolerance ||
    exitTime < 0 ||
    (normalX === 0 && normalY === 0)
  ) {
    return null;
  }

  return {
    time: Math.max(0, Math.min(entryTime, 1)),
    normalX,
    normalY,
  };
};

function findFirstTankHit(
  bullet: BulletState,
  deltaX: number,
  deltaY: number,
  targets: readonly BulletTarget[],
  timeTolerance: number,
): { time: number; tankId: string } | null {
  let firstHit: { time: number; tankId: string } | null = null;
  const movementSquared = deltaX ** 2 + deltaY ** 2;
  if (movementSquared === 0) {
    return null;
  }

  for (const target of targets) {
    if (
      !target.alive ||
      (target.id === bullet.ownerId && bullet.bounceCount === 0)
    ) {
      continue;
    }

    const offsetX = bullet.x - target.x;
    const offsetY = bullet.y - target.y;
    const combinedRadius = bullet.radius + target.radius;
    const startDistanceSquared = offsetX ** 2 + offsetY ** 2;
    let hitTime: number;

    if (startDistanceSquared <= combinedRadius ** 2) {
      hitTime = 0;
    } else {
      const projection = offsetX * deltaX + offsetY * deltaY;
      const discriminant =
        projection ** 2 -
        movementSquared * (startDistanceSquared - combinedRadius ** 2);
      if (projection >= 0 || discriminant < 0) {
        continue;
      }

      hitTime = (-projection - Math.sqrt(discriminant)) / movementSquared;
      if (hitTime < -timeTolerance || hitTime > 1 + timeTolerance) {
        continue;
      }
      hitTime = Math.max(0, Math.min(hitTime, 1));
    }

    if (firstHit === null || hitTime < firstHit.time) {
      firstHit = { time: hitTime, tankId: target.id };
    }
  }

  return firstHit;
}

function findFirstHit(
  bullet: Pick<BulletState, "x" | "y" | "radius">,
  deltaX: number,
  deltaY: number,
  walls: readonly WallRect[],
  collisionEpsilon: number,
): SweepHit | null {
  const timeTolerance = getTimeTolerance(
    deltaX,
    deltaY,
    collisionEpsilon,
  );
  let firstHit: SweepHit | null = null;

  for (const wall of walls) {
    const hit = sweepPointAgainstWall(
      bullet.x,
      bullet.y,
      deltaX,
      deltaY,
      wall,
      bullet.radius,
      timeTolerance,
    );
    if (hit === null) {
      continue;
    }

    if (firstHit === null || hit.time < firstHit.time - timeTolerance) {
      firstHit = hit;
    } else if (Math.abs(hit.time - firstHit.time) <= timeTolerance) {
      firstHit.normalX ||= hit.normalX;
      firstHit.normalY ||= hit.normalY;
    }
  }

  return firstHit;
}

export function tryCreateBullet(
  ownerId: string,
  origin: { x: number; y: number },
  angle: number,
  activeBullets: readonly BulletState[],
  settings: BulletSettings,
): BulletState | null {
  const ownedBulletCount = activeBullets.filter(
    (bullet) => bullet.ownerId === ownerId,
  ).length;
  if (ownedBulletCount >= settings.maxPerTank) {
    return null;
  }

  return {
    ownerId,
    x: origin.x,
    y: origin.y,
    velocityX: Math.cos(angle) * settings.speed,
    velocityY: Math.sin(angle) * settings.speed,
    radius: settings.radius,
    remainingLifetime: settings.lifetime,
    bounceCount: 0,
  };
}

export function advanceBullet(
  bullet: BulletState,
  deltaSeconds: number,
  walls: readonly WallRect[],
  settings: Pick<BulletSettings, "collisionEpsilon">,
  targets: readonly BulletTarget[] = [],
): BulletAdvanceResult {
  if (bullet.remainingLifetime <= 0) {
    return {
      bullet: null,
      hitTankId: null,
      bounceCount: bullet.bounceCount,
      detonation: null,
      path: [],
    };
  }

  const fuseDetonates =
    bullet.kind === "frag-bomb" &&
    bullet.fuseRemaining !== undefined &&
    bullet.fuseRemaining <=
      deltaSeconds +
        Number.EPSILON * Math.max(1, deltaSeconds, bullet.fuseRemaining) &&
    bullet.fuseRemaining <= bullet.remainingLifetime;
  const activeTime = Math.min(
    deltaSeconds,
    bullet.remainingLifetime,
    bullet.kind === "frag-bomb" && bullet.fuseRemaining !== undefined
      ? bullet.fuseRemaining
      : Number.POSITIVE_INFINITY,
  );
  let remainingTime = activeTime;
  let x = bullet.x;
  let y = bullet.y;
  let velocityX = bullet.velocityX;
  let velocityY = bullet.velocityY;
  const path: BulletPathSegment[] = [];

  while (remainingTime > 0) {
    const deltaX = velocityX * remainingTime;
    const deltaY = velocityY * remainingTime;
    const hit = findFirstHit(
      { ...bullet, x, y },
      deltaX,
      deltaY,
      walls,
      settings.collisionEpsilon,
    );
    const timeTolerance = getTimeTolerance(
      deltaX,
      deltaY,
      settings.collisionEpsilon,
    );
    const tankHit = findFirstTankHit(
      { ...bullet, x, y },
      deltaX,
      deltaY,
      targets,
      timeTolerance,
    );

    if (
      tankHit !== null &&
      (hit === null || tankHit.time < hit.time - timeTolerance)
    ) {
      if (bullet.kind === "rocket" || bullet.kind === "frag-bomb") {
        return {
          bullet: null,
          hitTankId: bullet.kind === "frag-bomb" ? tankHit.tankId : null,
          bounceCount: bullet.bounceCount,
          detonation: {
            x: x + deltaX * tankHit.time,
            y: y + deltaY * tankHit.time,
          },
          path: [
            {
              start: { x, y },
              end: {
                x: x + deltaX * tankHit.time,
                y: y + deltaY * tankHit.time,
              },
            },
          ],
        };
      }
      return {
        bullet: null,
        hitTankId: tankHit.tankId,
        bounceCount: bullet.bounceCount,
        detonation: null,
        path: [
          {
            start: { x, y },
            end: {
              x: x + deltaX * tankHit.time,
              y: y + deltaY * tankHit.time,
            },
          },
        ],
      };
    }

    if (hit === null) {
      path.push({
        start: { x, y },
        end: { x: x + deltaX, y: y + deltaY },
      });
      x += deltaX;
      y += deltaY;
      break;
    }

    const start = { x, y };
    x += deltaX * hit.time;
    y += deltaY * hit.time;
    path.push({ start, end: { x, y } });
    if (bullet.kind === "rocket") {
      return {
        bullet: null,
        hitTankId: null,
        bounceCount: bullet.bounceCount,
        detonation: { x, y },
        path,
      };
    }
    if (hit.normalX !== 0) {
      velocityX = -velocityX;
      x += hit.normalX * settings.collisionEpsilon;
    }
    if (hit.normalY !== 0) {
      velocityY = -velocityY;
      y += hit.normalY * settings.collisionEpsilon;
    }
    bullet = { ...bullet, bounceCount: bullet.bounceCount + 1 };
    remainingTime *= 1 - hit.time;
  }

  const remainingLifetime = bullet.remainingLifetime - deltaSeconds;
  if (fuseDetonates) {
    return {
      bullet: null,
      hitTankId: null,
      bounceCount: bullet.bounceCount,
      detonation: { x, y },
      path,
    };
  }
  if (remainingLifetime <= 0) {
    return {
      bullet: null,
      hitTankId: null,
      bounceCount: bullet.bounceCount,
      detonation: null,
      path,
    };
  }

  return {
    bullet: {
      ...bullet,
      x,
      y,
      velocityX,
      velocityY,
      remainingLifetime,
      ...(bullet.kind === "frag-bomb" && bullet.fuseRemaining !== undefined
        ? { fuseRemaining: Math.max(0, bullet.fuseRemaining - deltaSeconds) }
        : {}),
    },
    hitTankId: null,
    bounceCount: bullet.bounceCount,
    detonation: null,
    path,
  };
}

export function traceBulletPath(
  bullet: Pick<BulletState, "x" | "y" | "velocityX" | "velocityY" | "radius">,
  walls: readonly WallRect[],
  collisionEpsilon: number,
  maxBounces: number,
  maxDistance: number,
): BulletPathSegment[] {
  if (
    !Number.isInteger(maxBounces) ||
    maxBounces < 0 ||
    !Number.isFinite(maxDistance) ||
    maxDistance < 0 ||
    !Number.isFinite(collisionEpsilon) ||
    collisionEpsilon <= 0
  ) {
    throw new RangeError("Bullet path settings must be non-negative and finite.");
  }

  const speed = Math.hypot(bullet.velocityX, bullet.velocityY);
  if (speed === 0 || maxDistance === 0) {
    return [];
  }

  let unitX = bullet.velocityX / speed;
  let unitY = bullet.velocityY / speed;
  let x = bullet.x;
  let y = bullet.y;
  let distanceRemaining = maxDistance;
  let bounces = 0;
  const path: BulletPathSegment[] = [];

  while (distanceRemaining > 0) {
    const deltaX = unitX * distanceRemaining;
    const deltaY = unitY * distanceRemaining;
    const hit = findFirstHit(
      { x, y, radius: bullet.radius },
      deltaX,
      deltaY,
      walls,
      collisionEpsilon,
    );
    if (hit === null) {
      path.push({
        start: { x, y },
        end: { x: x + deltaX, y: y + deltaY },
      });
      break;
    }

    const end = { x: x + deltaX * hit.time, y: y + deltaY * hit.time };
    path.push({ start: { x, y }, end });
    if (bounces >= maxBounces) {
      break;
    }
    distanceRemaining *= 1 - hit.time;
    x = end.x + hit.normalX * collisionEpsilon;
    y = end.y + hit.normalY * collisionEpsilon;
    if (hit.normalX !== 0) {
      unitX *= -1;
    }
    if (hit.normalY !== 0) {
      unitY *= -1;
    }
    bounces += 1;
  }

  return path;
}
