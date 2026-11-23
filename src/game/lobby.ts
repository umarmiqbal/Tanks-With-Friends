import type { LobbyPlayer, PlayerDevice } from "./playerSetup";

export type LobbyAction = "joined" | "start" | "blocked" | "full";

export interface LobbyUpdate {
  players: LobbyPlayer[];
  action: LobbyAction;
}

const sameDevice = (left: PlayerDevice, right: PlayerDevice): boolean => {
  if (left.kind === "keyboard") {
    return (
      right.kind === "keyboard" && left.schemeIndex === right.schemeIndex
    );
  }
  return right.kind === "gamepad" && left.gamepadIndex === right.gamepadIndex;
};

export function canStartLobbyMatch(players: readonly LobbyPlayer[]): boolean {
  return players.length > 0 && players.every((player) => player.connected);
}

export function pressLobbyDevice(
  players: readonly LobbyPlayer[],
  device: PlayerDevice,
  maximumPlayers: number,
): LobbyUpdate {
  if (players.some((player) => sameDevice(player.device, device))) {
    return {
      players: [...players],
      action: canStartLobbyMatch(players) ? "start" : "blocked",
    };
  }
  if (players.length >= maximumPlayers) {
    return { players: [...players], action: "full" };
  }

  const colorIndex = players.length;
  return {
    players: [
      ...players,
      {
        id: `player-${colorIndex + 1}`,
        colorIndex,
        device,
        connected: true,
      },
    ],
    action: "joined",
  };
}

export function setLobbyDeviceConnection(
  players: readonly LobbyPlayer[],
  device: PlayerDevice,
  connected: boolean,
): LobbyPlayer[] {
  return players.map((player) =>
    sameDevice(player.device, device) ? { ...player, connected } : player,
  );
}
