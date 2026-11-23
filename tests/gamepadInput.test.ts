import { describe, expect, it } from "vitest";
import { GamepadInput } from "../src/input/GamepadInput";

interface GamepadFixture {
  axes?: number[];
  buttons?: Record<number, { pressed?: boolean; value?: number }>;
  index?: number;
  mapping?: GamepadMappingType;
}

const completeHapticEffect = async (): Promise<GamepadHapticsResult> =>
  "complete";

const createGamepad = ({
  axes = [0, 0],
  buttons: buttonOverrides = {},
  index = 0,
  mapping = "standard",
}: GamepadFixture = {}): Gamepad => {
  const buttons: GamepadButton[] = Array.from({ length: 16 }, () => ({
    pressed: false,
    touched: false,
    value: 0,
  }));
  for (const [buttonIndex, override] of Object.entries(buttonOverrides)) {
    buttons[Number(buttonIndex)] = {
      pressed: override.pressed ?? false,
      touched: false,
      value: override.value ?? 0,
    };
  }

  return {
    axes,
    buttons,
    connected: true,
    id: "Test controller",
    index,
    mapping,
    timestamp: 0,
    vibrationActuator: {
      playEffect: completeHapticEffect,
      reset: completeHapticEffect,
    },
  };
};

describe("GamepadInput", () => {
  it("applies a rescaled dead zone to the left stick", () => {
    const target = new EventTarget();
    const gamepad = createGamepad({ axes: [0.6, -0.6] });
    const input = new GamepadInput(0, 0.2, 0.5, {
      target,
      getGamepads: () => [gamepad],
    });

    const state = input.read();
    expect(state.move).toBeCloseTo(0.5);
    expect(state.turn).toBeCloseTo(0.5);
    expect(state.fire).toBe(false);
    input.destroy();

    const centered = new GamepadInput(0, 0.2, 0.5, {
      target: new EventTarget(),
      getGamepads: () => [createGamepad({ axes: [0.1, -0.1] })],
    });
    expect(centered.read()).toEqual({ move: 0, turn: 0, fire: false });
    centered.destroy();
  });

  it("uses d-pad directions and A, right bumper, and right trigger for fire", () => {
    const target = new EventTarget();
    const gamepad = createGamepad({
      axes: [0.8, -0.8],
      buttons: {
        0: { pressed: true },
        12: { pressed: true },
        14: { pressed: true },
      },
    });
    const input = new GamepadInput(0, 0.2, 0.5, {
      target,
      getGamepads: () => [gamepad],
    });

    expect(input.read()).toEqual({ move: 1, turn: -1, fire: true });

    const bumper = createGamepad({ buttons: { 5: { pressed: true } } });
    const trigger = createGamepad({ buttons: { 7: { value: 0.8 } } });
    const triggerBelowThreshold = createGamepad({
      buttons: { 7: { value: 0.4 } },
    });
    const bumperInput = new GamepadInput(0, 0.2, 0.5, {
      target: new EventTarget(),
      getGamepads: () => [bumper],
    });
    const triggerInput = new GamepadInput(0, 0.2, 0.5, {
      target: new EventTarget(),
      getGamepads: () => [trigger],
    });
    const triggerBelowThresholdInput = new GamepadInput(0, 0.2, 0.5, {
      target: new EventTarget(),
      getGamepads: () => [triggerBelowThreshold],
    });

    expect(bumperInput.read().fire).toBe(true);
    expect(triggerInput.read().fire).toBe(true);
    expect(triggerBelowThresholdInput.read().fire).toBe(false);
    input.destroy();
    bumperInput.destroy();
    triggerInput.destroy();
    triggerBelowThresholdInput.destroy();
  });

  it("polls for newly visible controllers and reports connection changes", () => {
    const target = new EventTarget();
    const connectionChanges: boolean[] = [];
    let gamepads: Array<Gamepad | null> = [null];
    const input = new GamepadInput(0, 0.2, 0.5, {
      target,
      getGamepads: () => gamepads,
      onConnectionChange: (connected) => connectionChanges.push(connected),
    });

    expect(input.read()).toEqual({ move: 0, turn: 0, fire: false });
    gamepads = [createGamepad({ buttons: { 0: { pressed: true } } })];
    expect(input.read().fire).toBe(true);
    gamepads = [null];
    expect(input.read()).toEqual({ move: 0, turn: 0, fire: false });
    expect(connectionChanges).toEqual([true, false]);

    input.destroy();
  });

  it("handles browser connection events for its assigned index", () => {
    const target = new EventTarget();
    const changes: boolean[] = [];
    const gamepad = createGamepad();
    const input = new GamepadInput(0, 0.2, 0.5, {
      target,
      getGamepads: () => [gamepad],
      onConnectionChange: (connected) => changes.push(connected),
    });
    const dispatchConnection = (type: string): void => {
      const event = new Event(type);
      Object.defineProperty(event, "gamepad", { value: gamepad });
      target.dispatchEvent(event);
    };

    dispatchConnection("gamepadconnected");
    dispatchConnection("gamepaddisconnected");
    expect(changes).toEqual([true, false]);

    input.destroy();
    dispatchConnection("gamepadconnected");
    expect(changes).toEqual([true, false]);
  });

  it("ignores non-standard mappings and other controller indices", () => {
    const target = new EventTarget();
    const gamepad = createGamepad({
      axes: [0, -1],
      mapping: "",
      index: 1,
    });
    const input = new GamepadInput(0, 0.2, 0.5, {
      target,
      getGamepads: () => [null, gamepad],
    });

    expect(input.read()).toEqual({ move: 0, turn: 0, fire: false });
    input.destroy();
  });
});
