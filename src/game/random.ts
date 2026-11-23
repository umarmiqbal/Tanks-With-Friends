export type RandomSource = () => number;

export function createSeededRandom(seed: number): RandomSource {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError("Random seed must be an unsigned 32-bit integer.");
  }

  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function createRandomSeed(): number {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.getRandomValues === "function"
  ) {
    const seed = globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
    if (seed !== undefined) {
      return seed;
    }
  }
  return Date.now() >>> 0;
}

export function randomIndex(length: number, random: RandomSource): number {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError("Random index length must be a positive integer.");
  }
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Random source must return a value in [0, 1).");
  }
  return Math.floor(value * length);
}
