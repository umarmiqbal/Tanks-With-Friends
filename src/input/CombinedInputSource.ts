import type { InputSource, PlayerInput } from "./InputSource";

export class CombinedInputSource implements InputSource {
  constructor(
    private readonly primary: InputSource,
    private readonly fallback: InputSource,
  ) {}

  read(): PlayerInput {
    const primaryInput = this.primary.read();
    if (
      primaryInput.move !== 0 ||
      primaryInput.turn !== 0 ||
      primaryInput.fire
    ) {
      return primaryInput;
    }
    return this.fallback.read();
  }

  destroy(): void {
    this.primary.destroy();
    this.fallback.destroy();
  }
}
