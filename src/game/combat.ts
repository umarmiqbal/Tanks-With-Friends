import {
  advanceBullet,
  type BulletSettings,
  type BulletState,
  type BulletTarget,
} from "./bullet";
import type { WallRect } from "./tankMovement";

export interface CombatState {
  tanks: BulletTarget[];
  bullets: BulletState[];
}

export type CombatEvent =
  | { type: "bounce"; ownerId: string }
  | { type: "tank-destroyed"; tankId: string; x: number; y: number };

export interface CombatUpdate extends CombatState {
  events: CombatEvent[];
}

export function advanceCombat(
  state: CombatState,
  deltaSeconds: number,
  walls: readonly WallRect[],
  settings: BulletSettings,
): CombatUpdate {
  const tanks = state.tanks.map((tank) => ({ ...tank }));
  const bullets: BulletState[] = [];
  const events: CombatEvent[] = [];

  for (const bullet of state.bullets) {
    const result = advanceBullet(bullet, deltaSeconds, walls, settings, tanks);
    for (
      let bounce = bullet.bounceCount;
      bounce < result.bounceCount;
      bounce += 1
    ) {
      events.push({ type: "bounce", ownerId: bullet.ownerId });
    }
    if (result.hitTankId !== null) {
      const hitTank = tanks.find((tank) => tank.id === result.hitTankId);
      if (hitTank !== undefined) {
        hitTank.alive = false;
        events.push({
          type: "tank-destroyed",
          tankId: hitTank.id,
          x: hitTank.x,
          y: hitTank.y,
        });
      }
    } else if (result.bullet !== null) {
      bullets.push(result.bullet);
    }
  }

  return { tanks, bullets, events };
}
