export interface PlayerInput {
  move: number;
  turn: number;
  fire: boolean;
}

export interface InputSource {
  read(): PlayerInput;
  destroy(): void;
}
