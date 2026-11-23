import type { WallRect } from "./tankMovement";

export interface BulletState {
  ownerId: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  remainingLifetime: number;
  bounceCount: number;
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
  bullet: BulletState,
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
    return { bullet: null, hitTankId: null, bounceCount: bullet.bounceCount };
  }

  const activeTime = Math.min(deltaSeconds, bullet.remainingLifetime);
  let remainingTime = activeTime;
  let x = bullet.x;
  let y = bullet.y;
  let velocityX = bullet.velocityX;
  let velocityY = bullet.velocityY;

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
      return {
        bullet: null,
        hitTankId: tankHit.tankId,
        bounceCount: bullet.bounceCount,
      };
    }

    if (hit === null) {
      x += deltaX;
      y += deltaY;
      break;
    }

    x += deltaX * hit.time;
    y += deltaY * hit.time;
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
  if (remainingLifetime <= 0) {
    return { bullet: null, hitTankId: null, bounceCount: bullet.bounceCount };
  }

  return {
    bullet: { ...bullet, x, y, velocityX, velocityY, remainingLifetime },
    hitTankId: null,
    bounceCount: bullet.bounceCount,
  };
}
