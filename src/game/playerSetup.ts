export type PlayerDevice =
  | { kind: "keyboard"; schemeIndex: number }
  | { kind: "gamepad"; gamepadIndex: number };

export interface PlayerSetup {
  id: string;
  colorIndex: number;
  device: PlayerDevice;
}

export interface LobbyPlayer extends PlayerSetup {
  connected: boolean;
}
