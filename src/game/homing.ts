export interface HomingTank {
  id: string;
  x: number;
  y: number;
  alive: boolean;
}

export interface HomingMissile {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  ownerId: string;
  armingRemaining: number;
}

export function findNearestHomingTarget(
  missile: HomingMissile,
  tanks: readonly HomingTank[],
): HomingTank | null {
  let nearest: HomingTank | null = null;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;
  for (const tank of tanks) {
    if (!tank.alive) {
      continue;
    }
    if (
      tank.id === missile.ownerId &&
      missile.armingRemaining > 0
    ) {
      continue;
    }
    const deltaX = tank.x - missile.x;
    const deltaY = tank.y - missile.y;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
    if (distanceSquared < nearestDistanceSquared) {
      nearest = tank;
      nearestDistanceSquared = distanceSquared;
    }
  }
  return nearest;
}

export function steerHomingVelocity(
  missile: HomingMissile,
  target: HomingTank,
  turnRate: number,
  deltaSeconds: number,
): { velocityX: number; velocityY: number } {
  if (
    !Number.isFinite(turnRate) ||
    turnRate < 0 ||
    !Number.isFinite(deltaSeconds) ||
    deltaSeconds < 0
  ) {
    throw new RangeError("Homing turn settings must be finite and non-negative.");
  }

  const speed = Math.hypot(missile.velocityX, missile.velocityY);
  if (speed === 0) {
    return { velocityX: 0, velocityY: 0 };
  }
  const desiredAngle = Math.atan2(
    target.y - missile.y,
    target.x - missile.x,
  );
  let currentAngle = Math.atan2(missile.velocityY, missile.velocityX);
  let angleDifference = desiredAngle - currentAngle;
  while (angleDifference > Math.PI) angleDifference -= Math.PI * 2;
  while (angleDifference < -Math.PI) angleDifference += Math.PI * 2;
  const clampedDifference =
    Math.max(-turnRate * deltaSeconds, Math.min(
      turnRate * deltaSeconds,
      angleDifference,
    ));
  const angle = currentAngle + clampedDifference;
  return {
    velocityX: Math.cos(angle) * speed,
    velocityY: Math.sin(angle) * speed,
  };
}
