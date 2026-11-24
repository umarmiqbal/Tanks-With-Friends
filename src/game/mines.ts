export interface MineTank {
  id: string;
  x: number;
  y: number;
  alive: boolean;
}

export interface MineState {
  x: number;
  y: number;
  ownerId: string;
  armingRemaining: number;
  timeoutRemaining: number;
  triggerRadius: number;
  blastRadius: number;
  blinkElapsed: number;
}

export interface MineUpdate {
  mine: MineState;
  detonated: boolean;
}

export function updateMine(
  mine: MineState,
  tanks: readonly MineTank[],
  deltaSeconds: number,
): MineUpdate {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new RangeError("Mine delta must be finite and non-negative.");
  }
  const armingRemaining = Math.max(0, mine.armingRemaining - deltaSeconds);
  const timeoutRemaining = Math.max(0, mine.timeoutRemaining - deltaSeconds);
  const next: MineState = {
    ...mine,
    armingRemaining,
    timeoutRemaining,
    blinkElapsed: mine.blinkElapsed + deltaSeconds,
  };
  if (timeoutRemaining === 0) {
    return { mine: next, detonated: true };
  }
  if (armingRemaining > 0) {
    return { mine: next, detonated: false };
  }
  const triggered = tanks.some((tank) => {
    if (!tank.alive) return false;
    return Math.hypot(tank.x - mine.x, tank.y - mine.y) <= mine.triggerRadius;
  });
  return { mine: next, detonated: triggered };
}
