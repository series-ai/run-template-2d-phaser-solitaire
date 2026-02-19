import Phaser from 'phaser';
import HelloWorldScene from './scenes/HelloWorldScene';
import './style.css';
import RundotGameAPI from "@series-inc/rundot-game-sdk/api";

async function bootstrap(): Promise<void> {
  try {
    // Create Phaser game
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 720,
      height: 1560,
      parent: "app",
      backgroundColor: "#2c3e50",
      scene: HelloWorldScene,
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    new Phaser.Game(config);
    RundotGameAPI.log("[Main] Phaser game created");
  } catch (error) {
    console.error("[Main] Bootstrap error:", error);
  }
}

// Start the app
bootstrap();
