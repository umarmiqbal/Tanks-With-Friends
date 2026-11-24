import Phaser from "phaser";
import { config } from "../config";
import {
  createBrowserSettingsStorage,
  loadGameSettings,
  saveGameSettings,
  updateGameSetting,
  type GameSettings,
} from "../game/gameSettings";

type SettingsField = keyof GameSettings;

interface AdjustmentControl {
  text: Phaser.GameObjects.Text;
  row: Phaser.GameObjects.Text;
  direction: -1 | 1;
}

export class SettingsScene extends Phaser.Scene {
  private settings!: GameSettings;
  private title!: Phaser.GameObjects.Text;
  private powerups!: Phaser.GameObjects.Text;
  private crateFrequency!: Phaser.GameObjects.Text;
  private scoreToWin!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private back!: Phaser.GameObjects.Text;
  private readonly controls: AdjustmentControl[] = [];

  constructor() {
    super("settings");
  }

  create(): void {
    this.controls.length = 0;
    const loaded = loadGameSettings(createBrowserSettingsStorage());
    this.settings = loaded.settings;
    this.cameras.main.setBackgroundColor(config.presentation.backgroundColor);

    this.title = this.add
      .text(0, 0, "GAME SETTINGS", {
        color: config.presentation.titleColor,
        fontFamily: config.presentation.fontFamily,
        fontSize: `${config.presentation.titleFontSize}px`,
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.powerups = this.add
      .text(0, 0, "", this.valueStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.updateSetting("powerupsEnabled", 1));
    this.crateFrequency = this.add
      .text(0, 0, "", this.valueStyle())
      .setOrigin(0.5);
    this.scoreToWin = this.add
      .text(0, 0, "", this.valueStyle())
      .setOrigin(0.5);
    this.message = this.add
      .text(0, 0, loaded.error ?? "Changes save automatically.", {
        color: config.presentation.lobbyInfoColor,
        fontFamily: config.presentation.fontFamily,
        fontSize: `${config.presentation.lobbyInfoFontSize}px`,
        align: "center",
      })
      .setOrigin(0.5);
    this.back = this.add
      .text(0, 0, "BACK TO LOBBY", {
        ...this.valueStyle(),
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.returnToLobby());

    this.createAdjustment("crateSpawnInterval", -1, "-", this.crateFrequency);
    this.createAdjustment("crateSpawnInterval", 1, "+", this.crateFrequency);
    this.createAdjustment("scoreToWin", -1, "-", this.scoreToWin);
    this.createAdjustment("scoreToWin", 1, "+", this.scoreToWin);
    this.refresh();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.layout({ width: this.scale.width, height: this.scale.height });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
  }

  private valueStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: config.presentation.lobbyCardTextColor,
      fontFamily: config.presentation.fontFamily,
      fontSize: `${config.presentation.lobbyInfoFontSize}px`,
      fontStyle: "bold",
      align: "center",
    };
  }

  private createAdjustment(
    field: SettingsField,
    direction: -1 | 1,
    label: string,
    row: Phaser.GameObjects.Text,
  ): void {
    const text = this.add
      .text(0, 0, label, this.valueStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.updateSetting(field, direction));
    this.controls.push({ text, row, direction });
  }

  private updateSetting(
    field: SettingsField,
    direction: -1 | 1,
  ): void {
    this.settings = updateGameSetting(this.settings, field, direction);
    try {
      saveGameSettings(createBrowserSettingsStorage(), this.settings);
      this.message.setText("Changes saved.");
    } catch (error) {
      console.error("Unable to save game settings.", error);
      this.message.setText("Could not save settings. Check browser storage.");
    }
    this.refresh();
  }

  private refresh(): void {
    this.powerups.setText(
      `Powerups: ${this.settings.powerupsEnabled ? "ON" : "OFF"}  (click to toggle)`,
    );
    this.crateFrequency.setText(
      `Crate frequency: every ${this.settings.crateSpawnInterval} seconds`,
    );
    this.scoreToWin.setText(`Score to win: ${this.settings.scoreToWin}`);
  }

  private layout(gameSize: { width: number; height: number }): void {
    const { width, height } = gameSize;
    const centerX = width / 2;
    const centerY = height / 2;
    const rowGap = config.presentation.settingsRowGap;
    this.title.setPosition(centerX, centerY - rowGap * 2.2);
    this.powerups.setPosition(centerX, centerY - rowGap);
    this.crateFrequency.setPosition(centerX, centerY);
    this.scoreToWin.setPosition(centerX, centerY + rowGap);
    this.message.setPosition(centerX, centerY + rowGap * 2);
    this.back.setPosition(centerX, centerY + rowGap * 3);

    for (const control of this.controls) {
      const offset = config.presentation.settingsControlOffset;
      control.text.setPosition(
        control.row.x + control.direction * offset,
        control.row.y,
      );
    }
  }

  private returnToLobby(): void {
    this.scene.stop();
    this.scene.resume("lobby");
  }
}
