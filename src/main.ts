import Phaser from 'phaser';
import SolitaireScene from './scenes/SolitaireScene';
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
      backgroundColor: "#006400",
      scene: SolitaireScene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    new Phaser.Game(config);
    RundotGameAPI.log("[Main] Solitaire game created");
  } catch (error) {
    console.error("[Main] Bootstrap error:", error);
  }
}

// Start the app
bootstrap();
