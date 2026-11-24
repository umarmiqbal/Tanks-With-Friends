import { describe, expect, it } from "vitest";
import {
  findNearestHomingTarget,
  steerHomingVelocity,
} from "../src/game/homing";

describe("homing missiles", () => {
  it("selects the nearest alive tank and excludes the owner while arming", () => {
    const missile = {
      x: 0,
      y: 0,
      velocityX: 100,
      velocityY: 0,
      ownerId: "player-1",
      armingRemaining: 0.2,
    };
    const target = findNearestHomingTarget(missile, [
      { id: "player-1", x: 1, y: 0, alive: true },
      { id: "player-2", x: 30, y: 0, alive: true },
      { id: "player-3", x: 20, y: 20, alive: false },
    ]);

    expect(target?.id).toBe("player-2");
  });

  it("includes the owner after arming", () => {
    const missile = {
      x: 0,
      y: 0,
      velocityX: 100,
      velocityY: 0,
      ownerId: "player-1",
      armingRemaining: 0,
    };
    const target = findNearestHomingTarget(missile, [
      { id: "player-1", x: 2, y: 0, alive: true },
      { id: "player-2", x: 50, y: 0, alive: true },
    ]);

    expect(target?.id).toBe("player-1");
  });

  it("limits steering by the configured turn rate", () => {
    const missile = {
      x: 0,
      y: 0,
      velocityX: 100,
      velocityY: 0,
      ownerId: "player-1",
      armingRemaining: 0,
    };
    const steered = steerHomingVelocity(
      missile,
      { id: "player-2", x: 0, y: 100, alive: true },
      Math.PI / 4,
      0.1,
    );
    const angle = Math.atan2(steered.velocityY, steered.velocityX);

    expect(angle).toBeCloseTo(Math.PI / 4 / 10 * 1);
  });

  it("expires with the missile lifetime", () => {
    const missile = {
      x: 0,
      y: 0,
      velocityX: 100,
      velocityY: 0,
      ownerId: "player-1",
      armingRemaining: 0,
    };
    const target = findNearestHomingTarget(missile, []);
    expect(target).toBeNull();
  });
});
