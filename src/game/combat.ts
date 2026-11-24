import {
  advanceBullet,
  type BulletSettings,
  type BulletState,
  type BulletTarget,
} from "./bullet";
import type { WallRect } from "./tankMovement";
import { createFragShrapnel, type ShrapnelSettings } from "./projectiles";
import { applyTankHit, type TankPowerupState } from "./tankPowerups";

export interface CombatTank extends BulletTarget {
  powerups: TankPowerupState;
}

export interface CombatState {
  tanks: CombatTank[];
  bullets: BulletState[];
}

export type CombatEvent =
  | { type: "bounce"; ownerId: string }
  | { type: "explosion"; ownerId: string; x: number; y: number }
  | { type: "tank-destroyed"; tankId: string; x: number; y: number };

export interface CombatUpdate extends CombatState {
  events: CombatEvent[];
}

export interface ProjectileCombatSettings {
  rocketExplosionRadius: number;
  shrapnel: ShrapnelSettings;
}

export function advanceCombat(
  state: CombatState,
  deltaSeconds: number,
  walls: readonly WallRect[],
  settings: BulletSettings,
  invulnerabilityDuration: number,
  projectileSettings: ProjectileCombatSettings,
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
    if (result.detonation !== null) {
      events.push({
        type: "explosion",
        ownerId: bullet.ownerId,
        x: result.detonation.x,
        y: result.detonation.y,
      });
      if (bullet.kind === "rocket") {
        for (const tank of tanks) {
          if (!tank.alive) {
            continue;
          }
          const distance = Math.hypot(
            tank.x - result.detonation.x,
            tank.y - result.detonation.y,
          );
          if (distance <= projectileSettings.rocketExplosionRadius + tank.radius) {
            applyDamage(tank, invulnerabilityDuration, events);
          }
        }
      } else if (bullet.kind === "mine") {
        const blastRadius = bullet.blastRadius ?? 0;
        for (const tank of tanks) {
          if (!tank.alive) continue;
          const distance = Math.hypot(
            tank.x - result.detonation.x,
            tank.y - result.detonation.y,
          );
          if (distance <= blastRadius + tank.radius) {
            applyDamage(tank, invulnerabilityDuration, events);
          }
        }
      } else if (bullet.kind === "frag-bomb") {
        bullets.push(
          ...createFragShrapnel(
            bullet.ownerId,
            result.detonation,
            projectileSettings.shrapnel,
          ),
        );
      }
    }
    if (result.hitTankId !== null) {
      const hitTank = tanks.find((tank) => tank.id === result.hitTankId);
      if (hitTank !== undefined) {
        applyDamage(hitTank, invulnerabilityDuration, events);
      }
    } else if (result.bullet !== null) {
      bullets.push(result.bullet);
    }
  }

  return { tanks, bullets, events };
}

function applyDamage(
  tank: CombatTank,
  invulnerabilityDuration: number,
  events: CombatEvent[],
): void {
  const damage = applyTankHit(tank.powerups, invulnerabilityDuration);
  tank.powerups = damage.state;
  if (damage.destroyed) {
    tank.alive = false;
    events.push({
      type: "tank-destroyed",
      tankId: tank.id,
      x: tank.x,
      y: tank.y,
    });
  }
}
