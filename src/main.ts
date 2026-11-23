import Phaser from "phaser";
import { config } from "./config";
import { GameScene } from "./scenes/GameScene";
import "./style.css";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: config.presentation.backgroundColor,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [GameScene],
});
