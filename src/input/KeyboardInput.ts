import type { InputSource, PlayerInput } from "./InputSource";

export interface KeyboardScheme {
  forward: string;
  backward: string;
  turnLeft: string;
  turnRight: string;
  fire: string;
}

export class KeyboardInput implements InputSource {
  private readonly pressedKeys = new Set<string>();
  private readonly controlledKeys: Set<string>;
  private readonly onKeyDown = (event: Event): void => {
    const keyEvent = event as KeyboardEvent;
    if (this.controlledKeys.has(keyEvent.code)) {
      keyEvent.preventDefault();
      this.pressedKeys.add(keyEvent.code);
    }
  };
  private readonly onKeyUp = (event: Event): void => {
    this.pressedKeys.delete((event as KeyboardEvent).code);
  };
  private readonly onBlur = (): void => {
    this.pressedKeys.clear();
  };

  constructor(
    private readonly target: EventTarget,
    private readonly scheme: KeyboardScheme,
  ) {
    this.controlledKeys = new Set(Object.values(scheme));
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("blur", this.onBlur);
  }

  read(): PlayerInput {
    return {
      move:
        Number(this.pressedKeys.has(this.scheme.forward)) -
        Number(this.pressedKeys.has(this.scheme.backward)),
      turn:
        Number(this.pressedKeys.has(this.scheme.turnRight)) -
        Number(this.pressedKeys.has(this.scheme.turnLeft)),
      fire: this.pressedKeys.has(this.scheme.fire),
    };
  }

  destroy(): void {
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("blur", this.onBlur);
    this.pressedKeys.clear();
  }
}
