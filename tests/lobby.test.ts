import { describe, expect, it } from "vitest";
import {
  canStartLobbyMatch,
  pressLobbyDevice,
  setLobbyDeviceConnection,
} from "../src/game/lobby";
import type { PlayerDevice } from "../src/game/playerSetup";

describe("lobby roster", () => {
  it("joins on the first press and starts on a later press from a joined device", () => {
    const device: PlayerDevice = { kind: "keyboard", schemeIndex: 0 };
    const joined = pressLobbyDevice([], device, 6);

    expect(joined.action).toBe("joined");
    expect(joined.players).toMatchObject([
      { id: "player-1", colorIndex: 0, device, connected: true },
    ]);

    const started = pressLobbyDevice(joined.players, device, 6);
    expect(started.action).toBe("start");
    expect(started.players).toHaveLength(1);
  });

  it("assigns distinct player slots to distinct devices", () => {
    const first = pressLobbyDevice(
      [],
      { kind: "keyboard", schemeIndex: 0 },
      6,
    );
    const second = pressLobbyDevice(
      first.players,
      { kind: "gamepad", gamepadIndex: 2 },
      6,
    );

    expect(second.action).toBe("joined");
    expect(second.players.map((player) => player.colorIndex)).toEqual([0, 1]);
  });

  it("does not add duplicate devices or exceed the player limit", () => {
    const device: PlayerDevice = { kind: "gamepad", gamepadIndex: 0 };
    const joined = pressLobbyDevice([], device, 1);
    const duplicate = pressLobbyDevice(joined.players, device, 1);
    const full = pressLobbyDevice(
      joined.players,
      { kind: "gamepad", gamepadIndex: 1 },
      1,
    );

    expect(duplicate.action).toBe("start");
    expect(duplicate.players).toHaveLength(1);
    expect(full.action).toBe("full");
  });

  it("blocks starting while a joined controller is disconnected", () => {
    const device: PlayerDevice = { kind: "gamepad", gamepadIndex: 0 };
    const joined = pressLobbyDevice([], device, 6);
    const disconnected = setLobbyDeviceConnection(
      joined.players,
      device,
      false,
    );

    expect(canStartLobbyMatch(disconnected)).toBe(false);
    expect(pressLobbyDevice(disconnected, device, 6).action).toBe("blocked");

    const reconnected = setLobbyDeviceConnection(disconnected, device, true);
    expect(pressLobbyDevice(reconnected, device, 6).action).toBe("start");
  });
});
