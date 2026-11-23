import { describe, expect, it } from "vitest";
import type { InputSource, PlayerInput } from "../src/input/InputSource";
import { CombinedInputSource } from "../src/input/CombinedInputSource";

class TestInputSource implements InputSource {
  destroyed = false;

  constructor(private readonly value: PlayerInput) {}

  read(): PlayerInput {
    return this.value;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

describe("CombinedInputSource", () => {
  it("uses the keyboard fallback when the gamepad is idle", () => {
    const gamepad = new TestInputSource({ move: 0, turn: 0, fire: false });
    const keyboard = new TestInputSource({ move: 1, turn: -1, fire: true });
    const input = new CombinedInputSource(gamepad, keyboard);

    expect(input.read()).toEqual({ move: 1, turn: -1, fire: true });
    input.destroy();
    expect(gamepad.destroyed).toBe(true);
    expect(keyboard.destroyed).toBe(true);
  });

  it("prefers an active gamepad over keyboard input", () => {
    const gamepad = new TestInputSource({ move: 0.5, turn: 0, fire: false });
    const keyboard = new TestInputSource({ move: -1, turn: 1, fire: true });
    const input = new CombinedInputSource(gamepad, keyboard);

    expect(input.read()).toEqual({ move: 0.5, turn: 0, fire: false });
    input.destroy();
  });
});
