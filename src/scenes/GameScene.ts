import Phaser from "phaser";
import { config } from "../config";
import { soundEffects } from "../audio/soundEffects";
import {
  createBulletOrigin,
  traceBulletPath,
  type BulletState,
} from "../game/bullet";
import {
  crateCenter,
  spawnPowerupCrate,
  tankTouchesCrate,
  type PowerupCrate,
} from "../game/crates";
import { advanceCombat, type CombatState } from "../game/combat";
import { generateMaze, type Maze } from "../game/maze";
import {
  createRandomSeed,
  createSeededRandom,
  type RandomSource,
} from "../game/random";
import {
  advanceMatch,
  createMatchState,
  type MatchState,
} from "../game/rounds";
import {
  createMazeWallRects,
  moveTank,
  pushTankToNearestOpenSpace,
  type TankState,
  type WallRect,
} from "../game/tankMovement";
import {
  advanceTankPowerups,
  applyPassivePowerup,
  createTankPowerupState,
  getTankMovementEffects,
  type PowerupType,
  type TankPowerupState,
} from "../game/tankPowerups";
import {
  createSpecialWeapon,
  WeaponLoadout,
} from "../game/weapons";
import type { PlayerSetup } from "../game/playerSetup";
import type { InputSource, PlayerInput } from "../input/InputSource";
import { GamepadInput } from "../input/GamepadInput";
import { KeyboardInput } from "../input/KeyboardInput";

interface SpawnPoint {
  column: number;
  row: number;
  angle: number;
}

interface LocalPlayer {
  id: string;
  colorIndex: number;
  tank: TankState;
  alive: boolean;
  inputSource: InputSource;
  weapons: WeaponLoadout;
  powerups: TankPowerupState;
  aimGuideHeld: boolean;
  graphics: Phaser.GameObjects.Graphics;
  statusGraphics: Phaser.GameObjects.Graphics;
  marker: Phaser.GameObjects.Text;
}

interface ExplosionEffect {
  x: number;
  y: number;
  color: number;
  elapsed: number;
}

interface ActiveCrate extends PowerupCrate<PowerupType> {
  elapsed: number;
}

interface PickupEffect {
  x: number;
  y: number;
  elapsed: number;
}

interface BeamEffect {
  ownerId: string;
  kind: "laser" | "lightning";
  segments: { start: { x: number; y: number }; end: { x: number; y: number } }[];
  elapsed: number;
}

export class GameScene extends Phaser.Scene {
  private maze!: Maze;
  private wallRects!: WallRect[];
  private players: LocalPlayer[] = [];
  private playerSetups: PlayerSetup[] = [];
  private bullets: BulletState[] = [];
  private explosions: ExplosionEffect[] = [];
  private crates: ActiveCrate[] = [];
  private pickupEffects: PickupEffect[] = [];
  private beamEffects: BeamEffect[] = [];
  private random!: RandomSource;
  private crateSpawnRemaining = config.powerups.crateSpawnInterval;
  private matchState!: MatchState;
  private accumulator = 0;
  private controllerDisconnected = false;
  private pausedForDisconnect = false;
  private readonly disconnectedControllerIds = new Set<string>();
  private displayScale = 1;
  private displayCellSize: number = config.maze.cellSize;
  private boardLeft = 0;
  private boardTop = 0;
  private mazeGraphics!: Phaser.GameObjects.Graphics;
  private bulletGraphics!: Phaser.GameObjects.Graphics;
  private aimGuideGraphics!: Phaser.GameObjects.Graphics;
  private explosionGraphics!: Phaser.GameObjects.Graphics;
  private crateGraphics!: Phaser.GameObjects.Graphics;
  private pickupGraphics!: Phaser.GameObjects.Graphics;
  private beamGraphics!: Phaser.GameObjects.Graphics;
  private disconnectPanel!: Phaser.GameObjects.Graphics;
  private disconnectMessage!: Phaser.GameObjects.Text;
  private statusPanel!: Phaser.GameObjects.Graphics;
  private statusMessage!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private scoreboard!: Phaser.GameObjects.Text;
  private audioToggle!: Phaser.GameObjects.Text;

  constructor() {
    super("game");
  }

  init(data: { players: PlayerSetup[]; randomSeed?: number }): void {
    this.playerSetups = data.players;
    this.random = createSeededRandom(data.randomSeed ?? createRandomSeed());
  }

  create(): void {
    this.players = [];
    this.bullets = [];
    this.explosions = [];
    this.crates = [];
    this.pickupEffects = [];
    this.beamEffects = [];
    this.crateSpawnRemaining = config.powerups.crateSpawnInterval;
    this.accumulator = 0;
    this.controllerDisconnected = false;
    this.pausedForDisconnect = false;
    this.disconnectedControllerIds.clear();
    this.generateRoundMaze();
    this.mazeGraphics = this.add.graphics();
    this.bulletGraphics = this.add.graphics().setDepth(1);
    this.aimGuideGraphics = this.add
      .graphics()
      .setDepth(config.presentation.aimGuideDepth);
    this.explosionGraphics = this.add.graphics().setDepth(4);
    this.crateGraphics = this.add
      .graphics()
      .setDepth(config.presentation.powerupCrateDepth);
    this.pickupGraphics = this.add.graphics().setDepth(5);
    this.beamGraphics = this.add.graphics().setDepth(6);
    if (
      this.playerSetups.length === 0 ||
      this.playerSetups.length > config.input.maximumPlayers
    ) {
      throw new RangeError(
        `A match requires between one and ${config.input.maximumPlayers} players.`,
      );
    }
    const spawnPoints = this.getSpawnPoints();
    for (const [index, setup] of this.playerSetups.entries()) {
      const inputSource = this.createInputSource(setup);
      this.players.push(
        this.createPlayer(setup, spawnPoints[index]!, inputSource),
      );
    }
    this.disconnectPanel = this.add.graphics().setDepth(9).setScrollFactor(0);
    this.disconnectMessage = this.add
      .text(0, 0, "PLAYER 1 CONTROLLER DISCONNECTED\nReconnect to resume", {
        color: config.presentation.disconnectTextColor,
        fontFamily: config.presentation.fontFamily,
        fontSize: `${config.presentation.disconnectFontSize}px`,
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10);
    this.disconnectPanel.setVisible(false);
    this.disconnectMessage.setVisible(false);
    this.statusPanel = this.add.graphics().setDepth(7).setScrollFactor(0);
    this.statusMessage = this.add
      .text(0, 0, "", {
        color: config.presentation.statusColor,
        fontFamily: config.presentation.fontFamily,
        fontSize: `${config.presentation.statusFontSize}px`,
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(8)
      .setVisible(false);
    this.title = this.add
      .text(0, 0, "Tanks With Friends", {
        color: config.presentation.titleColor,
        fontFamily: config.presentation.fontFamily,
        fontSize: `${config.presentation.titleFontSize}px`,
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.subtitle = this.add
      .text(
        0,
        0,
        "W/S drive  A/D turn  Space fire  Pad: LS move/turn  RS steer  D-pad  A/RB/RT",
        {
          color: config.presentation.subtitleColor,
          fontFamily: config.presentation.fontFamily,
          fontSize: `${config.presentation.subtitleFontSize}px`,
        },
      )
      .setOrigin(0.5);
    this.scoreboard = this.add
      .text(0, 0, "", {
        color: config.presentation.scoreboardColor,
        fontFamily: config.presentation.fontFamily,
        fontSize: `${config.presentation.scoreboardFontSize}px`,
        fontStyle: "bold",
        align: "left",
        lineSpacing: config.presentation.scoreboardRowSpacing,
      })
      .setOrigin(0.5);
    this.audioToggle = this.add
      .text(0, 0, "", {
        color: config.presentation.audioToggleColor,
        fontFamily: config.presentation.fontFamily,
        fontSize: `${config.presentation.audioToggleFontSize}px`,
        fontStyle: "bold",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(5)
      .setInteractive({ useHandCursor: true });
    this.audioToggle.on("pointerdown", this.toggleAudio, this);
    this.updateAudioToggle();
    soundEffects.unlock();
    this.matchState = createMatchState(this.players.map((player) => player.id));
    this.refreshMatchPresentation();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.layout({ width: this.scale.width, height: this.scale.height });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      for (const player of this.players) {
        player.inputSource.destroy();
      }
    });
  }

  update(_time: number, deltaMilliseconds: number): void {
    this.updateExplosions(deltaMilliseconds / 1000);
    this.updatePickupEffects(deltaMilliseconds / 1000);
    this.updateBeamEffects(deltaMilliseconds / 1000);
    this.accumulator += deltaMilliseconds / 1000;
    while (this.accumulator >= config.simulation.fixedTimeStep) {
      if (this.matchState.phase === "matchOver") {
        this.accumulator = 0;
        break;
      }

      if (this.matchState.phase === "playing") {
        let weaponExpired = false;
        for (const player of this.players) {
          weaponExpired = player.weapons.update(
            config.simulation.fixedTimeStep,
          ) || weaponExpired;
        }
        if (weaponExpired) {
          this.refreshScoreboard();
        }
        const controls: Array<{ player: LocalPlayer; input: PlayerInput }> = [];
        for (const player of this.players) {
          if (!player.alive) {
            player.aimGuideHeld = false;
            continue;
          }
          const powerupUpdate = advanceTankPowerups(
            player.powerups,
            config.simulation.fixedTimeStep,
          );
          player.powerups = powerupUpdate.state;
          if (powerupUpdate.ghostExpired) {
            player.tank = pushTankToNearestOpenSpace(
              player.tank,
              this.maze,
              config.maze.cellSize,
              config.tank.radius,
              this.wallRects,
            );
          }
          const playerInput = player.inputSource.read();
          player.aimGuideHeld = player.powerups.aimGuideRemaining > 0;
          if (this.controllerDisconnected) {
            break;
          }
          const movementEffects = getTankMovementEffects(
            config.tank,
            player.powerups,
            config.powerups.tankEffects,
          );
          player.tank = moveTank(
            player.tank,
            playerInput,
            config.simulation.fixedTimeStep,
            movementEffects.ignoresWalls ? [] : this.wallRects,
            movementEffects.movementSettings,
          );
          controls.push({ player, input: playerInput });
        }

        if (this.controllerDisconnected) {
          this.accumulator = 0;
          break;
        }
        this.updateCrates(config.simulation.fixedTimeStep);
        this.stepBullets(config.simulation.fixedTimeStep);
        for (const { player, input } of controls) {
          if (player.alive) {
            this.updateFiring(player, input);
          }
        }
      }

      const previousMatch = this.matchState;
      const matchUpdate = advanceMatch(
        this.matchState,
        this.players
          .filter((player) => player.alive)
          .map((player) => player.id),
        config.simulation.fixedTimeStep,
        config.match,
      );
      this.matchState = matchUpdate.state;
      if (previousMatch.phase === "playing" && this.matchState.phase !== "playing") {
        this.bullets = [];
        this.clearRoundPowerups();
        if (this.matchState.winnerId !== null) {
          soundEffects.playRoundWin();
        }
      }
      if (matchUpdate.startNextRound) {
        this.startNextRound();
      }
      if (
        previousMatch.phase !== this.matchState.phase ||
        previousMatch.round !== this.matchState.round
      ) {
        this.refreshMatchPresentation();
      }
      this.accumulator -= config.simulation.fixedTimeStep;
    }
    this.positionPlayers();
    this.drawBullets();
    this.drawAimGuides();
    this.drawCrates();
    this.drawExplosions();
    this.drawPickupEffects();
    this.drawBeamEffects();
  }

  private layout(gameSize: { width: number; height: number }): void {
    const { width, height } = gameSize;
    const { boardPadding, titleTopOffset, titleHeight } =
      config.presentation;
    const availableWidth =
      width -
      boardPadding * 2 -
      config.presentation.scoreboardWidth -
      config.presentation.scoreboardGap;
    const availableHeight = height - boardPadding * 2 - titleHeight;
    const cellSize = Math.max(
      config.presentation.minimumCellSize,
      Math.min(
        config.maze.cellSize,
        availableWidth / this.maze.columns,
        availableHeight / this.maze.rows,
      ),
    );
    const boardWidth = cellSize * this.maze.columns;
    const boardHeight = cellSize * this.maze.rows;
    this.displayScale = cellSize / config.maze.cellSize;
    this.displayCellSize = cellSize;
    this.boardLeft = boardPadding + (availableWidth - boardWidth) / 2;
    this.boardTop =
      boardPadding + titleHeight + (availableHeight - boardHeight) / 2;

    this.title.setPosition(width / 2, titleTopOffset);
    this.subtitle.setPosition(width / 2, titleTopOffset + titleHeight / 2);
    this.scoreboard.setPosition(
      width - boardPadding - config.presentation.scoreboardWidth / 2,
      this.boardTop + boardHeight / 2,
    );
    this.audioToggle.setPosition(
      width - boardPadding,
      boardPadding,
    );
    this.drawMaze(this.boardLeft, this.boardTop, cellSize);
    this.positionPlayers();
    this.positionDisconnectNotice(width, height);
    this.positionMatchStatus(width, height);
  }

  private generateRoundMaze(): void {
    this.maze = generateMaze(
      config.maze.columns,
      config.maze.rows,
      config.maze.extraOpenings,
      this.random,
    );
    this.wallRects = createMazeWallRects(
      this.maze,
      config.maze.cellSize,
      config.maze.wallThickness,
    );
  }

  private getSpawnPoints(): SpawnPoint[] {
    return [
      { column: 1, row: 0, angle: 0 },
      {
        column: config.maze.columns - 2,
        row: config.maze.rows - 1,
        angle: Math.PI,
      },
      {
        column: config.maze.columns - 2,
        row: 0,
        angle: Math.PI / 2,
      },
      {
        column: 1,
        row: config.maze.rows - 1,
        angle: -Math.PI / 2,
      },
      {
        column: Math.floor(config.maze.columns / 2),
        row: 1,
        angle: Math.PI / 2,
      },
      {
        column: Math.floor(config.maze.columns / 2),
        row: config.maze.rows - 2,
        angle: -Math.PI / 2,
      },
    ];
  }

  private createInputSource(setup: PlayerSetup): InputSource {
    if (setup.device.kind === "keyboard") {
      const scheme = config.input.keyboardSchemes[setup.device.schemeIndex];
      if (scheme === undefined) {
        throw new RangeError("Player has an unknown keyboard scheme.");
      }
      return new KeyboardInput(window, scheme);
    }

    return new GamepadInput(
      setup.device.gamepadIndex,
      config.input.gamepadDeadZone,
      config.input.gamepadFireThreshold,
      {
        initiallyConnected: true,
        onConnectionChange: (connected) =>
          this.handleControllerConnection(setup.id, connected),
      },
    );
  }

  private handleControllerConnection(
    playerId: string,
    connected: boolean,
  ): void {
    if (connected) {
      this.disconnectedControllerIds.delete(playerId);
    } else {
      this.disconnectedControllerIds.add(playerId);
    }
    this.controllerDisconnected = this.disconnectedControllerIds.size > 0;
    this.disconnectPanel.setVisible(this.controllerDisconnected);
    this.disconnectMessage.setVisible(this.controllerDisconnected);

    if (this.controllerDisconnected) {
      const playerNumbers = [...this.disconnectedControllerIds]
        .map((id) =>
          this.players.find((player) => player.id === id)?.colorIndex,
        )
        .filter((colorIndex): colorIndex is number => colorIndex !== undefined)
        .map((colorIndex) => colorIndex + 1);
      this.disconnectMessage.setText(
        `PLAYER${playerNumbers.length > 1 ? "S" : ""} ${playerNumbers.join(", ")} CONTROLLER DISCONNECTED\nReconnect to resume`,
      );
      this.positionDisconnectNotice(this.scale.width, this.scale.height);
      if (!this.pausedForDisconnect) {
        this.pausedForDisconnect = true;
        this.scene.pause();
      }
      return;
    }

    if (this.pausedForDisconnect) {
      this.pausedForDisconnect = false;
      this.scene.resume();
    }
  }

  private positionDisconnectNotice(width: number, height: number): void {
    const centerX = width / 2;
    const centerY = height / 2;
    const padding = config.presentation.disconnectPanelPadding;
    this.disconnectMessage.setPosition(centerX, centerY);
    this.disconnectPanel.clear();
    this.disconnectPanel.fillStyle(config.presentation.disconnectPanelColor);
    this.disconnectPanel.fillRect(
      centerX - this.disconnectMessage.width / 2 - padding,
      centerY - this.disconnectMessage.height / 2 - padding,
      this.disconnectMessage.width + padding * 2,
      this.disconnectMessage.height + padding * 2,
    );
  }

  private refreshMatchPresentation(): void {
    this.refreshScoreboard();

    const showStatus = this.matchState.phase !== "playing";
    this.statusMessage.setText(this.getMatchStatusText());
    this.statusMessage.setVisible(showStatus);
    this.statusPanel.setVisible(showStatus);
    this.positionMatchStatus(this.scale.width, this.scale.height);
  }

  private refreshScoreboard(): void {
    const rows = ["SCORE"];
    for (const player of this.players) {
      rows.push(
        `P${player.colorIndex + 1} ${this.matchState.scores[player.id] ?? 0}`,
      );
      const specialWeapon = player.weapons.specialWeapon;
      if (specialWeapon !== null) {
        const ammo =
          specialWeapon.ammoRemaining === null
            ? ""
            : ` x${specialWeapon.ammoRemaining}`;
        rows.push(`  [${specialWeapon.hudIcon}]${ammo}`);
      }
    }
    this.scoreboard.setText(rows.join("\n"));
  }

  private getMatchStatusText(): string {
    if (this.matchState.winnerId === null) {
      return this.matchState.phase === "matchOver"
        ? "MATCH DRAW"
        : `ROUND ${this.matchState.round} DRAW\nNext round starting`;
    }

    const winnerIndex = this.players.findIndex(
      (player) => player.id === this.matchState.winnerId,
    );
    const winnerLabel = `PLAYER ${this.players[winnerIndex]!.colorIndex + 1}`;
    return this.matchState.phase === "matchOver"
      ? `${winnerLabel} WINS THE MATCH`
      : `${winnerLabel} WINS ROUND ${this.matchState.round}\nNext round starting`;
  }

  private positionMatchStatus(width: number, height: number): void {
    const centerX = width / 2;
    const centerY = height / 2;
    const padding = config.presentation.statusPanelPadding;
    this.statusMessage.setPosition(centerX, centerY);
    this.statusPanel.clear();
    this.statusPanel.fillStyle(config.presentation.statusPanelColor);
    this.statusPanel.fillRect(
      centerX - this.statusMessage.width / 2 - padding,
      centerY - this.statusMessage.height / 2 - padding,
      this.statusMessage.width + padding * 2,
      this.statusMessage.height + padding * 2,
    );
  }

  private startNextRound(): void {
    this.generateRoundMaze();
    this.bullets = [];
    this.crates = [];
    this.crateSpawnRemaining = config.powerups.crateSpawnInterval;
    const spawnPoints = this.getSpawnPoints();
    for (const [index, player] of this.players.entries()) {
      const spawn = spawnPoints[index]!;
      player.tank = {
        x: (spawn.column + 0.5) * config.maze.cellSize,
        y: (spawn.row + 0.5) * config.maze.cellSize,
        angle: spawn.angle,
      };
      player.alive = true;
      player.weapons.reset();
      player.powerups = createTankPowerupState(config.powerups.tankEffects);
      player.aimGuideHeld = false;
    }
    this.drawMaze(
      this.boardLeft,
      this.boardTop,
      this.displayCellSize,
    );
    this.positionPlayers();
  }

  private createPlayer(
    setup: PlayerSetup,
    spawn: SpawnPoint,
    inputSource: InputSource,
  ): LocalPlayer {
    const graphics = this.add.graphics().setDepth(2);
    const statusGraphics = this.add.graphics().setDepth(4);
    const marker = this.add
      .text(0, 0, `${setup.colorIndex + 1}`, {
        color: config.presentation.markerColor,
        fontFamily: config.presentation.fontFamily,
        fontSize: `${config.presentation.tankMarkerFontSize}px`,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(3);
    const playerColor = config.presentation.playerColors[setup.colorIndex];
    if (playerColor === undefined) {
      throw new RangeError("Player has an unknown color slot.");
    }
    this.drawTank(graphics, playerColor);

    return {
      id: setup.id,
      colorIndex: setup.colorIndex,
      tank: {
        x: (spawn.column + 0.5) * config.maze.cellSize,
        y: (spawn.row + 0.5) * config.maze.cellSize,
        angle: spawn.angle,
      },
      alive: true,
      inputSource,
      weapons: new WeaponLoadout(),
      powerups: createTankPowerupState(config.powerups.tankEffects),
      aimGuideHeld: false,
      graphics,
      statusGraphics,
      marker,
    };
  }

  private positionPlayers(): void {
    for (const player of this.players) {
      player.graphics.setVisible(player.alive);
      player.statusGraphics.setVisible(player.alive);
      player.marker.setVisible(player.alive);
      if (!player.alive) {
        continue;
      }

      const x = this.boardLeft + player.tank.x * this.displayScale;
      const y = this.boardTop + player.tank.y * this.displayScale;
      player.graphics
        .setPosition(x, y)
        .setRotation(player.tank.angle)
        .setScale(this.displayScale);
      player.statusGraphics
        .setPosition(x, y)
        .setScale(this.displayScale);
      this.drawTankStatus(player);
      player.marker.setPosition(x, y).setScale(this.displayScale);
    }
  }

  private drawTankStatus(player: LocalPlayer): void {
    const graphics = player.statusGraphics;
    graphics.clear();
    if (
      player.powerups.shieldCharges > 0 &&
      player.powerups.shieldRemaining > 0
    ) {
      const shieldRadius =
        config.tank.radius + config.presentation.shieldBubblePadding;
      graphics.fillStyle(
        config.presentation.shieldBubbleColor,
        config.presentation.shieldBubbleAlpha,
      );
      graphics.fillCircle(0, 0, shieldRadius);
      graphics.lineStyle(
        config.presentation.shieldBubbleLineThickness,
        config.presentation.shieldBubbleColor,
        config.presentation.shieldBubbleLineAlpha,
      );
      graphics.strokeCircle(0, 0, shieldRadius);
    }

    graphics.fillStyle(config.presentation.playerColors[player.colorIndex]!);
    const healthPipWidth =
      (player.powerups.hitPoints - 1) * config.presentation.healthPipSpacing;
    const firstHealthPipX = -healthPipWidth / 2;
    for (let pip = 0; pip < player.powerups.hitPoints; pip += 1) {
      graphics.fillCircle(
        firstHealthPipX + pip * config.presentation.healthPipSpacing,
        config.presentation.healthPipOffset,
        config.presentation.healthPipRadius,
      );
    }
  }

  private drawTank(
    graphics: Phaser.GameObjects.Graphics,
    color: number,
  ): void {
    const {
      barrelLength,
      barrelWidth,
      radius,
      turretRadius,
      turretColor,
      outlineColor,
      outlineThickness,
    } = config.tank;
    graphics.fillStyle(color);
    graphics.fillRect(0, -barrelWidth / 2, barrelLength, barrelWidth);
    graphics.fillCircle(0, 0, radius);
    graphics.fillStyle(turretColor);
    graphics.fillCircle(0, 0, turretRadius);
    graphics.lineStyle(outlineThickness, outlineColor, 1);
    graphics.strokeCircle(0, 0, radius);
    graphics.strokeCircle(0, 0, turretRadius);
  }

  private stepBullets(deltaSeconds: number): void {
    const state: CombatState = {
      tanks: this.players.map((player) => ({
        id: player.id,
        x: player.tank.x,
        y: player.tank.y,
        radius: config.tank.radius,
        alive: player.alive,
        powerups: player.powerups,
      })),
      bullets: this.bullets,
    };
    const nextState = advanceCombat(
      state,
      deltaSeconds,
      this.wallRects,
      config.bullet,
      config.powerups.tankEffects.invulnerabilityDuration,
      {
        rocketExplosionRadius: config.powerups.rocket.explosionRadius,
        shrapnel: {
          count: config.powerups.fragBomb.shrapnelCount,
          speed: config.powerups.fragBomb.shrapnelSpeed,
          lifetime: config.powerups.fragBomb.shrapnelLifetime,
          radius: config.powerups.fragBomb.shrapnelRadius,
        },
      },
    );
    this.bullets = nextState.bullets;
    let weaponChanged = false;
    for (const event of nextState.events) {
      if (event.type === "beam") {
        this.beamEffects.push({
          ownerId: event.ownerId,
          kind: event.kind,
          segments: event.segments,
          elapsed: 0,
        });
        continue;
      }
      if (event.type === "bounce") {
        soundEffects.playBounce();
        continue;
      }
      if (event.type === "explosion") {
        const owner = this.players.find(
          (player) => player.id === event.ownerId,
        );
        this.explosions.push({
          x: event.x,
          y: event.y,
          color:
            config.presentation.playerColors[owner?.colorIndex ?? 0]!,
          elapsed: 0,
        });
        soundEffects.playExplosion();
        continue;
      }
      const player = this.players.find(({ id }) => id === event.tankId);
      if (player !== undefined) {
        weaponChanged = player.weapons.clearSpecial() || weaponChanged;
        this.explosions.push({
          x: event.x,
          y: event.y,
          color: config.presentation.playerColors[player.colorIndex]!,
          elapsed: 0,
        });
        soundEffects.playExplosion();
      }
    }
    if (weaponChanged) {
      this.refreshScoreboard();
    }
    for (const tank of nextState.tanks) {
      const player = this.players.find(({ id }) => id === tank.id);
      if (player !== undefined) {
        player.alive = tank.alive;
        player.powerups = tank.powerups;
      }
    }
  }

  private updateFiring(
    player: LocalPlayer,
    input: PlayerInput,
  ): void {
    if (!input.fire) {
      return;
    }

    const origin = createBulletOrigin(
      player.tank,
      config.tank.radius,
      config.bullet.radius,
    );
    const hadSpecialWeapon = player.weapons.specialWeapon !== null;
    const result = player.weapons.fire({
      ownerId: player.id,
      origin,
      angle: player.tank.angle,
      activeBullets: this.bullets,
      bulletSettings: config.bullet,
    });
    if (result.bullets.length > 0) {
      this.bullets.push(...result.bullets);
      soundEffects.playFire();
      if (result.bullets.some((bullet) => bullet.kind === "homing-missile")) {
        soundEffects.playMissileLock();
      }
    }
    if (
      hadSpecialWeapon &&
      (result.bullets.length > 0 || result.specialExpired)
    ) {
      this.refreshScoreboard();
    }
  }

  private drawBullets(): void {
    const graphics = this.bulletGraphics;
    graphics.clear();
    graphics.fillStyle(
      config.presentation.bulletGlowColor,
      config.presentation.bulletGlowAlpha,
    );
    for (const bullet of this.bullets) {
      graphics.fillCircle(
        this.boardLeft + bullet.x * this.displayScale,
        this.boardTop + bullet.y * this.displayScale,
        bullet.radius * this.displayScale * config.presentation.bulletGlowScale,
      );
    }
    graphics.fillStyle(config.presentation.bulletColor);
    for (const bullet of this.bullets) {
      if (bullet.kind === "laser") {
        graphics.lineStyle(
          2 * this.displayScale,
          config.presentation.powerupPickupColor,
          0.5,
        );
        graphics.strokeCircle(
          this.boardLeft + bullet.x * this.displayScale,
          this.boardTop + bullet.y * this.displayScale,
          12 * this.displayScale,
        );
        continue;
      }
      if (bullet.kind === "lightning") continue;
      if (bullet.kind === "mine") {
        const blink =
          (bullet.armingRemaining ?? 0) === 0 &&
          Math.floor(
            (bullet.blinkElapsed ?? 0) /
              config.powerups.mine.blinkDuration,
          ) % 2 ===
            0;
        graphics.fillStyle(
          blink
            ? config.presentation.mineArmedColor
            : config.presentation.bulletColor,
        );
      } else if (bullet.kind === "homing-missile") {
        graphics.fillStyle(config.presentation.powerupPickupColor);
      } else {
        graphics.fillStyle(config.presentation.bulletColor);
      }
      graphics.fillCircle(
        this.boardLeft + bullet.x * this.displayScale,
        this.boardTop + bullet.y * this.displayScale,
        bullet.radius * this.displayScale,
      );
    }
  }

  private drawAimGuides(): void {
    const graphics = this.aimGuideGraphics;
    graphics.clear();
    for (const player of this.players) {
      if (!player.alive || !player.aimGuideHeld) {
        continue;
      }

      const start = createBulletOrigin(
        player.tank,
        config.tank.radius,
        config.bullet.radius,
      );
      const path = traceBulletPath(
        {
          ...start,
          velocityX: Math.cos(player.tank.angle) * config.bullet.speed,
          velocityY: Math.sin(player.tank.angle) * config.bullet.speed,
          radius: config.bullet.radius,
        },
        this.wallRects,
        config.bullet.collisionEpsilon,
        config.powerups.aimGuide.maxBounces,
        config.powerups.aimGuide.maxDistance,
      );
      graphics.fillStyle(
        config.presentation.playerColors[player.colorIndex]!,
        config.powerups.aimGuide.alpha,
      );
      for (const segment of path) {
        const distance = Math.hypot(
          segment.end.x - segment.start.x,
          segment.end.y - segment.start.y,
        );
        if (distance === 0) {
          continue;
        }
        const directionX = (segment.end.x - segment.start.x) / distance;
        const directionY = (segment.end.y - segment.start.y) / distance;
        for (
          let along = 0;
          along <= distance;
          along += config.powerups.aimGuide.dotSpacing
        ) {
          graphics.fillCircle(
            this.boardLeft +
              (segment.start.x + directionX * along) * this.displayScale,
            this.boardTop +
              (segment.start.y + directionY * along) * this.displayScale,
            config.powerups.aimGuide.dotRadius * this.displayScale,
          );
        }
      }
    }
  }

  private updateCrates(deltaSeconds: number): void {
    this.crates = this.crates.map((crate) => ({
      ...crate,
      elapsed: crate.elapsed + deltaSeconds,
    }));
    this.crateSpawnRemaining -= deltaSeconds;
    if (this.crateSpawnRemaining <= 0) {
      if (config.powerups.crateSpawnInterval <= 0) {
        throw new RangeError("Crate spawn interval must be greater than zero.");
      }
      this.crateSpawnRemaining += config.powerups.crateSpawnInterval;
      const spawnedCrate = spawnPowerupCrate(
        this.maze,
        this.crates,
        this.players.map((player) => ({
          x: player.tank.x,
          y: player.tank.y,
          radius: config.tank.radius,
          alive: player.alive,
        })),
        {
          maxCrates: config.powerups.maxCrates,
          cellSize: config.maze.cellSize,
          wallThickness: config.maze.wallThickness,
          crateRadius: config.powerups.crateRadius,
        },
        config.powerups.crateWeights,
        this.random,
      );
      if (spawnedCrate !== null) {
        this.crates.push({ ...spawnedCrate, elapsed: 0 });
      }
    }

    for (let crateIndex = this.crates.length - 1; crateIndex >= 0; crateIndex -= 1) {
      const crate = this.crates[crateIndex]!;
      const player = this.players.find((candidate) =>
        tankTouchesCrate(
          {
            x: candidate.tank.x,
            y: candidate.tank.y,
            radius: config.tank.radius,
            alive: candidate.alive,
          },
          crate,
          config.maze.cellSize,
          config.powerups.crateRadius,
        ),
      );
      if (player === undefined) {
        continue;
      }

      const center = crateCenter(crate, config.maze.cellSize);
      switch (crate.powerupId) {
        case "double-shot":
        case "rocket":
        case "shotgun":
        case "frag-bomb":
        case "homing-missile":
        case "mine":
        case "laser":
        case "lightning":
          player.weapons.pickUp(createSpecialWeapon(crate.powerupId));
          break;
        default:
          player.powerups = applyPassivePowerup(
            player.powerups,
            crate.powerupId,
            config.powerups.tankEffects,
          );
      }
      this.pickupEffects.push({ ...center, elapsed: 0 });
      this.crates.splice(crateIndex, 1);
      soundEffects.playPickup();
      this.refreshScoreboard();
    }
  }

  private drawCrates(): void {
    const graphics = this.crateGraphics;
    graphics.clear();
    for (const crate of this.crates) {
      const center = crateCenter(crate, config.maze.cellSize);
      const spawnProgress = Math.min(
        1,
        crate.elapsed / config.powerups.crateSpawnInDuration,
      );
      const scale =
        config.presentation.powerupCrateSpawnStartScale +
        (1 - config.presentation.powerupCrateSpawnStartScale) *
          spawnProgress;
      const size = config.powerups.crateRadius * 2 * this.displayScale * scale;
      const x = this.boardLeft + center.x * this.displayScale;
      const y = this.boardTop + center.y * this.displayScale;
      const alpha = spawnProgress;

      graphics.fillStyle(config.presentation.powerupCrateFillColor, alpha);
      graphics.fillRect(x - size / 2, y - size / 2, size, size);
      graphics.lineStyle(
        config.presentation.powerupCrateBorderThickness * this.displayScale,
        config.presentation.powerupCrateBorderColor,
        alpha,
      );
      graphics.strokeRect(x - size / 2, y - size / 2, size, size);

      const iconSize =
        size * config.presentation.powerupCrateIconScale;
      this.drawPowerupIcon(
        graphics,
        crate.powerupId,
        x,
        y,
        iconSize,
        alpha,
      );
    }
  }

  private drawPowerupIcon(
    graphics: Phaser.GameObjects.Graphics,
    powerup: PowerupType,
    x: number,
    y: number,
    size: number,
    alpha: number,
  ): void {
    const color =
      config.presentation.powerupCrateIconColors[powerup];
    const lineThickness =
      config.presentation.powerupCrateIconLineThickness * this.displayScale;
    graphics.fillStyle(color, alpha);
    graphics.lineStyle(lineThickness, color, alpha);

    switch (powerup) {
      case "double-shot":
        graphics.fillCircle(x - size * 0.2, y, size * 0.13);
        graphics.fillCircle(x + size * 0.2, y, size * 0.13);
        break;
      case "rocket": {
        const bodyWidth =
          size * config.presentation.powerupCrateIconRocketBodyWidthScale;
        const noseOffset =
          size * config.presentation.powerupCrateIconRocketNoseScale;
        const tailOffset =
          size * config.presentation.powerupCrateIconRocketTailScale;
        graphics.fillRect(
          x - bodyWidth / 2,
          y - tailOffset,
          bodyWidth,
          tailOffset + noseOffset * 0.35,
        );
        graphics.fillTriangle(
          x - bodyWidth / 2,
          y - noseOffset * 0.3,
          x + bodyWidth / 2,
          y - noseOffset * 0.3,
          x,
          y - noseOffset,
        );
        graphics.fillTriangle(
          x - bodyWidth / 2,
          y + tailOffset * 0.45,
          x - bodyWidth / 2,
          y + tailOffset,
          x - size * 0.34,
          y + tailOffset,
        );
        graphics.fillTriangle(
          x + bodyWidth / 2,
          y + tailOffset * 0.45,
          x + bodyWidth / 2,
          y + tailOffset,
          x + size * 0.34,
          y + tailOffset,
        );
        break;
      }
      case "shotgun": {
        const spread = size * config.presentation.powerupCrateIconShotgunSpreadScale;
        const pelletRadius =
          size * config.presentation.powerupCrateIconShotgunPelletRadiusScale;
        for (const [offsetX, offsetY] of [
          [-spread, -spread],
          [0, -spread * 0.45],
          [spread, -spread],
        ]) {
          graphics.fillCircle(x + offsetX, y + offsetY, pelletRadius);
        }
        graphics.fillRect(
          x - size * 0.1,
          y + spread * 0.12,
          size * 0.2,
          spread,
        );
        break;
      }
      case "frag-bomb":
        graphics.fillCircle(x, y + size * 0.08, size * 0.27);
        graphics.beginPath();
        graphics.moveTo(
          x + size * config.presentation.powerupCrateIconFragFuseScale * 0.25,
          y - size * config.presentation.powerupCrateIconFragFuseScale * 0.6,
        );
        graphics.lineTo(
          x + size * config.presentation.powerupCrateIconFragFuseScale * 0.65,
          y - size * config.presentation.powerupCrateIconFragFuseScale,
        );
        graphics.lineTo(
          x + size * config.presentation.powerupCrateIconFragFuseScale,
          y - size * config.presentation.powerupCrateIconFragFuseScale,
        );
        graphics.strokePath();
        graphics.fillCircle(
          x + size * config.presentation.powerupCrateIconFragFuseScale * 1.1,
          y - size * config.presentation.powerupCrateIconFragFuseScale,
          size * 0.05,
        );
        break;
      case "shield": {
        const halfWidth =
          size * config.presentation.powerupCrateIconShieldWidthScale / 2;
        const halfHeight =
          size * config.presentation.powerupCrateIconShieldHeightScale / 2;
        graphics.beginPath();
        graphics.moveTo(x - halfWidth, y - halfHeight);
        graphics.lineTo(x + halfWidth, y - halfHeight);
        graphics.lineTo(x + halfWidth * 0.82, y + halfHeight * 0.25);
        graphics.lineTo(x, y + halfHeight);
        graphics.lineTo(x - halfWidth * 0.82, y + halfHeight * 0.25);
        graphics.closePath();
        graphics.fillPath();
        break;
      }
      case "extra-life": {
        const arm =
          size * config.presentation.powerupCrateIconHealthArmScale;
        const width =
          size * config.presentation.powerupCrateIconHealthWidthScale;
        graphics.fillRect(x - width / 2, y - arm / 2, width, arm);
        graphics.fillRect(x - arm / 2, y - width / 2, arm, width);
        break;
      }
      case "speed-boost":
        graphics.beginPath();
        graphics.moveTo(x + size * 0.12, y - size * 0.42);
        graphics.lineTo(x - size * 0.22, y + size * 0.02);
        graphics.lineTo(x - size * 0.02, y + size * 0.02);
        graphics.lineTo(x - size * 0.15, y + size * 0.42);
        graphics.lineTo(x + size * 0.25, y - size * 0.08);
        graphics.lineTo(x + size * 0.04, y - size * 0.08);
        graphics.closePath();
        graphics.fillPath();
        break;
      case "ghost":
        graphics.fillCircle(x, y - size * 0.08, size * 0.28);
        graphics.fillRect(x - size * 0.28, y - size * 0.08, size * 0.56, size * 0.3);
        for (const eyeOffset of [-0.1, 0.1]) {
          graphics.fillStyle(config.presentation.powerupCrateFillColor, alpha);
          graphics.fillCircle(
            x + size * eyeOffset,
            y - size * 0.05,
            size * 0.04,
          );
          graphics.fillStyle(color, alpha);
        }
        break;
      case "aim-guide": {
        const spacing =
          size * config.presentation.powerupCrateIconAimDotSpacingScale;
        const radius =
          size * config.presentation.powerupCrateIconShotgunPelletRadiusScale;
        for (
          let dot = 0;
          dot < config.presentation.powerupCrateIconAimDotCount;
          dot += 1
        ) {
          graphics.fillCircle(
            x + dot * spacing - spacing,
            y,
            radius *
              (1 - dot * config.presentation.powerupCrateIconAimDotFalloffScale),
          );
        }
        graphics.fillTriangle(
          x + spacing * 1.15,
          y - radius,
          x + spacing * 1.15,
          y + radius,
          x + spacing * 1.6,
          y,
        );
        break;
      }
      case "homing-missile":
        graphics.fillTriangle(
          x,
          y - size * 0.38,
          x - size * 0.24,
          y + size * 0.28,
          x + size * 0.24,
          y + size * 0.28,
        );
        graphics.beginPath();
        graphics.moveTo(x - size * 0.16, y + size * 0.2);
        graphics.lineTo(x - size * 0.38, y + size * 0.38);
        graphics.moveTo(x + size * 0.16, y + size * 0.2);
        graphics.lineTo(x + size * 0.38, y + size * 0.38);
        graphics.strokePath();
        break;
      case "mine":
        graphics.fillCircle(x, y, size * 0.28);
        for (let point = 0; point < 8; point += 1) {
          const angle = (point / 8) * Math.PI * 2;
          graphics.fillRect(
            x + Math.cos(angle) * size * 0.34 - size * 0.04,
            y + Math.sin(angle) * size * 0.34 - size * 0.04,
            size * 0.08,
            size * 0.08,
          );
        }
        break;
      case "laser":
        graphics.lineStyle(
          size * config.presentation.powerupCrateIconLaserWidthScale,
          color,
          alpha,
        );
        graphics.beginPath();
        graphics.moveTo(x - size * 0.38, y);
        graphics.lineTo(x + size * 0.38, y);
        graphics.strokePath();
        graphics.fillTriangle(
          x - size * 0.42,
          y - size * 0.12,
          x - size * 0.42,
          y + size * 0.12,
          x - size * 0.22,
          y,
        );
        break;
      case "lightning": {
        const jagWidth = size * 0.22;
        const top = y - size * 0.38;
        const bottom = y + size * 0.38;
        graphics.beginPath();
        graphics.moveTo(x + size * 0.12, top);
        graphics.lineTo(x - size * 0.12, y - size * 0.05);
        graphics.lineTo(x + size * 0.08, y - size * 0.05);
        graphics.lineTo(x - jagWidth, bottom);
        graphics.lineTo(x + size * 0.02, y + size * 0.08);
        graphics.lineTo(x + size * 0.18, y + size * 0.08);
        graphics.closePath();
        graphics.fillPath();
        break;
      }
      default: {
        const unsupportedPowerup: never = powerup;
        throw new RangeError(`Unknown crate icon: ${unsupportedPowerup}`);
      }
    }
  }

  private updateBeamEffects(deltaSeconds: number): void {
    this.beamEffects = this.beamEffects
      .map((effect) => ({
        ...effect,
        elapsed: effect.elapsed + deltaSeconds,
      }))
      .filter((effect) => effect.elapsed < 0.18);
  }

  private drawBeamEffects(): void {
    const graphics = this.beamGraphics;
    graphics.clear();
    for (const effect of this.beamEffects) {
      const player = this.players.find(
        (candidate) => candidate.id === effect.ownerId,
      );
      const color =
        effect.kind === "lightning"
          ? config.presentation.playerColors[player?.colorIndex ?? 0]!
          : config.presentation.powerupPickupColor;
      graphics.lineStyle(
        effect.kind === "laser"
          ? config.powerups.laser.beamWidth * this.displayScale
          : 3 * this.displayScale,
        color,
        0.8,
      );
      for (const segment of effect.segments) {
        graphics.beginPath();
        graphics.moveTo(
          this.boardLeft + segment.start.x * this.displayScale,
          this.boardTop + segment.start.y * this.displayScale,
        );
        graphics.lineTo(
          this.boardLeft + segment.end.x * this.displayScale,
          this.boardTop + segment.end.y * this.displayScale,
        );
        graphics.strokePath();
      }
    }
  }

  private updatePickupEffects(deltaSeconds: number): void {
    this.pickupEffects = this.pickupEffects
      .map((effect) => ({
        ...effect,
        elapsed: effect.elapsed + deltaSeconds,
      }))
      .filter(
        (effect) => effect.elapsed < config.powerups.pickupEffectDuration,
      );
  }

  private drawPickupEffects(): void {
    const graphics = this.pickupGraphics;
    graphics.clear();
    for (const effect of this.pickupEffects) {
      const progress = effect.elapsed / config.powerups.pickupEffectDuration;
      const radius =
        config.powerups.crateRadius *
        this.displayScale *
        (config.presentation.powerupPickupRingStartScale +
          (config.presentation.powerupPickupRingEndScale -
            config.presentation.powerupPickupRingStartScale) *
            progress);
      graphics.lineStyle(
        config.presentation.powerupPickupRingThickness * this.displayScale,
        config.presentation.powerupPickupColor,
        1 - progress,
      );
      graphics.strokeCircle(
        this.boardLeft + effect.x * this.displayScale,
        this.boardTop + effect.y * this.displayScale,
        radius,
      );
    }
  }

  private clearRoundPowerups(): void {
    this.crates = [];
    this.beamEffects = [];
    this.crateSpawnRemaining = config.powerups.crateSpawnInterval;
    for (const player of this.players) {
      player.weapons.reset();
      player.powerups = createTankPowerupState(config.powerups.tankEffects);
      player.aimGuideHeld = false;
    }
  }

  private updateExplosions(deltaSeconds: number): void {
    this.explosions = this.explosions
      .map((explosion) => ({
        ...explosion,
        elapsed: explosion.elapsed + deltaSeconds,
      }))
      .filter(
        (explosion) =>
          explosion.elapsed < config.presentation.explosionLifetime,
      );
  }

  private drawExplosions(): void {
    const graphics = this.explosionGraphics;
    graphics.clear();
    for (const explosion of this.explosions) {
      const progress = explosion.elapsed / config.presentation.explosionLifetime;
      const alpha = 1 - progress;
      const centerX = this.boardLeft + explosion.x * this.displayScale;
      const centerY = this.boardTop + explosion.y * this.displayScale;
      const waveRadius =
        (config.presentation.explosionStartRadius +
          (config.presentation.explosionMaxRadius -
            config.presentation.explosionStartRadius) *
            progress) *
        this.displayScale;
      graphics.lineStyle(
        config.presentation.explosionRingThickness * this.displayScale,
        config.presentation.explosionRingColor,
        alpha,
      );
      graphics.strokeCircle(centerX, centerY, waveRadius);
      graphics.fillStyle(config.presentation.explosionCoreColor, alpha);
      graphics.fillCircle(
        centerX,
        centerY,
        waveRadius * config.presentation.explosionCenterRadiusScale,
      );

      for (
        let particle = 0;
        particle < config.presentation.explosionParticleCount;
        particle += 1
      ) {
        const angle =
          (particle / config.presentation.explosionParticleCount) *
            Math.PI *
            2 +
          progress * config.presentation.explosionRotationSpeed;
        const distance =
          progress *
          config.presentation.explosionMaxRadius *
          this.displayScale;
        const radius =
          config.presentation.explosionParticleRadius *
          this.displayScale *
          alpha;
        graphics.fillStyle(explosion.color, alpha);
        graphics.fillCircle(
          centerX + Math.cos(angle) * distance,
          centerY + Math.sin(angle) * distance,
          radius,
        );
      }
    }
  }

  private toggleAudio(): void {
    const muted = soundEffects.toggleMuted();
    if (!muted) {
      soundEffects.unlock();
    }
    this.updateAudioToggle();
  }

  private updateAudioToggle(): void {
    this.audioToggle.setText(
      soundEffects.isMuted ? "SOUND OFF" : "SOUND ON",
    );
  }

  private drawMaze(left: number, top: number, cellSize: number): void {
    const graphics = this.mazeGraphics;
    const wallThickness = config.maze.wallThickness;
    const halfWall = wallThickness / 2;

    graphics.clear();
    graphics.fillStyle(config.presentation.floorColor);
    graphics.fillRect(
      left - halfWall,
      top - halfWall,
      this.maze.columns * cellSize + wallThickness,
      this.maze.rows * cellSize + wallThickness,
    );
    graphics.lineStyle(wallThickness, config.presentation.wallColor, 1);
    graphics.beginPath();

    for (let row = 0; row < this.maze.rows; row += 1) {
      for (let column = 0; column < this.maze.columns; column += 1) {
        const { walls } = this.maze.cells[row]![column]!;
        const cellLeft = left + column * cellSize;
        const cellTop = top + row * cellSize;

        if (walls.top) {
          graphics.moveTo(cellLeft, cellTop);
          graphics.lineTo(cellLeft + cellSize, cellTop);
        }
        if (walls.left) {
          graphics.moveTo(cellLeft, cellTop);
          graphics.lineTo(cellLeft, cellTop + cellSize);
        }
        if (column === this.maze.columns - 1 && walls.right) {
          graphics.moveTo(cellLeft + cellSize, cellTop);
          graphics.lineTo(cellLeft + cellSize, cellTop + cellSize);
        }
        if (row === this.maze.rows - 1 && walls.bottom) {
          graphics.moveTo(cellLeft, cellTop + cellSize);
          graphics.lineTo(cellLeft + cellSize, cellTop + cellSize);
        }
      }
    }

    graphics.strokePath();
  }
}
