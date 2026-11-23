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

export function advanceCombat(
  state: CombatState,
  deltaSeconds: number,
  walls: readonly WallRect[],
  settings: BulletSettings,
): CombatState {
  const tanks = state.tanks.map((tank) => ({ ...tank }));
  const bullets: BulletState[] = [];

  for (const bullet of state.bullets) {
    const result = advanceBullet(bullet, deltaSeconds, walls, settings, tanks);
    if (result.hitTankId !== null) {
      const hitTank = tanks.find((tank) => tank.id === result.hitTankId);
      if (hitTank !== undefined) {
        hitTank.alive = false;
      }
    } else if (result.bullet !== null) {
      bullets.push(result.bullet);
    }
  }

  return { tanks, bullets };
}
