import { describe, expect, it } from "vitest";
import { createSeededRandom, randomIndex } from "../src/game/random";
import { selectWeighted } from "../src/game/weightedSelection";

describe("seeded random helpers", () => {
  it("repeats the same seeded sequence", () => {
    const first = createSeededRandom(42);
    const second = createSeededRandom(42);

    expect(Array.from({ length: 8 }, first)).toEqual(
      Array.from({ length: 8 }, second),
    );
  });

  it("selects weighted entries deterministically", () => {
    const entries = [
      { value: "common", weight: 3 },
      { value: "rare", weight: 1 },
    ];
    const roll = (): string[] => {
      const random = createSeededRandom(7);
      return Array.from({ length: 12 }, () => selectWeighted(entries, random));
    };

    expect(roll()).toEqual(roll());
    expect(new Set(roll())).toEqual(new Set(["common", "rare"]));
  });

  it("rejects invalid weights and random values", () => {
    expect(() => selectWeighted([], createSeededRandom(1))).toThrow(RangeError);
    expect(() =>
      selectWeighted([{ value: "invalid", weight: -1 }], createSeededRandom(1)),
    ).toThrow(RangeError);
    expect(() => randomIndex(2, () => 1)).toThrow(RangeError);
  });
});
