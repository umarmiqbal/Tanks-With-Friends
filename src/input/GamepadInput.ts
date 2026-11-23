import type { InputSource, PlayerInput } from "./InputSource";

export interface GamepadInputOptions {
  target?: EventTarget;
  getGamepads?: () => ArrayLike<Gamepad | null>;
  onConnectionChange?: (connected: boolean, index: number) => void;
}

const normalizeAxis = (value: number, deadZone: number): number => {
  const clampedValue = Math.max(-1, Math.min(1, value));
  const magnitude = Math.abs(clampedValue);
  if (magnitude <= deadZone) {
    return 0;
  }
  return (Math.sign(clampedValue) * (magnitude - deadZone)) / (1 - deadZone);
};

export class GamepadInput implements InputSource {
  private readonly target: EventTarget;
  private readonly getGamepads: () => ArrayLike<Gamepad | null>;
  private readonly onConnectionChange?: (
    connected: boolean,
    index: number,
  ) => void;
  private connected = false;
  private readonly onGamepadConnected = (event: Event): void => {
    const gamepad = (event as GamepadEvent).gamepad;
    if (gamepad.index === this.index) {
      this.setConnected(true);
    }
  };
  private readonly onGamepadDisconnected = (event: Event): void => {
    const gamepad = (event as GamepadEvent).gamepad;
    if (gamepad.index === this.index) {
      this.setConnected(false);
    }
  };

  constructor(
    private readonly index: number,
    private readonly deadZone: number,
    private readonly fireButtonThreshold: number,
    options: GamepadInputOptions = {},
  ) {
    if (!Number.isInteger(index) || index < 0) {
      throw new RangeError("Gamepad index must be a non-negative integer.");
    }
    if (deadZone < 0 || deadZone >= 1) {
      throw new RangeError("Gamepad dead zone must be in the range [0, 1).");
    }
    if (fireButtonThreshold < 0 || fireButtonThreshold > 1) {
      throw new RangeError("Gamepad fire threshold must be in the range [0, 1].");
    }

    this.target = options.target ?? window;
    this.getGamepads = options.getGamepads ?? (() => navigator.getGamepads());
    this.onConnectionChange = options.onConnectionChange;
    this.target.addEventListener("gamepadconnected", this.onGamepadConnected);
    this.target.addEventListener(
      "gamepaddisconnected",
      this.onGamepadDisconnected,
    );
  }

  read(): PlayerInput {
    const gamepad = this.getGamepads()[this.index] ?? null;
    this.setConnected(gamepad !== null && gamepad.connected);
    if (gamepad === null || !gamepad.connected || gamepad.mapping !== "standard") {
      return { move: 0, turn: 0, fire: false };
    }

    const dpadMove =
      Number(this.isButtonPressed(gamepad, 12)) -
      Number(this.isButtonPressed(gamepad, 13));
    const dpadTurn =
      Number(this.isButtonPressed(gamepad, 15)) -
      Number(this.isButtonPressed(gamepad, 14));
    const stickMove = normalizeAxis(-(gamepad.axes[1] ?? 0), this.deadZone);
    const stickTurn = normalizeAxis(gamepad.axes[0] ?? 0, this.deadZone);

    return {
      move: dpadMove === 0 ? stickMove : dpadMove,
      turn: dpadTurn === 0 ? stickTurn : dpadTurn,
      fire:
        this.isButtonPressed(gamepad, 0) ||
        this.isButtonPressed(gamepad, 5) ||
        this.isButtonPressed(gamepad, 7),
    };
  }

  destroy(): void {
    this.target.removeEventListener(
      "gamepadconnected",
      this.onGamepadConnected,
    );
    this.target.removeEventListener(
      "gamepaddisconnected",
      this.onGamepadDisconnected,
    );
  }

  private isButtonPressed(gamepad: Gamepad, index: number): boolean {
    const button = gamepad.buttons[index];
    return (
      button !== undefined &&
      (button.pressed ||
        (button.value > 0 && button.value >= this.fireButtonThreshold))
    );
  }

  private setConnected(connected: boolean): void {
    if (this.connected === connected) {
      return;
    }
    this.connected = connected;
    this.onConnectionChange?.(connected, this.index);
  }
}
