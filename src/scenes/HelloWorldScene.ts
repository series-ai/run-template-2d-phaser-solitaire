import Phaser from 'phaser';
import RundotGameAPI from "@series-inc/rundot-game-sdk/api";

export default class HelloWorldScene extends Phaser.Scene {
  private mainText!: Phaser.GameObjects.Text;
  private ball!: Phaser.GameObjects.Arc;
  private clickButton!: Phaser.GameObjects.Text;

  constructor() {
    super("hello-world");
  }

  create(): void {
    RundotGameAPI.log("[HelloWorldScene] Create called - RundotGameAPI already initialized");

    const gameWidth = this.scale.width;
    const gameHeight = this.scale.height;
    const centerX = gameWidth / 2;
    const centerY = gameHeight / 2;

    // Simple background
    this.add.rectangle(centerX, centerY, gameWidth, gameHeight, 0x1a1a2e);

    // Create a simple yellow ball
    this.ball = this.add.circle(centerX, 200, 30, 0xffff00);

    // Enable physics on the ball
    this.physics.add.existing(this.ball);
    const body = this.ball.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setBounce(1);
    body.setCircle(30);

    // Add text
    this.mainText = this.add.text(centerX, centerY, "Game Started!", {
      fontSize: "24px",
      color: "#ffffff",
      align: "center",
    });
    this.mainText.setOrigin(0.5);

    // Start ball movement immediately (RundotGameAPI is ready)
    body.setVelocity(150, 200);

    // Add color changing animation
    this.time.addEvent({
      delay: 1000,
      callback: () => {
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        this.ball.setFillStyle(randomColor);
      },
      loop: true,
    });

    // Update text and create button after delay
    this.time.delayedCall(1500, () => {
      this.mainText.setText("Bouncing Ball Template v.0.0.4.woof");
      this.createButton();
    });

    // Set up dialog close button listener
    const closeBtn = document.getElementById('close-dialog-btn');
    closeBtn?.addEventListener('click', () => this.hideDialog());
  }

  update(): void {
    // Maintain ball speed
    const body = this.ball.body as Phaser.Physics.Arcade.Body;
    const speed = Math.sqrt(body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y);
    if (speed > 0 && speed < 270) {
      const scale = 300 / speed;
      body.setVelocity(body.velocity.x * scale, body.velocity.y * scale);
    }
  }

  private createButton(): void {
    const gameWidth = this.scale.width;
    const gameHeight = this.scale.height;
    const centerX = gameWidth / 2;

    this.clickButton = this.add.text(centerX, gameHeight - 100, "Click me", {
      fontSize: "20px",
      color: "#ffffff",
      backgroundColor: "#e74c3c",
      padding: { x: 20, y: 10 },
    });
    this.clickButton.setOrigin(0.5);
    this.clickButton.setInteractive({ useHandCursor: true });

    this.clickButton.on("pointerdown", () => {
      this.showDialog();
    });
  }

  private showDialog(): void {
    const overlay = document.getElementById("dialog-overlay");
    if (overlay) {
      overlay.classList.remove("hidden");
    }
  }

  private hideDialog(): void {
    const overlay = document.getElementById('dialog-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }
}