import Phaser from "phaser";
import { config } from "../config";
import {
  tryCreateBullet,
  type BulletState,
} from "../game/bullet";
import { advanceCombat, type CombatState } from "../game/combat";
import { generateMaze, type Maze } from "../game/maze";
import {
  createMazeWallRects,
  moveTank,
  type TankState,
  type WallRect,
} from "../game/tankMovement";
import type { InputSource, PlayerInput } from "../input/InputSource";
import { CombinedInputSource } from "../input/CombinedInputSource";
import { GamepadInput } from "../input/GamepadInput";
import { KeyboardInput } from "../input/KeyboardInput";

interface SpawnPoint {
  column: number;
  row: number;
  angle: number;
}

interface LocalPlayer {
  id: string;
  tank: TankState;
  alive: boolean;
  inputSource: InputSource;
  fireCooldown: number;
  graphics: Phaser.GameObjects.Graphics;
  marker: Phaser.GameObjects.Text;
}

export class GameScene extends Phaser.Scene {
  private maze!: Maze;
  private wallRects!: WallRect[];
  private players: LocalPlayer[] = [];
  private bullets: BulletState[] = [];
  private accumulator = 0;
  private controllerDisconnected = false;
  private pausedForDisconnect = false;
  private displayScale = 1;
  private boardLeft = 0;
  private boardTop = 0;
  private mazeGraphics!: Phaser.GameObjects.Graphics;
  private bulletGraphics!: Phaser.GameObjects.Graphics;
  private disconnectPanel!: Phaser.GameObjects.Graphics;
  private disconnectMessage!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;

  constructor() {
    super("game");
  }

  create(): void {
    this.players = [];
    this.bullets = [];
    this.accumulator = 0;
    this.controllerDisconnected = false;
    this.pausedForDisconnect = false;
    this.maze = generateMaze(
      config.maze.columns,
      config.maze.rows,
      config.maze.extraOpenings,
    );
    this.wallRects = createMazeWallRects(
      this.maze,
      config.maze.cellSize,
      config.maze.wallThickness,
    );
    this.mazeGraphics = this.add.graphics();
    this.bulletGraphics = this.add.graphics().setDepth(1);
    const gamepadInput = new GamepadInput(
      config.input.defaultGamepadIndex,
      config.input.gamepadDeadZone,
      config.input.gamepadFireThreshold,
      {
        onConnectionChange: (connected) =>
          this.handleControllerConnection(connected),
      },
    );
    const spawnPoints: SpawnPoint[] = [
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
    const playerCount = Math.min(
      config.match.preLobbyPlayerCount,
      spawnPoints.length,
      config.input.keyboardSchemes.length,
      config.presentation.playerColors.length,
    );
    for (let index = 0; index < playerCount; index += 1) {
      const inputSource =
        index === 0
          ? new CombinedInputSource(
              gamepadInput,
              new KeyboardInput(window, config.input.keyboardSchemes[index]!),
            )
          : new KeyboardInput(window, config.input.keyboardSchemes[index]!);
      this.players.push(
        this.createPlayer(index, spawnPoints[index]!, inputSource),
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
    this.accumulator += deltaMilliseconds / 1000;
    while (this.accumulator >= config.simulation.fixedTimeStep) {
      const controls: Array<{ player: LocalPlayer; input: PlayerInput }> = [];
      for (const player of this.players) {
        if (!player.alive) {
          continue;
        }
        const playerInput = player.inputSource.read();
        if (this.controllerDisconnected) {
          break;
        }
        player.tank = moveTank(
          player.tank,
          playerInput,
          config.simulation.fixedTimeStep,
          this.wallRects,
          config.tank,
        );
        controls.push({ player, input: playerInput });
      }

      if (this.controllerDisconnected) {
        this.accumulator = 0;
        break;
      }
      this.stepBullets(config.simulation.fixedTimeStep);
      for (const { player, input } of controls) {
        if (player.alive) {
          this.updateFiring(player, input, config.simulation.fixedTimeStep);
        }
      }
      this.accumulator -= config.simulation.fixedTimeStep;
    }
    this.positionPlayers();
    this.drawBullets();
  }

  private layout(gameSize: { width: number; height: number }): void {
    const { width, height } = gameSize;
    const { boardPadding, titleTopOffset, titleHeight } =
      config.presentation;
    const availableWidth = width - boardPadding * 2;
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
    this.boardLeft = (width - boardWidth) / 2;
    this.boardTop =
      boardPadding + titleHeight + (availableHeight - boardHeight) / 2;

    this.title.setPosition(width / 2, titleTopOffset);
    this.subtitle.setPosition(width / 2, titleTopOffset + titleHeight / 2);
    this.drawMaze(this.boardLeft, this.boardTop, cellSize);
    this.positionPlayers();
    this.positionDisconnectNotice(width, height);
  }

  private handleControllerConnection(connected: boolean): void {
    this.controllerDisconnected = !connected;
    this.disconnectPanel.setVisible(!connected);
    this.disconnectMessage.setVisible(!connected);

    if (connected) {
      if (this.pausedForDisconnect) {
        this.pausedForDisconnect = false;
        this.scene.resume();
      }
      return;
    }

    this.pausedForDisconnect = true;
    this.positionDisconnectNotice(this.scale.width, this.scale.height);
    this.scene.pause();
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

  private createPlayer(
    index: number,
    spawn: SpawnPoint,
    inputSource: InputSource,
  ): LocalPlayer {
    const graphics = this.add.graphics().setDepth(2);
    const marker = this.add
      .text(0, 0, `${index + 1}`, {
        color: config.presentation.markerColor,
        fontFamily: config.presentation.fontFamily,
        fontSize: `${config.presentation.tankMarkerFontSize}px`,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(3);
    this.drawTank(graphics, config.presentation.playerColors[index]!);

    return {
      id: `player-${index + 1}`,
      tank: {
        x: (spawn.column + 0.5) * config.maze.cellSize,
        y: (spawn.row + 0.5) * config.maze.cellSize,
        angle: spawn.angle,
      },
      alive: true,
      inputSource,
      fireCooldown: 0,
      graphics,
      marker,
    };
  }

  private positionPlayers(): void {
    for (const player of this.players) {
      player.graphics.setVisible(player.alive);
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
      player.marker.setPosition(x, y).setScale(this.displayScale);
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
      })),
      bullets: this.bullets,
    };
    const nextState = advanceCombat(
      state,
      deltaSeconds,
      this.wallRects,
      config.bullet,
    );
    this.bullets = nextState.bullets;
    for (const tank of nextState.tanks) {
      const player = this.players.find(({ id }) => id === tank.id);
      if (player !== undefined) {
        player.alive = tank.alive;
      }
    }
  }

  private updateFiring(
    player: LocalPlayer,
    input: PlayerInput,
    deltaSeconds: number,
  ): void {
    player.fireCooldown = Math.max(0, player.fireCooldown - deltaSeconds);
    if (!input.fire || player.fireCooldown > 0) {
      return;
    }

    const muzzleDistance = config.tank.radius - config.bullet.radius;
    const origin = {
      x: player.tank.x + Math.cos(player.tank.angle) * muzzleDistance,
      y: player.tank.y + Math.sin(player.tank.angle) * muzzleDistance,
    };
    const bullet = tryCreateBullet(
      player.id,
      origin,
      player.tank.angle,
      this.bullets,
      config.bullet,
    );
    if (bullet !== null) {
      this.bullets.push(bullet);
      player.fireCooldown = config.bullet.fireCooldown;
    }
  }

  private drawBullets(): void {
    const graphics = this.bulletGraphics;
    graphics.clear();
    graphics.fillStyle(config.presentation.bulletColor);
    for (const bullet of this.bullets) {
      graphics.fillCircle(
        this.boardLeft + bullet.x * this.displayScale,
        this.boardTop + bullet.y * this.displayScale,
        bullet.radius * this.displayScale,
      );
    }
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
