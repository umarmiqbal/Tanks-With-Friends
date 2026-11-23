import { config } from "../config";
import {
  tryCreateBullet,
  type BulletSettings,
  type BulletState,
} from "./bullet";

export type WeaponType = "cannon" | "double-shot";
export type SpecialWeaponType = Exclude<WeaponType, "cannon">;

export interface WeaponFireContext {
  ownerId: string;
  origin: { x: number; y: number };
  angle: number;
  activeBullets: readonly BulletState[];
  bulletSettings: BulletSettings;
}

export interface Weapon {
  readonly type: WeaponType;
  readonly hudIcon: string;
  readonly ammoRemaining: number | null;
  readonly remainingTime: number | null;
  update(deltaSeconds: number): void;
  onFire(context: WeaponFireContext): BulletState[];
  isExpired(): boolean;
}

export class DefaultCannon implements Weapon {
  readonly type = "cannon" as const;
  readonly hudIcon = "C";
  readonly ammoRemaining = null;
  readonly remainingTime = null;
  private cooldownRemaining = 0;

  update(deltaSeconds: number): void {
    this.cooldownRemaining = Math.max(
      0,
      this.cooldownRemaining - deltaSeconds,
    );
  }

  onFire(context: WeaponFireContext): BulletState[] {
    if (this.cooldownRemaining > 0) {
      return [];
    }
    const bullet = tryCreateBullet(
      context.ownerId,
      context.origin,
      context.angle,
      context.activeBullets,
      context.bulletSettings,
    );
    if (bullet === null) {
      return [];
    }
    this.cooldownRemaining = config.bullet.fireCooldown;
    return [bullet];
  }

  isExpired(): boolean {
    return false;
  }

  reset(): void {
    this.cooldownRemaining = 0;
  }
}

export class DoubleShotWeapon implements Weapon {
  readonly type = "double-shot" as const;
  readonly hudIcon = "2X";
  private currentAmmo: number = config.powerups.doubleShot.ammo;
  private currentRemainingTime: number = config.powerups.doubleShot.duration;
  private cooldownRemaining = 0;

  get ammoRemaining(): number {
    return this.currentAmmo;
  }

  get remainingTime(): number {
    return this.currentRemainingTime;
  }

  update(deltaSeconds: number): void {
    this.cooldownRemaining = Math.max(
      0,
      this.cooldownRemaining - deltaSeconds,
    );
    this.currentRemainingTime = Math.max(
      0,
      this.currentRemainingTime - deltaSeconds,
    );
  }

  onFire(context: WeaponFireContext): BulletState[] {
    if (this.isExpired() || this.cooldownRemaining > 0) {
      return [];
    }

    const halfSpacing = config.powerups.doubleShot.barrelSpacing / 2;
    const perpendicularX = -Math.sin(context.angle);
    const perpendicularY = Math.cos(context.angle);
    const bullets: BulletState[] = [];
    for (const direction of [-1, 1]) {
      const bullet = tryCreateBullet(
        context.ownerId,
        {
          x:
            context.origin.x +
            perpendicularX * halfSpacing * direction,
          y:
            context.origin.y +
            perpendicularY * halfSpacing * direction,
        },
        context.angle,
        [...context.activeBullets, ...bullets],
        context.bulletSettings,
      );
      if (bullet === null) {
        return [];
      }
      bullets.push(bullet);
    }

    this.currentAmmo -= 1;
    this.cooldownRemaining = config.bullet.fireCooldown;
    return bullets;
  }

  isExpired(): boolean {
    return this.currentAmmo <= 0 || this.currentRemainingTime <= 0;
  }
}

export class WeaponLoadout {
  readonly defaultCannon = new DefaultCannon();
  private special: Weapon | null = null;

  get currentWeapon(): Weapon {
    return this.special ?? this.defaultCannon;
  }

  get specialWeapon(): Weapon | null {
    return this.special;
  }

  update(deltaSeconds: number): boolean {
    this.defaultCannon.update(deltaSeconds);
    this.special?.update(deltaSeconds);
    if (this.special?.isExpired()) {
      this.special = null;
      return true;
    }
    return false;
  }

  fire(context: WeaponFireContext): {
    bullets: BulletState[];
    specialExpired: boolean;
  } {
    const bullets = this.currentWeapon.onFire(context);
    if (this.special?.isExpired()) {
      this.special = null;
      return { bullets, specialExpired: true };
    }
    return { bullets, specialExpired: false };
  }

  pickUp(weapon: Weapon): void {
    if (weapon.type === "cannon") {
      throw new RangeError("A special pickup cannot replace the default cannon.");
    }
    this.special = weapon;
  }

  clearSpecial(): boolean {
    if (this.special === null) {
      return false;
    }
    this.special = null;
    return true;
  }

  reset(): void {
    this.clearSpecial();
    this.defaultCannon.reset();
  }
}

export function createSpecialWeapon(type: SpecialWeaponType): Weapon {
  switch (type) {
    case "double-shot":
      return new DoubleShotWeapon();
    default: {
      const unsupportedType: never = type;
      throw new RangeError(`Unknown special weapon: ${unsupportedType}`);
    }
  }
}
