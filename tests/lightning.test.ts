import { describe, expect, it } from "vitest";
import {
  hasLineOfSight,
  selectLightningTargets,
} from "../src/game/lightning";
import type { WallRect } from "../src/game/tankMovement";

describe("lightning targeting", () => {
  const wall: WallRect = {
    left: 100,
    top: -100,
    right: 110,
    bottom: 100,
  };

  it("blocks targets behind walls", () => {
    expect(
      hasLineOfSight({ x: 50, y: 0 }, { x: 150, y: 0 }, [wall]),
    ).toBe(false);
  });

  it("selects nearby targets and respects chain limits", () => {
    const origin = {
      id: "player-1",
      x: 0,
      y: 0,
      radius: 10,
      alive: true,
    };
    const tanks = [
      origin,
      { id: "player-2", x: 40, y: 0, radius: 10, alive: true },
      { id: "player-3", x: 75, y: 0, radius: 10, alive: true },
      { id: "player-4", x: 100, y: 0, radius: 10, alive: true },
    ];
    const targets = selectLightningTargets(
      origin,
      tanks,
      [],
      50,
      50,
      2,
    );

    expect(targets.map((target) => target.id)).toEqual([
      "player-2",
      "player-3",
      "player-4",
    ].slice(0, 3));
  });

  it("never targets the shooter", () => {
    const origin = {
      id: "player-1",
      x: 0,
      y: 0,
      radius: 10,
      alive: true,
    };
    const targets = selectLightningTargets(
      origin,
      [origin, { id: "player-2", x: 20, y: 0, radius: 10, alive: true }],
      [],
      50,
      50,
      3,
    );

    expect(targets.every((target) => target.id !== "player-1")).toBe(true);
  });
});
