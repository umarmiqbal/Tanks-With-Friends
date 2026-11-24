import { config } from "../config";
import {
  tryCreateBullet,
  type BulletSettings,
  type BulletState,
} from "./bullet";

export type WeaponType =
  | "cannon"
  | "double-shot"
  | "rocket"
  | "shotgun"
  | "frag-bomb"
  | "homing-missile"
  | "mine";
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
        {
          ...context.bulletSettings,
          maxPerTank: config.powerups.doubleShot.maxBulletsAlive,
        },
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

export class RocketWeapon implements Weapon {
  readonly type = "rocket" as const;
  readonly hudIcon = "RKT";
  private currentAmmo: number = config.powerups.rocket.ammo;
  private currentRemainingTime: number = config.powerups.rocket.duration;
  private cooldownRemaining = 0;

  get ammoRemaining(): number {
    return this.currentAmmo;
  }

  get remainingTime(): number {
    return this.currentRemainingTime;
  }

  update(deltaSeconds: number): void {
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - deltaSeconds);
    this.currentRemainingTime = Math.max(
      0,
      this.currentRemainingTime - deltaSeconds,
    );
  }

  onFire(context: WeaponFireContext): BulletState[] {
    if (this.isExpired() || this.cooldownRemaining > 0) {
      return [];
    }
    const bullet = tryCreateBullet(
      context.ownerId,
      context.origin,
      context.angle,
      context.activeBullets,
      {
        ...context.bulletSettings,
        speed: config.powerups.rocket.speed,
        lifetime: config.powerups.rocket.lifetime,
        radius: config.powerups.rocket.radius,
      },
    );
    if (bullet === null) {
      return [];
    }
    bullet.kind = "rocket";
    this.currentAmmo -= 1;
    this.cooldownRemaining = config.bullet.fireCooldown;
    return [bullet];
  }

  isExpired(): boolean {
    return this.currentAmmo <= 0 || this.currentRemainingTime <= 0;
  }
}

export class ShotgunWeapon implements Weapon {
  readonly type = "shotgun" as const;
  readonly hudIcon = "SG";
  private currentAmmo: number = config.powerups.shotgun.ammo;
  private currentRemainingTime: number = config.powerups.shotgun.duration;
  private cooldownRemaining = 0;

  get ammoRemaining(): number {
    return this.currentAmmo;
  }

  get remainingTime(): number {
    return this.currentRemainingTime;
  }

  update(deltaSeconds: number): void {
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - deltaSeconds);
    this.currentRemainingTime = Math.max(
      0,
      this.currentRemainingTime - deltaSeconds,
    );
  }

  onFire(context: WeaponFireContext): BulletState[] {
    if (this.isExpired() || this.cooldownRemaining > 0) {
      return [];
    }
    const bullets: BulletState[] = [];
    const pelletCount = config.powerups.shotgun.pelletCount;
    const settings = {
      ...context.bulletSettings,
      maxPerTank: config.powerups.shotgun.maxBulletsAlive,
      speed: config.powerups.shotgun.speed,
      lifetime: config.powerups.shotgun.lifetime,
      radius: config.powerups.shotgun.radius,
    };
    for (let pellet = 0; pellet < pelletCount; pellet += 1) {
      const spreadPosition =
        pelletCount <= 1 ? 0 : pellet / (pelletCount - 1) - 0.5;
      const bullet = tryCreateBullet(
        context.ownerId,
        context.origin,
        context.angle + spreadPosition * config.powerups.shotgun.spreadAngle,
        [...context.activeBullets, ...bullets],
        settings,
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

export class FragBombWeapon implements Weapon {
  readonly type = "frag-bomb" as const;
  readonly hudIcon = "FRG";
  private currentAmmo: number = config.powerups.fragBomb.ammo;
  private currentRemainingTime: number = config.powerups.fragBomb.duration;
  private cooldownRemaining = 0;

  get ammoRemaining(): number {
    return this.currentAmmo;
  }

  get remainingTime(): number {
    return this.currentRemainingTime;
  }

  update(deltaSeconds: number): void {
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - deltaSeconds);
    this.currentRemainingTime = Math.max(
      0,
      this.currentRemainingTime - deltaSeconds,
    );
  }

  onFire(context: WeaponFireContext): BulletState[] {
    if (this.isExpired() || this.cooldownRemaining > 0) {
      return [];
    }
    const bullet = tryCreateBullet(
      context.ownerId,
      context.origin,
      context.angle,
      context.activeBullets,
      {
        ...context.bulletSettings,
        speed: config.powerups.fragBomb.speed,
        lifetime: config.powerups.fragBomb.lifetime,
        radius: config.powerups.fragBomb.radius,
      },
    );
    if (bullet === null) {
      return [];
    }
    bullet.kind = "frag-bomb";
    bullet.fuseRemaining = config.powerups.fragBomb.fuse;
    this.currentAmmo -= 1;
    this.cooldownRemaining = config.bullet.fireCooldown;
    return [bullet];
  }

  isExpired(): boolean {
    return this.currentAmmo <= 0 || this.currentRemainingTime <= 0;
  }
}

export class HomingMissileWeapon implements Weapon {
  readonly type = "homing-missile" as const;
  readonly hudIcon = "HOM";
  private currentAmmo: number = config.powerups.homingMissile.ammo;
  private currentRemainingTime: number = config.powerups.homingMissile.duration;
  private cooldownRemaining = 0;

  get ammoRemaining(): number {
    return this.currentAmmo;
  }

  get remainingTime(): number {
    return this.currentRemainingTime;
  }

  update(deltaSeconds: number): void {
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - deltaSeconds);
    this.currentRemainingTime = Math.max(
      0,
      this.currentRemainingTime - deltaSeconds,
    );
  }

  onFire(context: WeaponFireContext): BulletState[] {
    if (this.isExpired() || this.cooldownRemaining > 0) return [];
    const bullet = tryCreateBullet(
      context.ownerId,
      context.origin,
      context.angle,
      context.activeBullets,
      {
        ...context.bulletSettings,
        speed: config.powerups.homingMissile.speed,
        lifetime: config.powerups.homingMissile.lifetime,
        radius: config.powerups.homingMissile.radius,
      },
    );
    if (bullet === null) return [];
    bullet.kind = "homing-missile";
    bullet.armingRemaining = config.powerups.homingMissile.armingDelay;
    bullet.turnRate = config.powerups.homingMissile.turnRate;
    this.currentAmmo -= 1;
    this.cooldownRemaining = config.bullet.fireCooldown;
    return [bullet];
  }

  isExpired(): boolean {
    return this.currentAmmo <= 0 || this.currentRemainingTime <= 0;
  }
}

export class MineWeapon implements Weapon {
  readonly type = "mine" as const;
  readonly hudIcon = "MIN";
  private currentAmmo: number = config.powerups.mine.ammo;
  private currentRemainingTime: number = config.powerups.mine.duration;
  private cooldownRemaining = 0;

  get ammoRemaining(): number {
    return this.currentAmmo;
  }

  get remainingTime(): number {
    return this.currentRemainingTime;
  }

  update(deltaSeconds: number): void {
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - deltaSeconds);
    this.currentRemainingTime = Math.max(
      0,
      this.currentRemainingTime - deltaSeconds,
    );
  }

  onFire(context: WeaponFireContext): BulletState[] {
    if (this.isExpired() || this.cooldownRemaining > 0) return [];
    const mine: BulletState = {
      kind: "mine",
      ownerId: context.ownerId,
      x: context.origin.x,
      y: context.origin.y,
      velocityX: 0,
      velocityY: 0,
      radius: config.powerups.mine.radius,
      remainingLifetime: config.powerups.mine.timeout,
      timeoutRemaining: config.powerups.mine.timeout,
      armingRemaining: config.powerups.mine.armingDelay,
      triggerRadius: config.powerups.mine.triggerRadius,
      blastRadius: config.powerups.mine.blastRadius,
      bounceCount: 0,
      blinkElapsed: 0,
    };
    const ownedCount = context.activeBullets.filter(
      (bullet) => bullet.ownerId === context.ownerId,
    ).length;
    if (ownedCount >= context.bulletSettings.maxPerTank) return [];
    this.currentAmmo -= 1;
    this.cooldownRemaining = config.bullet.fireCooldown;
    return [mine];
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
    case "rocket":
      return new RocketWeapon();
    case "shotgun":
      return new ShotgunWeapon();
    case "frag-bomb":
      return new FragBombWeapon();
    case "homing-missile":
      return new HomingMissileWeapon();
    case "mine":
      return new MineWeapon();
    default: {
      const unsupportedType: never = type;
      throw new RangeError(`Unknown special weapon: ${unsupportedType}`);
    }
  }
}
