import { describe, expect, it } from "vitest";
import { config } from "../src/config";
import { KeyboardInput } from "../src/input/KeyboardInput";

describe("KeyboardInput", () => {
  it("maps pressed controls and cancels opposing directions", () => {
    const target = new EventTarget();
    const input = new KeyboardInput(target, config.input.keyboardSchemes[0]);
    const dispatchKey = (type: string, code: string): Event => {
      const event = new Event(type, { cancelable: true });
      Object.defineProperty(event, "code", { value: code });
      target.dispatchEvent(event);
      return event;
    };

    expect(dispatchKey("keydown", "KeyW").defaultPrevented).toBe(true);
    dispatchKey("keydown", "KeyA");
    dispatchKey("keydown", "Space");
    expect(input.read()).toEqual({ move: 1, turn: -1, fire: true });

    dispatchKey("keydown", "KeyS");
    expect(input.read()).toEqual({ move: 0, turn: -1, fire: true });

    dispatchKey("keyup", "KeyW");
    dispatchKey("keyup", "KeyA");
    dispatchKey("keyup", "KeyS");
    dispatchKey("keyup", "Space");
    expect(input.read()).toEqual({ move: 0, turn: 0, fire: false });

    input.destroy();
  });

  it("ignores keys outside its scheme and releases listeners on destroy", () => {
    const target = new EventTarget();
    const input = new KeyboardInput(target, config.input.keyboardSchemes[0]);
    const event = new Event("keydown", { cancelable: true });
    Object.defineProperty(event, "code", { value: "KeyP" });
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(input.read()).toEqual({ move: 0, turn: 0, fire: false });

    input.destroy();
    const forwardEvent = new Event("keydown", { cancelable: true });
    Object.defineProperty(forwardEvent, "code", { value: "KeyW" });
    target.dispatchEvent(forwardEvent);
    expect(input.read()).toEqual({ move: 0, turn: 0, fire: false });
  });

  it("clears held keys when the window loses focus", () => {
    const target = new EventTarget();
    const input = new KeyboardInput(target, config.input.keyboardSchemes[0]);
    const forwardEvent = new Event("keydown", { cancelable: true });
    Object.defineProperty(forwardEvent, "code", { value: "KeyW" });
    target.dispatchEvent(forwardEvent);
    expect(input.read().move).toBe(1);

    target.dispatchEvent(new Event("blur"));
    expect(input.read().move).toBe(0);
    input.destroy();
  });
});
