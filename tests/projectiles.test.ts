import { describe, expect, it } from "vitest";
import { config } from "../src/config";
import { createFragShrapnel } from "../src/game/projectiles";

describe("frag shrapnel", () => {
  it("creates the configured number of evenly spaced bouncing projectiles", () => {
    const shrapnel = createFragShrapnel(
      "player-1",
      { x: 10, y: 20 },
      {
        count: config.powerups.fragBomb.shrapnelCount,
        speed: config.powerups.fragBomb.shrapnelSpeed,
        lifetime: config.powerups.fragBomb.shrapnelLifetime,
        radius: config.powerups.fragBomb.shrapnelRadius,
      },
    );

    expect(shrapnel).toHaveLength(config.powerups.fragBomb.shrapnelCount);
    for (const [index, projectile] of shrapnel.entries()) {
      const angle = Math.atan2(projectile.velocityY, projectile.velocityX);
      const expectedAngle =
        ((index / shrapnel.length) * Math.PI * 2 + Math.PI) %
          (Math.PI * 2) -
        Math.PI;
      expect(
        Math.atan2(
          Math.sin(angle - expectedAngle),
          Math.cos(angle - expectedAngle),
        ),
      ).toBeCloseTo(0);
      expect(projectile.kind).toBe("shrapnel");
      expect(projectile.ownerId).toBe("player-1");
      expect(projectile.x).toBe(10);
      expect(projectile.y).toBe(20);
      expect(projectile.remainingLifetime).toBe(
        config.powerups.fragBomb.shrapnelLifetime,
      );
    }
  });
});
