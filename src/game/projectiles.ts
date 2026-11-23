import type { BulletState } from "./bullet";

export interface ShrapnelSettings {
  count: number;
  speed: number;
  lifetime: number;
  radius: number;
}

export function createFragShrapnel(
  ownerId: string,
  origin: { x: number; y: number },
  settings: ShrapnelSettings,
): BulletState[] {
  if (!Number.isInteger(settings.count) || settings.count < 1) {
    throw new RangeError("Shrapnel count must be a positive integer.");
  }
  if (
    !Number.isFinite(settings.speed) ||
    settings.speed <= 0 ||
    !Number.isFinite(settings.lifetime) ||
    settings.lifetime <= 0 ||
    !Number.isFinite(settings.radius) ||
    settings.radius <= 0
  ) {
    throw new RangeError("Shrapnel projectile settings must be positive.");
  }

  return Array.from({ length: settings.count }, (_, index) => {
    const angle = (index / settings.count) * Math.PI * 2;
    return {
      kind: "shrapnel",
      ownerId,
      x: origin.x,
      y: origin.y,
      velocityX: Math.cos(angle) * settings.speed,
      velocityY: Math.sin(angle) * settings.speed,
      radius: settings.radius,
      remainingLifetime: settings.lifetime,
      bounceCount: 0,
    };
  });
}
