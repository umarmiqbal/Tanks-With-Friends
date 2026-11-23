import type { SpecialWeaponType } from "./weapons";
import type { TankMovementSettings } from "./tankMovement";

export type PassivePowerupType =
  | "shield"
  | "extra-life"
  | "speed-boost"
  | "ghost";

export type PowerupType = SpecialWeaponType | PassivePowerupType;

export interface TankPowerupState {
  hitPoints: number;
  shieldCharges: number;
  shieldRemaining: number;
  speedBoostRemaining: number;
  ghostRemaining: number;
  invulnerabilityRemaining: number;
}

export interface TankPowerupSettings {
  baseHitPoints: number;
  maxHitPoints: number;
  shieldDuration: number;
  speedBoostDuration: number;
  speedBoostMoveMultiplier: number;
  speedBoostTurnMultiplier: number;
  ghostDuration: number;
  invulnerabilityDuration: number;
}

export interface TankPowerupUpdate {
  state: TankPowerupState;
  ghostExpired: boolean;
}

export interface TankDamageResult {
  state: TankPowerupState;
  shieldAbsorbed: boolean;
  healthDamaged: boolean;
  destroyed: boolean;
}

export interface TankMovementEffects {
  movementSettings: TankMovementSettings;
  ignoresWalls: boolean;
}

export function createTankPowerupState(
  settings: TankPowerupSettings,
): TankPowerupState {
  return {
    hitPoints: settings.baseHitPoints,
    shieldCharges: 0,
    shieldRemaining: 0,
    speedBoostRemaining: 0,
    ghostRemaining: 0,
    invulnerabilityRemaining: 0,
  };
}

export function applyPassivePowerup(
  state: TankPowerupState,
  powerup: PassivePowerupType,
  settings: TankPowerupSettings,
): TankPowerupState {
  switch (powerup) {
    case "shield":
      return {
        ...state,
        shieldCharges: 1,
        shieldRemaining: settings.shieldDuration,
      };
    case "extra-life":
      return {
        ...state,
        hitPoints: Math.min(settings.maxHitPoints, state.hitPoints + 1),
      };
    case "speed-boost":
      return { ...state, speedBoostRemaining: settings.speedBoostDuration };
    case "ghost":
      return { ...state, ghostRemaining: settings.ghostDuration };
    default: {
      const unsupportedPowerup: never = powerup;
      throw new RangeError(`Unknown passive powerup: ${unsupportedPowerup}`);
    }
  }
}

export function advanceTankPowerups(
  state: TankPowerupState,
  deltaSeconds: number,
): TankPowerupUpdate {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new RangeError("Powerup update delta must be finite and non-negative.");
  }

  const shieldRemaining = Math.max(0, state.shieldRemaining - deltaSeconds);
  const ghostRemaining = Math.max(0, state.ghostRemaining - deltaSeconds);
  return {
    state: {
      ...state,
      shieldCharges: shieldRemaining > 0 ? state.shieldCharges : 0,
      shieldRemaining,
      speedBoostRemaining: Math.max(
        0,
        state.speedBoostRemaining - deltaSeconds,
      ),
      ghostRemaining,
      invulnerabilityRemaining: Math.max(
        0,
        state.invulnerabilityRemaining - deltaSeconds,
      ),
    },
    ghostExpired: state.ghostRemaining > 0 && ghostRemaining === 0,
  };
}

export function getTankMovementEffects(
  baseSettings: TankMovementSettings,
  state: TankPowerupState,
  powerupSettings: TankPowerupSettings,
): TankMovementEffects {
  const speedBoostActive = state.speedBoostRemaining > 0;
  return {
    movementSettings: {
      ...baseSettings,
      moveSpeed: speedBoostActive
        ? baseSettings.moveSpeed * powerupSettings.speedBoostMoveMultiplier
        : baseSettings.moveSpeed,
      turnSpeed: speedBoostActive
        ? baseSettings.turnSpeed * powerupSettings.speedBoostTurnMultiplier
        : baseSettings.turnSpeed,
    },
    ignoresWalls: state.ghostRemaining > 0,
  };
}

export function applyTankHit(
  state: TankPowerupState,
  invulnerabilityDuration: number,
): TankDamageResult {
  if (
    !Number.isFinite(invulnerabilityDuration) ||
    invulnerabilityDuration < 0
  ) {
    throw new RangeError(
      "Invulnerability duration must be finite and non-negative.",
    );
  }
  if (state.invulnerabilityRemaining > 0) {
    return {
      state,
      shieldAbsorbed: false,
      healthDamaged: false,
      destroyed: false,
    };
  }

  if (state.shieldCharges > 0 && state.shieldRemaining > 0) {
    return {
      state: {
        ...state,
        shieldCharges: 0,
        shieldRemaining: 0,
        invulnerabilityRemaining: invulnerabilityDuration,
      },
      shieldAbsorbed: true,
      healthDamaged: false,
      destroyed: false,
    };
  }

  const hitPoints = Math.max(0, state.hitPoints - 1);
  return {
    state: {
      ...state,
      hitPoints,
      invulnerabilityRemaining: invulnerabilityDuration,
    },
    shieldAbsorbed: false,
    healthDamaged: true,
    destroyed: hitPoints === 0,
  };
}
