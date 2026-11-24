import Phaser from "phaser";
import { config } from "../config";
import {
  pressLobbyDevice,
  setLobbyDeviceConnection,
} from "../game/lobby";
import { createRandomSeed } from "../game/random";
import {
  createBrowserSettingsStorage,
  loadGameSettings,
} from "../game/gameSettings";
import type { LobbyPlayer, PlayerDevice, PlayerSetup } from "../game/playerSetup";
import { GamepadInput } from "../input/GamepadInput";
import { KeyboardInput } from "../input/KeyboardInput";

interface LobbyCard {
  background: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  width: number;
  height: number;
}

export class LobbyScene extends Phaser.Scene {
  private players: LobbyPlayer[] = [];
  private readonly keyboardInputs: KeyboardInput[] = [];
  private readonly keyboardFireWasPressed: boolean[] = [];
  private readonly gamepadInputs = new Map<number, GamepadInput>();
  private readonly gamepadFireWasPressed = new Map<number, boolean>();
  private readonly cards: LobbyCard[] = [];
  private starting = false;
  private title!: Phaser.GameObjects.Text;
  private instructions!: Phaser.GameObjects.Text;
  private controls!: Phaser.GameObjects.Text;
  private footer!: Phaser.GameObjects.Text;
  private settingsButton!: Phaser.GameObjects.Text;

  constructor() {
    super("lobby");
  }

  create(): void {
    this.players = [];
    this.starting = false;
    this.title = this.add
      .text(0, 0, "Tanks With Friends", {
        color: config.presentation.titleColor,
        fontFamily: config.presentation.fontFamily,
        fontSize: `${config.presentation.titleFontSize}px`,
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5);
    this.instructions = this.add
      .text(
        0,
        0,
        "Press any controller button or a keyboard fire key to join. Press again to start.",
        {
          color: config.presentation.lobbyCardTextColor,
          fontFamily: config.presentation.fontFamily,
          fontSize: `${config.presentation.lobbyInfoFontSize}px`,
          align: "center",
        },
      )
      .setOrigin(0.5);
    this.controls = this.add
      .text(
        0,
        0,
        "Keyboard: WASD+Space | Arrows+Enter | IJKL+O | TFGH+Y | Numpad+0 | ZXCV+B\nController: any button joins; A / RB / RT fires during the match.",
        {
          color: config.presentation.lobbyInfoColor,
          fontFamily: config.presentation.fontFamily,
          fontSize: `${config.presentation.subtitleFontSize}px`,
          align: "center",
        },
      )
      .setOrigin(0.5);
    this.footer = this.add
      .text(0, 0, "", {
        color: config.presentation.lobbyCardTextColor,
        fontFamily: config.presentation.fontFamily,
        fontSize: `${config.presentation.subtitleFontSize}px`,
        align: "center",
      })
      .setOrigin(0.5);
    this.settingsButton = this.add
      .text(0, 0, "SETTINGS", {
        color: config.presentation.audioToggleColor,
        fontFamily: config.presentation.fontFamily,
        fontSize: `${config.presentation.subtitleFontSize}px`,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.openSettings());

    for (let slot = 0; slot < config.input.maximumPlayers; slot += 1) {
      const background = this.add.graphics().setDepth(1);
      const text = this.add
        .text(0, 0, "", {
          color: config.presentation.lobbyCardTextColor,
          fontFamily: config.presentation.fontFamily,
          fontSize: `${config.presentation.lobbyCardFontSize}px`,
          fontStyle: "bold",
          align: "center",
          lineSpacing: 4,
        })
        .setOrigin(0.5)
        .setDepth(2);
      this.cards.push({ background, text, width: 0, height: 0 });
    }

    config.input.keyboardSchemes.forEach((scheme) => {
      this.keyboardInputs.push(new KeyboardInput(window, scheme));
      this.keyboardFireWasPressed.push(false);
    });
    for (
      let gamepadIndex = 0;
      gamepadIndex < config.input.gamepadIndexScanCount;
      gamepadIndex += 1
    ) {
      this.gamepadInputs.set(
        gamepadIndex,
        new GamepadInput(
          gamepadIndex,
          config.input.gamepadDeadZone,
          config.input.gamepadFireThreshold,
          {
            fireOnAnyButton: true,
            onConnectionChange: (connected) =>
              this.handleGamepadConnection(gamepadIndex, connected),
          },
        ),
      );
      this.gamepadFireWasPressed.set(gamepadIndex, false);
    }

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.layout({ width: this.scale.width, height: this.scale.height });
    this.refreshCards();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      for (const input of this.keyboardInputs) {
        input.destroy();
      }
      for (const input of this.gamepadInputs.values()) {
        input.destroy();
      }
      this.keyboardInputs.length = 0;
      this.gamepadInputs.clear();
    });
  }

  update(): void {
    if (this.starting) {
      return;
    }

    for (const [schemeIndex, input] of this.keyboardInputs.entries()) {
      const firePressed = input.read().fire;
      if (firePressed && !this.keyboardFireWasPressed[schemeIndex]) {
        this.handleLobbyPress({ kind: "keyboard", schemeIndex });
      }
      this.keyboardFireWasPressed[schemeIndex] = firePressed;
      if (this.starting) {
        return;
      }
    }

    for (const [gamepadIndex, input] of this.gamepadInputs) {
      const firePressed = input.read().fire;
      if (firePressed && !this.gamepadFireWasPressed.get(gamepadIndex)) {
        this.handleLobbyPress({ kind: "gamepad", gamepadIndex });
      }
      this.gamepadFireWasPressed.set(gamepadIndex, firePressed);
      if (this.starting) {
        return;
      }
    }
  }

  private handleLobbyPress(device: PlayerDevice): void {
    const update = pressLobbyDevice(
      this.players,
      device,
      config.input.maximumPlayers,
    );
    this.players = update.players;

    if (update.action === "start") {
      this.startMatch();
      return;
    }
    this.refreshCards();
    if (update.action === "blocked") {
      this.footer.setText("Reconnect all joined controllers before starting.");
    } else if (update.action === "full") {
      this.footer.setText("All player slots are full.");
    } else {
      this.footer.setText(
        `${this.deviceName(device)} joined. Press its fire button again to start.`,
      );
    }
  }

  private handleGamepadConnection(
    gamepadIndex: number,
    connected: boolean,
  ): void {
    this.players = setLobbyDeviceConnection(
      this.players,
      { kind: "gamepad", gamepadIndex },
      connected,
    );
    this.refreshCards();
  }

  private startMatch(): void {
    this.starting = true;
    const players: PlayerSetup[] = this.players.map(
      ({ connected: _connected, ...setup }) => setup,
    );
    const loadedSettings = loadGameSettings(createBrowserSettingsStorage());
    this.scene.start("game", {
      players,
      randomSeed: createRandomSeed(),
      settings: loadedSettings.settings,
    });
  }

  private openSettings(): void {
    this.scene.launch("settings");
    this.scene.pause();
  }

  private deviceName(device: PlayerDevice): string {
    return device.kind === "keyboard"
      ? `Keyboard: ${config.input.keyboardSchemes[device.schemeIndex]!.label}`
      : `Controller ${device.gamepadIndex + 1}`;
  }

  private refreshCards(): void {
    const { lobbyCardBackgroundColor, lobbyEmptyBorderColor } =
      config.presentation;
    this.cards.forEach((card, slot) => {
      const player = this.players[slot];
      card.background.clear();
      card.background.fillStyle(lobbyCardBackgroundColor);
      const x = card.text.x;
      const y = card.text.y;
      if (card.width === 0 || card.height === 0) {
        return;
      }
      card.background.fillRect(
        x - card.width / 2,
        y - card.height / 2,
        card.width,
        card.height,
      );
      card.background.lineStyle(
        config.presentation.lobbyCardBorderThickness,
        player === undefined
          ? lobbyEmptyBorderColor
          : config.presentation.playerColors[player.colorIndex]!,
      );
      card.background.strokeRect(
        x - card.width / 2,
        y - card.height / 2,
        card.width,
        card.height,
      );
      card.text.setText(
        player === undefined
          ? `SLOT ${slot + 1}\nPress fire to join`
          : `PLAYER ${player.colorIndex + 1}\n${this.deviceName(player.device)}\n${player.connected ? "CONNECTED" : "DISCONNECTED"}`,
      );
    });
    this.footer.setText(
      this.players.some((player) => !player.connected)
        ? "Reconnect all joined controllers before starting."
        : `Joined ${this.players.length}/${config.input.maximumPlayers}. A joined player presses its fire button again to start.`,
    );
  }

  private layout(gameSize: { width: number; height: number }): void {
    const { width, height } = gameSize;
    const columns = config.presentation.lobbyColumns;
    const rows = Math.ceil(this.cards.length / columns);
    const gap = config.presentation.lobbyCardGap;
    const horizontalPadding = config.presentation.boardPadding;
    const cardWidth = Math.max(
      1,
      Math.min(
        config.presentation.lobbyCardWidth,
        (width - horizontalPadding * 2 - gap * (columns - 1)) / columns,
      ),
    );
    const cardHeight = Math.max(
      1,
      Math.min(
        config.presentation.lobbyCardHeight,
        (height - config.presentation.boardPadding * 2 - gap * (rows - 1)) /
          rows,
      ),
    );
    const gridWidth = columns * cardWidth + (columns - 1) * gap;
    const gridHeight = rows * cardHeight + (rows - 1) * gap;
    const gridLeft = (width - gridWidth) / 2;
    const gridTop = Math.min(
      config.presentation.lobbyGridTopOffset,
      height - gridHeight - config.presentation.boardPadding * 2,
    );

    this.title.setPosition(
      width / 2,
      config.presentation.titleTopOffset +
        config.presentation.lobbyTitleOffset,
    );
    this.instructions.setPosition(
      width / 2,
      config.presentation.lobbyInstructionsTop,
    );
    this.instructions.setWordWrapWidth(width - horizontalPadding * 2);
    this.controls.setPosition(width / 2, config.presentation.lobbyControlsTop);
    this.controls.setWordWrapWidth(width - horizontalPadding * 2);
    this.footer.setPosition(
      width / 2,
      Math.min(
        config.presentation.lobbyFooterTopOffset,
        height -
          config.presentation.lobbyFooterBottomOffset -
          config.presentation.lobbySettingsOffset,
      ),
    );
    this.settingsButton.setPosition(
      width / 2,
      Math.min(
        config.presentation.lobbyFooterTopOffset +
          config.presentation.lobbySettingsOffset,
        height - config.presentation.lobbyFooterBottomOffset / 2,
      ),
    );

    this.cards.forEach((card, slot) => {
      const column = slot % columns;
      const row = Math.floor(slot / columns);
      const x = gridLeft + column * (cardWidth + gap) + cardWidth / 2;
      const y = gridTop + row * (cardHeight + gap) + cardHeight / 2;
      card.width = cardWidth;
      card.height = cardHeight;
      card.text.setPosition(x, y);
      card.text.setWordWrapWidth(
        cardWidth - config.presentation.lobbyCardPadding * 2,
      );
    });
    this.refreshCards();
  }
}
