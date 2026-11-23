import Phaser from "phaser";
import { config } from "../config";
import {
  advanceBullet,
  tryCreateBullet,
  type BulletState,
} from "../game/bullet";
import { generateMaze, type Maze } from "../game/maze";
import {
  createMazeWallRects,
  moveTank,
  type TankState,
  type WallRect,
} from "../game/tankMovement";
import type { InputSource, PlayerInput } from "../input/InputSource";
import { KeyboardInput } from "../input/KeyboardInput";

export class GameScene extends Phaser.Scene {
  private maze!: Maze;
  private wallRects!: WallRect[];
  private tank!: TankState;
  private bullets: BulletState[] = [];
  private inputSource!: InputSource;
  private accumulator = 0;
  private fireCooldown = 0;
  private displayScale = 1;
  private boardLeft = 0;
  private boardTop = 0;
  private mazeGraphics!: Phaser.GameObjects.Graphics;
  private bulletGraphics!: Phaser.GameObjects.Graphics;
  private tankGraphics!: Phaser.GameObjects.Graphics;
  private tankMarker!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;

  constructor() {
    super("game");
  }

  create(): void {
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
    this.tank = {
      x: config.maze.cellSize * 1.5,
      y: config.maze.cellSize * 0.5,
      angle: 0,
    };
    this.inputSource = new KeyboardInput(
      window,
      config.input.keyboardSchemes[0],
    );
    this.mazeGraphics = this.add.graphics();
    this.bulletGraphics = this.add.graphics().setDepth(1);
    this.tankGraphics = this.add.graphics().setDepth(1);
    this.tankMarker = this.add
      .text(0, 0, "1", {
        color: config.presentation.markerColor,
        fontFamily: config.presentation.fontFamily,
        fontSize: `${config.presentation.tankMarkerFontSize}px`,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(2);
    this.drawTank();
    this.title = this.add
      .text(0, 0, "Tanks With Friends", {
        color: config.presentation.titleColor,
        fontFamily: config.presentation.fontFamily,
        fontSize: `${config.presentation.titleFontSize}px`,
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.subtitle = this.add
      .text(0, 0, "W/S drive  A/D turn  Space fire", {
        color: config.presentation.subtitleColor,
        fontFamily: config.presentation.fontFamily,
        fontSize: `${config.presentation.subtitleFontSize}px`,
      })
      .setOrigin(0.5);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.layout({ width: this.scale.width, height: this.scale.height });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.inputSource.destroy();
    });
  }

  update(_time: number, deltaMilliseconds: number): void {
    this.accumulator += deltaMilliseconds / 1000;
    while (this.accumulator >= config.simulation.fixedTimeStep) {
      const input = this.inputSource.read();
      this.tank = moveTank(
        this.tank,
        input,
        config.simulation.fixedTimeStep,
        this.wallRects,
        config.tank,
      );
      this.stepBullets(config.simulation.fixedTimeStep);
      this.updateFiring(input, config.simulation.fixedTimeStep);
      this.accumulator -= config.simulation.fixedTimeStep;
    }
    this.positionTank();
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
    this.positionTank();
  }

  private drawTank(): void {
    const graphics = this.tankGraphics;
    const {
      barrelLength,
      barrelWidth,
      radius,
      turretRadius,
      turretColor,
      outlineColor,
      outlineThickness,
    } = config.tank;
    graphics.fillStyle(config.presentation.playerColors[0]!);
    graphics.fillRect(0, -barrelWidth / 2, barrelLength, barrelWidth);
    graphics.fillCircle(0, 0, radius);
    graphics.fillStyle(turretColor);
    graphics.fillCircle(0, 0, turretRadius);
    graphics.lineStyle(outlineThickness, outlineColor, 1);
    graphics.strokeCircle(0, 0, radius);
    graphics.strokeCircle(0, 0, turretRadius);
  }

  private positionTank(): void {
    const x = this.boardLeft + this.tank.x * this.displayScale;
    const y = this.boardTop + this.tank.y * this.displayScale;
    this.tankGraphics
      .setPosition(x, y)
      .setRotation(this.tank.angle)
      .setScale(this.displayScale);
    this.tankMarker
      .setPosition(x, y)
      .setScale(this.displayScale);
  }

  private stepBullets(deltaSeconds: number): void {
    this.bullets = this.bullets.flatMap((bullet) => {
      const advanced = advanceBullet(
        bullet,
        deltaSeconds,
        this.wallRects,
        config.bullet,
      );
      return advanced === null ? [] : [advanced];
    });
  }

  private updateFiring(input: PlayerInput, deltaSeconds: number): void {
    this.fireCooldown = Math.max(0, this.fireCooldown - deltaSeconds);
    if (!input.fire || this.fireCooldown > 0) {
      return;
    }

    const muzzleDistance = config.tank.radius - config.bullet.radius;
    const origin = {
      x: this.tank.x + Math.cos(this.tank.angle) * muzzleDistance,
      y: this.tank.y + Math.sin(this.tank.angle) * muzzleDistance,
    };
    const bullet = tryCreateBullet(
      "player-1",
      origin,
      this.tank.angle,
      this.bullets,
      config.bullet,
    );
    if (bullet !== null) {
      this.bullets.push(bullet);
      this.fireCooldown = config.bullet.fireCooldown;
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
