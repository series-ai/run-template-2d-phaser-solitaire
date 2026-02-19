import Phaser from 'phaser';

interface Card {
  suit: string;
  rank: number;
  color: 'red' | 'black';
  faceUp: boolean;
  sprite: Phaser.GameObjects.Graphics & { card?: Card };
  text: Phaser.GameObjects.Text;
  container: Phaser.GameObjects.Container;
}

interface Pile {
  cards: Card[];
  x: number;
  y: number;
}

export default class SolitaireScene extends Phaser.Scene {
  private readonly CARD_WIDTH = 80;
  private readonly CARD_HEIGHT = 110;
  private readonly CARD_SPACING = 100;
  private readonly STACK_OFFSET_Y = 50;
  private readonly FACE_DOWN_OFFSET_Y = 10;

  private readonly SUITS = ['♠', '♥', '♦', '♣'];
  private readonly SUIT_COLORS = ['black', 'red', 'red', 'black'] as const;
  private readonly RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  private tableau: Pile[] = [];
  private foundations: Pile[] = [];
  private stock: Card[] = [];
  private waste: Pile = { cards: [], x: 0, y: 0 };

  private draggedCards: Card[] = [];
  private dragStartPile: Pile | null = null;
  private dragStartIndex = 0;

  constructor() {
    super({ key: 'SolitaireScene' });
  }

  create() {
    // Set up the game board
    this.setupBoard();

    // Deal cards
    this.dealCards();

    // Add reset button
    this.addResetButton();
  }

  private setupBoard() {
    const padding = 20;
    const startX = padding + this.CARD_WIDTH / 2;
    const startY = padding + this.CARD_HEIGHT / 2;

    // Foundation piles (top right)
    for (let i = 0; i < 4; i++) {
      this.foundations.push({
        cards: [],
        x: startX + (3 + i) * this.CARD_SPACING,
        y: startY
      });
      this.drawEmptyPile(this.foundations[i].x, this.foundations[i].y);
    }

    // Stock pile (top left)
    this.waste.x = startX + this.CARD_SPACING;
    this.waste.y = startY;

    // Draw stock pile outline
    const stockOutline = this.add.graphics();
    stockOutline.lineStyle(2, 0x00ff00, 1);
    stockOutline.strokeRoundedRect(
      startX - this.CARD_WIDTH / 2,
      startY - this.CARD_HEIGHT / 2,
      this.CARD_WIDTH,
      this.CARD_HEIGHT,
      5
    );
    stockOutline.setInteractive(
      new Phaser.Geom.Rectangle(
        startX - this.CARD_WIDTH / 2,
        startY - this.CARD_HEIGHT / 2,
        this.CARD_WIDTH,
        this.CARD_HEIGHT
      ),
      Phaser.Geom.Rectangle.Contains
    );
    stockOutline.on('pointerdown', () => this.drawFromStock());

    // Tableau piles (bottom)
    for (let i = 0; i < 7; i++) {
      this.tableau.push({
        cards: [],
        x: startX + i * this.CARD_SPACING,
        y: startY + this.CARD_HEIGHT + 50
      });
      this.drawEmptyPile(this.tableau[i].x, this.tableau[i].y);
    }
  }

  private drawEmptyPile(x: number, y: number) {
    const outline = this.add.graphics();
    outline.lineStyle(2, 0x666666, 0.5);
    outline.strokeRoundedRect(
      x - this.CARD_WIDTH / 2,
      y - this.CARD_HEIGHT / 2,
      this.CARD_WIDTH,
      this.CARD_HEIGHT,
      5
    );
  }

  private dealCards() {
    // Create deck
    const deck: Card[] = [];

    for (let suitIndex = 0; suitIndex < this.SUITS.length; suitIndex++) {
      for (let rank = 1; rank <= 13; rank++) {
        const card = this.createCard(
          this.SUITS[suitIndex],
          rank,
          this.SUIT_COLORS[suitIndex]
        );
        deck.push(card);
      }
    }

    // Shuffle
    Phaser.Utils.Array.Shuffle(deck);

    // Deal to tableau
    let deckIndex = 0;
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck[deckIndex++];
        card.faceUp = row === col; // Only top card is face up
        this.tableau[col].cards.push(card);
      }
    }

    // Remaining cards go to stock
    this.stock = deck.slice(deckIndex);
    this.stock.forEach(card => {
      card.faceUp = false;
    });

    // Update all visuals
    this.updateAllCards();
  }

  private createCard(suit: string, rank: number, color: 'red' | 'black'): Card {
    const container = this.add.container(0, 0);

    const cardBg = this.add.graphics();

    const text = this.add.text(0, -this.CARD_HEIGHT / 2 + 20, '', {
      fontSize: '20px',
      color: color === 'red' ? '#ff0000' : '#000000',
      fontFamily: 'Arial',
      align: 'center',
      fontStyle: 'bold'
    });
    text.setOrigin(0.5);

    container.add([cardBg, text]);
    container.setSize(this.CARD_WIDTH, this.CARD_HEIGHT);
    container.setInteractive({ draggable: true });

    const card: Card = {
      suit,
      rank,
      color,
      faceUp: false,
      sprite: cardBg as Card['sprite'],
      text,
      container
    };

    card.sprite.card = card;

    // Set up drag events
    container.on('dragstart', (_pointer: Phaser.Input.Pointer, _dragX: number, _dragY: number) => {
      this.onDragStart(card);
    });

    container.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      this.onDrag(dragX, dragY);
    });

    container.on('dragend', () => {
      this.onDragEnd();
    });

    return card;
  }

  private drawCard(card: Card) {
    card.sprite.clear();

    if (card.faceUp) {
      // White card with border
      card.sprite.fillStyle(0xffffff, 1);
      card.sprite.fillRoundedRect(
        -this.CARD_WIDTH / 2,
        -this.CARD_HEIGHT / 2,
        this.CARD_WIDTH,
        this.CARD_HEIGHT,
        5
      );
      card.sprite.lineStyle(2, 0x000000, 1);
      card.sprite.strokeRoundedRect(
        -this.CARD_WIDTH / 2,
        -this.CARD_HEIGHT / 2,
        this.CARD_WIDTH,
        this.CARD_HEIGHT,
        5
      );

      // Show rank and suit
      card.text.setText(`${this.RANKS[card.rank - 1]}\n${card.suit}`);
      card.text.setVisible(true);
    } else {
      // Blue card back
      card.sprite.fillStyle(0x2c3e50, 1);
      card.sprite.fillRoundedRect(
        -this.CARD_WIDTH / 2,
        -this.CARD_HEIGHT / 2,
        this.CARD_WIDTH,
        this.CARD_HEIGHT,
        5
      );
      card.sprite.lineStyle(2, 0x000000, 1);
      card.sprite.strokeRoundedRect(
        -this.CARD_WIDTH / 2,
        -this.CARD_HEIGHT / 2,
        this.CARD_WIDTH,
        this.CARD_HEIGHT,
        5
      );

      card.text.setVisible(false);
    }
  }

  private updateAllCards() {
    // Update tableau
    this.tableau.forEach((pile) => {
      let currentY = pile.y;
      pile.cards.forEach((card, rowIndex) => {
        card.container.setPosition(pile.x, currentY);
        card.container.setDepth(rowIndex);
        this.drawCard(card);

        // Calculate next Y position based on current card's state
        if (rowIndex < pile.cards.length - 1) {
          currentY += card.faceUp ? this.STACK_OFFSET_Y : this.FACE_DOWN_OFFSET_Y;
        }
      });
    });

    // Update waste pile
    this.waste.cards.forEach((card, index) => {
      card.container.setPosition(this.waste.x, this.waste.y);
      card.container.setDepth(index);
      this.drawCard(card);
    });

    // Update foundations
    this.foundations.forEach(pile => {
      pile.cards.forEach((card, index) => {
        card.container.setPosition(pile.x, pile.y);
        card.container.setDepth(index);
        this.drawCard(card);
      });
    });
  }

  private drawFromStock() {
    if (this.stock.length > 0) {
      const card = this.stock.pop()!;
      card.faceUp = true;
      this.waste.cards.push(card);
      this.updateAllCards();
    } else if (this.waste.cards.length > 0) {
      // Recycle waste back to stock
      this.stock = this.waste.cards.reverse();
      this.waste.cards = [];
      this.stock.forEach(card => {
        card.faceUp = false;
      });
      this.updateAllCards();
    }
  }

  private onDragStart(card: Card) {
    // Find which pile this card is in
    let sourcePile: Pile | null = null;
    let cardIndex = -1;

    // Check tableau
    for (const pile of this.tableau) {
      const index = pile.cards.indexOf(card);
      if (index !== -1 && card.faceUp) {
        sourcePile = pile;
        cardIndex = index;
        break;
      }
    }

    // Check waste
    if (!sourcePile && this.waste.cards.length > 0 && this.waste.cards[this.waste.cards.length - 1] === card) {
      sourcePile = this.waste;
      cardIndex = this.waste.cards.length - 1;
    }

    // Check foundations
    if (!sourcePile) {
      for (const pile of this.foundations) {
        if (pile.cards.length > 0 && pile.cards[pile.cards.length - 1] === card) {
          sourcePile = pile;
          cardIndex = pile.cards.length - 1;
          break;
        }
      }
    }

    if (!sourcePile || cardIndex === -1) return;

    // Can only drag face-up cards
    if (!card.faceUp) return;

    // For tableau, can drag multiple cards if they form a valid sequence
    this.draggedCards = sourcePile.cards.slice(cardIndex);
    this.dragStartPile = sourcePile;
    this.dragStartIndex = cardIndex;

    // Check if it's a valid sequence (alternating colors, descending ranks)
    for (let i = 1; i < this.draggedCards.length; i++) {
      const prev = this.draggedCards[i - 1];
      const curr = this.draggedCards[i];
      if (prev.color === curr.color || prev.rank !== curr.rank + 1) {
        // Invalid sequence, can only drag the single card
        this.draggedCards = [card];
        break;
      }
    }
  }

  private onDrag(dragX: number, dragY: number) {
    if (this.draggedCards.length === 0) return;

    this.draggedCards.forEach((card, index) => {
      card.container.setPosition(dragX, dragY + index * this.STACK_OFFSET_Y);
      card.container.setDepth(1000 + index);
    });
  }

  private onDragEnd() {
    if (this.draggedCards.length === 0 || !this.dragStartPile) return;

    const topCard = this.draggedCards[0];
    let validDrop = false;
    let targetPile: Pile | null = null;

    // Check foundations (only single cards)
    if (this.draggedCards.length === 1) {
      for (const pile of this.foundations) {
        const distance = Phaser.Math.Distance.Between(
          topCard.container.x,
          topCard.container.y,
          pile.x,
          pile.y
        );

        if (distance < this.CARD_WIDTH) {
          if (this.canPlaceOnFoundation(topCard, pile)) {
            targetPile = pile;
            validDrop = true;
            break;
          }
        }
      }
    }

    // Check tableau
    if (!validDrop) {
      for (const pile of this.tableau) {
        // Calculate where the next card would go by summing up all card offsets
        let targetY = pile.y;
        for (let i = 0; i < pile.cards.length; i++) {
          targetY += pile.cards[i].faceUp ? this.STACK_OFFSET_Y : this.FACE_DOWN_OFFSET_Y;
        }

        const distance = Phaser.Math.Distance.Between(
          topCard.container.x,
          topCard.container.y,
          pile.x,
          targetY
        );

        if (distance < this.CARD_WIDTH) {
          if (this.canPlaceOnTableau(topCard, pile)) {
            targetPile = pile;
            validDrop = true;
            break;
          }
        }
      }
    }

    if (validDrop && targetPile) {
      // Move cards
      this.dragStartPile.cards.splice(this.dragStartIndex, this.draggedCards.length);
      targetPile.cards.push(...this.draggedCards);

      // Flip top card in source pile if needed
      if (this.dragStartPile.cards.length > 0) {
        const topCard = this.dragStartPile.cards[this.dragStartPile.cards.length - 1];
        if (!topCard.faceUp) {
          topCard.faceUp = true;
        }
      }

      this.updateAllCards();
      this.checkWin();
    } else {
      // Snap back
      this.updateAllCards();
    }

    this.draggedCards = [];
    this.dragStartPile = null;
  }

  private canPlaceOnFoundation(card: Card, pile: Pile): boolean {
    if (pile.cards.length === 0) {
      return card.rank === 1; // Only Ace on empty foundation
    }

    const topCard = pile.cards[pile.cards.length - 1];
    return card.suit === topCard.suit && card.rank === topCard.rank + 1;
  }

  private canPlaceOnTableau(card: Card, pile: Pile): boolean {
    if (pile.cards.length === 0) {
      return card.rank === 13; // Only King on empty tableau
    }

    const topCard = pile.cards[pile.cards.length - 1];
    if (!topCard.faceUp) return false;

    return card.color !== topCard.color && card.rank === topCard.rank - 1;
  }

  private checkWin() {
    const allInFoundations = this.foundations.every(pile => pile.cards.length === 13);

    if (allInFoundations) {
      this.add.text(360, 780, 'You Win!', {
        fontSize: '64px',
        color: '#00ff00',
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 6
      }).setOrigin(0.5);
    }
  }

  private addResetButton() {
    const button = this.add.text(360, 1500, 'New Game', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: '#2c3e50',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive();

    button.on('pointerdown', () => {
      this.scene.restart();
    });
  }
}
