import { describe, expect, it } from "vitest";
import { SoundEffects } from "../src/audio/soundEffects";

describe("SoundEffects", () => {
  it("does not initialize audio while muted and supports toggling mute", () => {
    let contextCreationCount = 0;
    const sound = new SoundEffects(() => {
      contextCreationCount += 1;
      throw new Error("Audio should not be initialized while muted.");
    }, true);

    sound.unlock();
    sound.playFire();
    sound.playBounce();
    sound.playExplosion();
    sound.playRoundWin();
    sound.playPickup();
    sound.playMissileLock();

    expect(sound.isMuted).toBe(true);
    expect(sound.toggleMuted()).toBe(false);
    sound.setMuted(true);
    expect(contextCreationCount).toBe(0);
  });
});
