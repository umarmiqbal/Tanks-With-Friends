import { config } from "../config";

export interface GameSettings {
  powerupsEnabled: boolean;
  crateSpawnInterval: number;
  scoreToWin: number;
}

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SettingsLoadResult {
  settings: GameSettings;
  error: string | null;
}

export function createBrowserSettingsStorage(): SettingsStorage {
  return {
    getItem: (key) => globalThis.localStorage.getItem(key),
    setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  };
}

export const defaultGameSettings: GameSettings = {
  powerupsEnabled: config.settings.defaultPowerupsEnabled,
  crateSpawnInterval: config.powerups.crateSpawnInterval,
  scoreToWin: config.match.scoreToWin,
};

function isGameSettings(value: unknown): value is GameSettings {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const settings = value as Partial<GameSettings>;
  return (
    typeof settings.powerupsEnabled === "boolean" &&
    typeof settings.crateSpawnInterval === "number" &&
    config.settings.crateSpawnIntervals.some(
      (interval) => interval === settings.crateSpawnInterval,
    ) &&
    typeof settings.scoreToWin === "number" &&
    Number.isInteger(settings.scoreToWin) &&
    settings.scoreToWin >= config.settings.minimumScoreToWin &&
    settings.scoreToWin <= config.settings.maximumScoreToWin
  );
}

export function loadGameSettings(
  storage: SettingsStorage,
): SettingsLoadResult {
  try {
    const saved = storage.getItem(config.settings.localStorageKey);
    if (saved === null) {
      return { settings: { ...defaultGameSettings }, error: null };
    }

    const parsed: unknown = JSON.parse(saved);
    if (!isGameSettings(parsed)) {
      return {
        settings: { ...defaultGameSettings },
        error: "Saved settings are invalid. Defaults are being used.",
      };
    }
    return { settings: { ...parsed }, error: null };
  } catch (error) {
    console.error("Unable to load saved game settings.", error);
    return {
      settings: { ...defaultGameSettings },
      error: "Settings could not be loaded. Defaults are being used.",
    };
  }
}

export function saveGameSettings(
  storage: SettingsStorage,
  settings: GameSettings,
): void {
  if (!isGameSettings(settings)) {
    throw new RangeError("Cannot save invalid game settings.");
  }
  storage.setItem(
    config.settings.localStorageKey,
    JSON.stringify(settings),
  );
}

export function updateGameSetting(
  settings: GameSettings,
  field: keyof GameSettings,
  direction: -1 | 1,
): GameSettings {
  if (field === "powerupsEnabled") {
    return { ...settings, powerupsEnabled: !settings.powerupsEnabled };
  }
  if (field === "crateSpawnInterval") {
    const currentIndex = config.settings.crateSpawnIntervals.findIndex(
      (interval) => interval === settings.crateSpawnInterval,
    );
    const nextIndex = Math.max(
      0,
      Math.min(
        config.settings.crateSpawnIntervals.length - 1,
        currentIndex + direction,
      ),
    );
    return {
      ...settings,
      crateSpawnInterval: config.settings.crateSpawnIntervals[nextIndex]!,
    };
  }
  return {
    ...settings,
    scoreToWin: Math.max(
      config.settings.minimumScoreToWin,
      Math.min(
        config.settings.maximumScoreToWin,
        settings.scoreToWin + direction * config.settings.scoreToWinStep,
      ),
    ),
  };
}
