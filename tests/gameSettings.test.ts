import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "../src/config";
import {
  defaultGameSettings,
  loadGameSettings,
  saveGameSettings,
  updateGameSetting,
  type SettingsStorage,
} from "../src/game/gameSettings";

class MemoryStorage implements SettingsStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("game settings", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads defaults and persists supported settings", () => {
    const storage = new MemoryStorage();
    expect(loadGameSettings(storage)).toEqual({
      settings: defaultGameSettings,
      error: null,
    });

    const saved = {
      powerupsEnabled: false,
      crateSpawnInterval: config.settings.crateSpawnIntervals[0]!,
      scoreToWin: config.settings.maximumScoreToWin,
    };
    saveGameSettings(storage, saved);
    expect(loadGameSettings(storage)).toEqual({ settings: saved, error: null });
  });

  it("falls back to defaults for invalid saved data", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const storage = new MemoryStorage();
    storage.setItem(config.settings.localStorageKey, "{ invalid");

    const result = loadGameSettings(storage);

    expect(result.settings).toEqual(defaultGameSettings);
    expect(result.error).toContain("could not be loaded");
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it("bounds crate frequency and score adjustments", () => {
    const fastest = updateGameSetting(
      { ...defaultGameSettings, crateSpawnInterval: 4 },
      "crateSpawnInterval",
      -1,
    );
    const slowest = updateGameSetting(
      { ...defaultGameSettings, crateSpawnInterval: 12 },
      "crateSpawnInterval",
      1,
    );
    const minimumScore = updateGameSetting(
      { ...defaultGameSettings, scoreToWin: 1 },
      "scoreToWin",
      -1,
    );
    const maximumScore = updateGameSetting(
      { ...defaultGameSettings, scoreToWin: 10 },
      "scoreToWin",
      1,
    );

    expect(fastest.crateSpawnInterval).toBe(
      config.settings.crateSpawnIntervals[0],
    );
    expect(slowest.crateSpawnInterval).toBe(12);
    expect(minimumScore.scoreToWin).toBe(config.settings.minimumScoreToWin);
    expect(maximumScore.scoreToWin).toBe(config.settings.maximumScoreToWin);
  });
});
