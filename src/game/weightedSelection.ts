import type { RandomSource } from "./random";

export interface WeightedEntry<T> {
  value: T;
  weight: number;
}

export function selectWeighted<T>(
  entries: readonly WeightedEntry<T>[],
  random: RandomSource,
): T {
  if (entries.length === 0) {
    throw new RangeError("At least one weighted entry is required.");
  }
  if (
    entries.some(
      ({ weight }) => !Number.isFinite(weight) || weight < 0,
    )
  ) {
    throw new RangeError("Weights must be finite and non-negative.");
  }

  const totalWeight = entries.reduce((sum, { weight }) => sum + weight, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    throw new RangeError("At least one weighted entry must have positive weight.");
  }

  const selection = random() * totalWeight;
  if (!Number.isFinite(selection) || selection < 0 || selection >= totalWeight) {
    throw new RangeError("Random source must return a value in [0, 1).");
  }
  let cumulativeWeight = 0;
  let lastPositiveEntry: WeightedEntry<T> | undefined;
  for (const entry of entries) {
    cumulativeWeight += entry.weight;
    if (entry.weight > 0) {
      lastPositiveEntry = entry;
    }
    if (selection < cumulativeWeight) {
      return entry.value;
    }
  }
  if (lastPositiveEntry === undefined) {
    throw new RangeError("At least one weighted entry must have positive weight.");
  }
  return lastPositiveEntry.value;
}
