import { describe, expect, it } from "vitest";
import { config } from "../src/config";
import {
  DoubleShotWeapon,
  HomingMissileWeapon,
  MineWeapon,
  ShotgunWeapon,
  WeaponLoadout,
} from "../src/game/weapons";
import type { WeaponFireContext } from "../src/game/weapons";
import type { BulletState } from "../src/game/bullet";

const fireContext: WeaponFireContext = {
  ownerId: "player-1",
  origin: { x: 10, y: 20 },
  angle: 0,
  activeBullets: [],
  bulletSettings: {
    speed: 100,
    lifetime: 5,
    maxPerTank: 5,
    radius: 2,
    collisionEpsilon: 0.01,
  },
};

describe("weapon loadouts", () => {
  it("preserves the default cannon's single-shot speed and cooldown", () => {
    const loadout = new WeaponLoadout();
    const firstShot = loadout.fire(fireContext);

    expect(firstShot.bullets).toHaveLength(1);
    expect(firstShot.bullets[0]!.velocityX).toBe(100);
    expect(firstShot.bullets[0]!.velocityY).toBeCloseTo(0);
    expect(loadout.fire(fireContext).bullets).toHaveLength(0);

    loadout.update(config.bullet.fireCooldown);
    expect(loadout.fire(fireContext).bullets).toHaveLength(1);
  });

  it("fires two parallel bullets and consumes one special-ammo charge", () => {
    const loadout = new WeaponLoadout();
    loadout.pickUp(new DoubleShotWeapon());

    const fired = loadout.fire(fireContext);

    expect(fired.bullets).toHaveLength(2);
    expect(fired.bullets[0]!.velocityX).toBe(fired.bullets[1]!.velocityX);
    expect(fired.bullets[0]!.velocityY).toBe(fired.bullets[1]!.velocityY);
    expect(Math.abs(fired.bullets[0]!.y - fired.bullets[1]!.y)).toBe(
      config.powerups.doubleShot.barrelSpacing,
    );
    expect(loadout.specialWeapon?.ammoRemaining).toBe(
      config.powerups.doubleShot.ammo - 1,
    );
  });

  it("fires shotgun pellets in a symmetric configurable fan", () => {
    const shotgun = new ShotgunWeapon();
    const result = shotgun.onFire(fireContext);
    const angles = result.map((bullet) =>
      Math.atan2(bullet.velocityY, bullet.velocityX),
    );
    const expectedFirstAngle = -config.powerups.shotgun.spreadAngle / 2;
    const expectedLastAngle = config.powerups.shotgun.spreadAngle / 2;

    expect(result).toHaveLength(config.powerups.shotgun.pelletCount);
    expect(angles[0]).toBeCloseTo(expectedFirstAngle);
    expect(angles.at(-1)).toBeCloseTo(expectedLastAngle);
    for (let index = 0; index < angles.length; index += 1) {
      expect(angles[index]).toBeCloseTo(-angles[angles.length - index - 1]!);
    }
  });

  it("creates homing missiles and mines with the configured timers", () => {
    const homing = new HomingMissileWeapon().onFire(fireContext);
    const mine = new MineWeapon().onFire(fireContext);

    expect(homing).toHaveLength(1);
    expect(homing[0]!.kind).toBe("homing-missile");
    expect(homing[0]!.armingRemaining).toBe(
      config.powerups.homingMissile.armingDelay,
    );
    expect(homing[0]!.turnRate).toBe(config.powerups.homingMissile.turnRate);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.kind).toBe("mine");
    expect(mine[0]!.armingRemaining).toBe(config.powerups.mine.armingDelay);
    expect(mine[0]!.timeoutRemaining).toBe(config.powerups.mine.timeout);
  });

  it("lets all five volleys fire under the special's bullet cap", () => {
    const loadout = new WeaponLoadout();
    loadout.pickUp(new DoubleShotWeapon());
    const activeBullets: BulletState[] = [];

    for (let shot = 0; shot < config.powerups.doubleShot.ammo; shot += 1) {
      const result = loadout.fire({ ...fireContext, activeBullets });

      expect(result.bullets).toHaveLength(2);
      activeBullets.push(...result.bullets);
      if (shot < config.powerups.doubleShot.ammo - 1) {
        loadout.update(config.bullet.fireCooldown);
      }
    }

    expect(activeBullets).toHaveLength(config.powerups.doubleShot.maxBulletsAlive);
    expect(loadout.currentWeapon.type).toBe("cannon");
  });

  it("does not partially fire or spend ammo when its double shot exceeds its cap", () => {
    const loadout = new WeaponLoadout();
    loadout.pickUp(new DoubleShotWeapon());
    const activeBullets = Array.from(
      { length: config.powerups.doubleShot.maxBulletsAlive - 1 },
      (_, index) => ({
        ...fireContext.bulletSettings,
        ownerId: "player-1",
        x: index,
        y: 0,
        velocityX: 100,
        velocityY: 0,
        remainingLifetime: 5,
        bounceCount: 0,
      }),
    );

    const result = loadout.fire({ ...fireContext, activeBullets });

    expect(result.bullets).toHaveLength(0);
    expect(loadout.specialWeapon?.ammoRemaining).toBe(
      config.powerups.doubleShot.ammo,
    );
  });

  it("replaces the held special when another special is collected", () => {
    const loadout = new WeaponLoadout();
    loadout.pickUp(new DoubleShotWeapon());
    loadout.fire(fireContext);
    expect(loadout.specialWeapon?.ammoRemaining).toBe(
      config.powerups.doubleShot.ammo - 1,
    );

    loadout.pickUp(new DoubleShotWeapon());

    expect(loadout.specialWeapon?.ammoRemaining).toBe(
      config.powerups.doubleShot.ammo,
    );
    expect(loadout.currentWeapon.type).toBe("double-shot");
  });

  it("reverts to the default cannon when a special expires by timer or ammo", () => {
    const timedLoadout = new WeaponLoadout();
    timedLoadout.pickUp(new DoubleShotWeapon());
    expect(
      timedLoadout.update(config.powerups.doubleShot.duration),
    ).toBe(true);
    expect(timedLoadout.currentWeapon.type).toBe("cannon");

    const ammoLoadout = new WeaponLoadout();
    ammoLoadout.pickUp(new DoubleShotWeapon());
    for (let shot = 0; shot < config.powerups.doubleShot.ammo; shot += 1) {
      const result = ammoLoadout.fire(fireContext);
      expect(result.bullets).toHaveLength(2);
      if (shot < config.powerups.doubleShot.ammo - 1) {
        ammoLoadout.update(config.bullet.fireCooldown);
      } else {
        expect(result.specialExpired).toBe(true);
      }
    }
    expect(ammoLoadout.currentWeapon.type).toBe("cannon");
  });
});
