import { describe, expect, it } from "vitest";
import { updateMine } from "../src/game/mines";

describe("mines", () => {
  it("does not trigger before arming", () => {
    const mine = {
      x: 10,
      y: 10,
      ownerId: "player-1",
      armingRemaining: 0.5,
      timeoutRemaining: 10,
      triggerRadius: 20,
      blastRadius: 50,
      blinkElapsed: 0,
    };
    expect(
      updateMine(mine, [{ id: "player-2", x: 10, y: 10, alive: true }], 0.1)
        .detonated,
    ).toBe(false);
  });

  it("triggers after arming inside the radius", () => {
    const mine = {
      x: 10,
      y: 10,
      ownerId: "player-1",
      armingRemaining: 0,
      timeoutRemaining: 10,
      triggerRadius: 20,
      blastRadius: 50,
      blinkElapsed: 0,
    };
    expect(
      updateMine(mine, [{ id: "player-2", x: 25, y: 10, alive: true }], 0.1)
        .detonated,
    ).toBe(true);
  });

  it("detonates after timeout", () => {
    const mine = {
      x: 10,
      y: 10,
      ownerId: "player-1",
      armingRemaining: 0,
      timeoutRemaining: 0.05,
      triggerRadius: 20,
      blastRadius: 50,
      blinkElapsed: 0,
    };
    expect(updateMine(mine, [], 0.1).detonated).toBe(true);
  });
});
