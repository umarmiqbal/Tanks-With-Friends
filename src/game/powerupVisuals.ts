import { config } from "../config";
import type { PowerupType } from "./tankPowerups";

export interface PowerupColors {
  crate: number;
  icon: number;
}

export function getPowerupColors(powerup: PowerupType): PowerupColors {
  const color = config.presentation.powerupCrateIconColors[powerup];
  return { crate: color, icon: color };
}
