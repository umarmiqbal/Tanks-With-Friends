import { describe, expect, it } from "vitest";
import { config } from "../src/config";
import {
  DoubleShotWeapon,
  WeaponLoadout,
} from "../src/game/weapons";
import type { WeaponFireContext } from "../src/game/weapons";

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

  it("does not partially fire or spend ammo when its double shot exceeds the bullet cap", () => {
    const loadout = new WeaponLoadout();
    loadout.pickUp(new DoubleShotWeapon());
    const activeBullets = Array.from({ length: 4 }, (_, index) => ({
      ...fireContext.bulletSettings,
      ownerId: "player-1",
      x: index,
      y: 0,
      velocityX: 100,
      velocityY: 0,
      remainingLifetime: 5,
      bounceCount: 0,
    }));

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
