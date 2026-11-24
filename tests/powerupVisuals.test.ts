import { describe, expect, it } from "vitest";
import { config } from "../src/config";
import { getPowerupColors } from "../src/game/powerupVisuals";
import type { PowerupType } from "../src/game/tankPowerups";

const powerupTypes: PowerupType[] = config.powerups.crateWeights.map(
  ({ value }) => value,
);

describe("powerup crate colors", () => {
  it("uses each pickup's established icon color for its crate fill and icon", () => {
    const colors = powerupTypes.map((powerup) => {
      const presentation = getPowerupColors(powerup);
      expect(presentation.crate).toBe(
        config.presentation.powerupCrateIconColors[powerup],
      );
      expect(presentation.icon).toBe(presentation.crate);
      return presentation.crate;
    });

    expect(new Set(colors).size).toBe(colors.length);
  });
});
