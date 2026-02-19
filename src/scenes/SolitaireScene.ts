import Phaser from 'phaser';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

interface Card {
  suit: string;
  rank: number;
  color: 'red' | 'black';
  faceUp: boolean;
  sprite: Phaser.GameObjects.Graphics & { card?: Card };
  rankText: Phaser.GameObjects.Text;
  centerSuit: Phaser.GameObjects.Text;
  container: Phaser.GameObjects.Container;
}

interface Pile {
  cards: Card[];
  x: number;
  y: number;
}

export default class SolitaireScene extends Phaser.Scene {
  private readonly CARD_WIDTH = 90;
  private readonly CARD_HEIGHT = 120;
  private readonly CARD_SPACING = 100;
  private readonly STACK_OFFSET_Y = 40;
  private readonly FACE_DOWN_OFFSET_Y = 40;

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

  private stockGraphics!: Phaser.GameObjects.Graphics;
  private stockX = 0;
  private stockY = 0;

  // Double-click tracking
  private lastClickTime = 0;
  private lastClickedCard: Card | null = null;
  private readonly DOUBLE_CLICK_TIME = 300; // milliseconds
  private justMovedToFoundation = false;

  // Auto-complete tracking
  private isAutoCompleting = false;

  constructor() {
    super({ key: 'SolitaireScene' });
  }

  create() {
    // Reset all game state
    this.tableau = [];
    this.foundations = [];
    this.stock = [];
    this.waste = { cards: [], x: 0, y: 0 };
    this.draggedCards = [];
    this.dragStartPile = null;
    this.dragStartIndex = 0;
    this.lastClickTime = 0;
    this.lastClickedCard = null;
    this.justMovedToFoundation = false;
    this.isAutoCompleting = false;

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
    this.stockX = startX;
    this.stockY = startY;
    this.waste.x = startX + this.CARD_SPACING;
    this.waste.y = startY;

    // Create stock pile graphics
    this.stockGraphics = this.add.graphics();
    this.stockGraphics.setInteractive(
      new Phaser.Geom.Rectangle(
        startX - this.CARD_WIDTH / 2,
        startY - this.CARD_HEIGHT / 2,
        this.CARD_WIDTH,
        this.CARD_HEIGHT
      ),
      Phaser.Geom.Rectangle.Contains
    );
    this.stockGraphics.on('pointerdown', () => this.drawFromStock());

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

    // Create rank text (top-left corner)
    const rankText = this.add.text(-this.CARD_WIDTH / 2 + 10, -this.CARD_HEIGHT / 2 + 8, '', {
      fontSize: '24px',
      color: color === 'red' ? '#ff0000' : '#000000',
      fontFamily: 'Arial, sans-serif',
      align: 'left',
      fontStyle: 'bold'
    });
    rankText.setOrigin(0, 0);

    // Create large center suit
    const centerSuit = this.add.text(0, 0, '', {
      fontSize: '48px',
      color: color === 'red' ? '#ff0000' : '#000000',
      fontFamily: 'Arial, sans-serif',
      align: 'center'
    });
    centerSuit.setOrigin(0.5);

    container.add([cardBg, rankText, centerSuit]);
    container.setSize(this.CARD_WIDTH, this.CARD_HEIGHT);
    container.setInteractive({ draggable: true });

    const card: Card = {
      suit,
      rank,
      color,
      faceUp: false,
      sprite: cardBg as Card['sprite'],
      rankText,
      centerSuit,
      container
    };

    card.sprite.card = card;

    // Set up pointer events
    container.on('pointerdown', () => {
      this.onCardClick(card);
    });

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
      // White card with subtle shadow
      card.sprite.fillStyle(0xffffff, 1);
      card.sprite.fillRoundedRect(
        -this.CARD_WIDTH / 2,
        -this.CARD_HEIGHT / 2,
        this.CARD_WIDTH,
        this.CARD_HEIGHT,
        8
      );
      card.sprite.lineStyle(3, 0x333333, 1);
      card.sprite.strokeRoundedRect(
        -this.CARD_WIDTH / 2,
        -this.CARD_HEIGHT / 2,
        this.CARD_WIDTH,
        this.CARD_HEIGHT,
        8
      );

      // Show rank in top-left
      card.rankText.setText(this.RANKS[card.rank - 1]);
      card.rankText.setVisible(true);

      // Show large suit in center
      card.centerSuit.setText(card.suit);
      card.centerSuit.setVisible(true);
    } else {
      // Navy blue card back with pattern
      card.sprite.fillStyle(0x1a2332, 1);
      card.sprite.fillRoundedRect(
        -this.CARD_WIDTH / 2,
        -this.CARD_HEIGHT / 2,
        this.CARD_WIDTH,
        this.CARD_HEIGHT,
        8
      );

      // Border
      card.sprite.lineStyle(3, 0x4a5568, 1);
      card.sprite.strokeRoundedRect(
        -this.CARD_WIDTH / 2,
        -this.CARD_HEIGHT / 2,
        this.CARD_WIDTH,
        this.CARD_HEIGHT,
        8
      );

      // Inner pattern
      card.sprite.lineStyle(2, 0x2d3748, 0.5);
      card.sprite.strokeRoundedRect(
        -this.CARD_WIDTH / 2 + 10,
        -this.CARD_HEIGHT / 2 + 10,
        this.CARD_WIDTH - 20,
        this.CARD_HEIGHT - 20,
        5
      );

      card.rankText.setVisible(false);
      card.centerSuit.setVisible(false);
    }
  }

  private updateAllCards() {
    // First, hide all stock cards (they shouldn't be visible)
    this.stock.forEach(card => {
      card.container.setVisible(false);
    });

    // Update tableau
    this.tableau.forEach((pile) => {
      let currentY = pile.y;
      pile.cards.forEach((card, rowIndex) => {
        card.container.setVisible(true);
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
      card.container.setVisible(true);
      card.container.setPosition(this.waste.x, this.waste.y);
      card.container.setDepth(index);
      this.drawCard(card);
    });

    // Update foundations
    this.foundations.forEach(pile => {
      pile.cards.forEach((card, index) => {
        card.container.setVisible(true);
        card.container.setPosition(pile.x, pile.y);
        card.container.setDepth(index);
        this.drawCard(card);
      });
    });

    // Update stock pile visual
    this.drawStockPile();

    // Check if we should trigger auto-complete
    this.checkAutoComplete();
  }

  private drawStockPile() {
    this.stockGraphics.clear();

    if (this.stock.length > 0) {
      // Draw card back to show there are cards
      this.stockGraphics.fillStyle(0x1a2332, 1);
      this.stockGraphics.fillRoundedRect(
        this.stockX - this.CARD_WIDTH / 2,
        this.stockY - this.CARD_HEIGHT / 2,
        this.CARD_WIDTH,
        this.CARD_HEIGHT,
        8
      );

      // Border
      this.stockGraphics.lineStyle(3, 0x4a5568, 1);
      this.stockGraphics.strokeRoundedRect(
        this.stockX - this.CARD_WIDTH / 2,
        this.stockY - this.CARD_HEIGHT / 2,
        this.CARD_WIDTH,
        this.CARD_HEIGHT,
        8
      );

      // Inner pattern
      this.stockGraphics.lineStyle(2, 0x2d3748, 0.5);
      this.stockGraphics.strokeRoundedRect(
        this.stockX - this.CARD_WIDTH / 2 + 10,
        this.stockY - this.CARD_HEIGHT / 2 + 10,
        this.CARD_WIDTH - 20,
        this.CARD_HEIGHT - 20,
        5
      );
    } else if (this.waste.cards.length > 0) {
      // Draw recycle icon when stock is empty but waste has cards
      this.stockGraphics.lineStyle(3, 0x4ade80, 1);
      this.stockGraphics.strokeRoundedRect(
        this.stockX - this.CARD_WIDTH / 2,
        this.stockY - this.CARD_HEIGHT / 2,
        this.CARD_WIDTH,
        this.CARD_HEIGHT,
        8
      );

      // Draw circular arrow (recycle symbol)
      this.stockGraphics.lineStyle(4, 0x4ade80, 1);
      this.stockGraphics.beginPath();
      this.stockGraphics.arc(this.stockX, this.stockY, 20, Phaser.Math.DegToRad(45), Phaser.Math.DegToRad(315), false);
      this.stockGraphics.strokePath();

      // Arrow head
      this.stockGraphics.fillStyle(0x4ade80, 1);
      this.stockGraphics.fillTriangle(
        this.stockX + 18, this.stockY - 8,
        this.stockX + 25, this.stockY - 2,
        this.stockX + 18, this.stockY + 2
      );
    } else {
      // Empty stock - draw subtle outline
      this.stockGraphics.lineStyle(2, 0x666666, 0.5);
      this.stockGraphics.strokeRoundedRect(
        this.stockX - this.CARD_WIDTH / 2,
        this.stockY - this.CARD_HEIGHT / 2,
        this.CARD_WIDTH,
        this.CARD_HEIGHT,
        8
      );
    }
  }

  private drawFromStock() {
    if (this.stock.length > 0) {
      const card = this.stock.pop()!;
      card.faceUp = true;
      this.waste.cards.push(card);
      this.updateAllCards();
    } else if (this.waste.cards.length > 0) {
      // Recycle waste back to stock (reversed order)
      const wasteCards = [...this.waste.cards];
      this.waste.cards = [];
      this.stock = wasteCards.reverse();
      this.stock.forEach(card => {
        card.faceUp = false;
      });
      this.updateAllCards();
    }
  }

  private onCardClick(card: Card) {
    const currentTime = this.time.now;

    // Check if this is a double-click
    if (
      this.lastClickedCard === card &&
      currentTime - this.lastClickTime < this.DOUBLE_CLICK_TIME
    ) {
      // Double-click detected - try to move to foundation
      const moved = this.tryMoveToFoundation(card);

      if (moved) {
        // Prevent drag from starting after this move
        this.justMovedToFoundation = true;
        this.time.delayedCall(100, () => {
          this.justMovedToFoundation = false;
        });
      }

      // Reset tracking
      this.lastClickedCard = null;
      this.lastClickTime = 0;
    } else {
      // First click - track it
      this.lastClickedCard = card;
      this.lastClickTime = currentTime;
    }
  }

  private tryMoveToFoundation(card: Card): boolean {
    // Only try if card is face-up
    if (!card.faceUp) return false;

    // Find which pile this card is in and if it's the top card
    let sourcePile: Pile | null = null;
    let isTopCard = false;

    // Check tableau
    for (const pile of this.tableau) {
      const index = pile.cards.indexOf(card);
      if (index !== -1 && index === pile.cards.length - 1) {
        sourcePile = pile;
        isTopCard = true;
        break;
      }
    }

    // Check waste
    if (!sourcePile && this.waste.cards.length > 0 && this.waste.cards[this.waste.cards.length - 1] === card) {
      sourcePile = this.waste;
      isTopCard = true;
    }

    // Check foundations (can move from one foundation to another if needed, though rare)
    if (!sourcePile) {
      for (const pile of this.foundations) {
        if (pile.cards.length > 0 && pile.cards[pile.cards.length - 1] === card) {
          sourcePile = pile;
          isTopCard = true;
          break;
        }
      }
    }

    // Only move top cards
    if (!sourcePile || !isTopCard) return false;

    // Find a valid foundation
    for (const foundation of this.foundations) {
      if (this.canPlaceOnFoundation(card, foundation)) {
        const cardIndex = sourcePile.cards.indexOf(card);
        if (cardIndex !== -1) {
          // Animate card to foundation (will handle removing from source)
          this.animateCardToFoundation(card, foundation, sourcePile, cardIndex);

          return true;
        }
      }
    }

    return false;
  }

  private animateCardToFoundation(card: Card, foundation: Pile, sourcePile: Pile, cardIndex: number) {
    // Disable interaction on the card during animation
    card.container.disableInteractive();

    // Increase depth so card appears above others during animation
    card.container.setDepth(2000);

    // Animate to foundation position
    this.tweens.add({
      targets: card.container,
      x: foundation.x,
      y: foundation.y,
      duration: 200,
      ease: 'Quad.easeInOut',
      onComplete: async () => {
        // Remove from source pile
        sourcePile.cards.splice(cardIndex, 1);

        // Add to foundation
        foundation.cards.push(card);

        // Trigger haptic feedback for successful move to foundation
        try {
          await RundotGameAPI.triggerHapticAsync('success');
        } catch (error) {
          // Haptics may not be supported, fail silently
          console.warn('Haptic feedback not available:', error);
        }

        // Re-enable interaction
        card.container.setInteractive({ draggable: true });

        // Flip top card in source pile if needed
        if (sourcePile.cards.length > 0) {
          const topCard = sourcePile.cards[sourcePile.cards.length - 1];
          if (!topCard.faceUp) {
            topCard.faceUp = true;
          }
        }

        // Update visuals and check win
        this.updateAllCards();
        this.checkWin();
      }
    });
  }

  private onDragStart(card: Card) {
    // Don't allow drag if we just moved this card to foundation
    if (this.justMovedToFoundation) return;

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

  private checkAutoComplete() {
    // Don't check if already auto-completing or if game is won
    if (this.isAutoCompleting) return;
    if (this.foundations.every(pile => pile.cards.length === 13)) return;

    // Check if all cards are face-up (no face-down cards anywhere, and stock/waste are empty)
    const allTableauFaceUp = this.tableau.every(pile =>
      pile.cards.every(card => card.faceUp)
    );
    const stockEmpty = this.stock.length === 0;
    const wasteEmpty = this.waste.cards.length === 0;

    if (allTableauFaceUp && stockEmpty && wasteEmpty) {
      // Start auto-completing
      this.isAutoCompleting = true;
      this.autoCompleteNextCard();
    }
  }

  private autoCompleteNextCard() {
    // Try to find any card that can be moved to a foundation
    let movedCard = false;
    let cardToMove: Card | null = null;
    let sourcePile: Pile | null = null;
    let targetFoundation: Pile | null = null;

    // Check all tableau piles
    for (const pile of this.tableau) {
      if (pile.cards.length > 0) {
        const topCard = pile.cards[pile.cards.length - 1];

        // Try to move to any foundation
        for (const foundation of this.foundations) {
          if (this.canPlaceOnFoundation(topCard, foundation)) {
            cardToMove = topCard;
            sourcePile = pile;
            targetFoundation = foundation;
            movedCard = true;
            break;
          }
        }

        if (movedCard) break;
      }
    }

    // Check waste pile (shouldn't have cards but just in case)
    if (!movedCard && this.waste.cards.length > 0) {
      const topCard = this.waste.cards[this.waste.cards.length - 1];

      for (const foundation of this.foundations) {
        if (this.canPlaceOnFoundation(topCard, foundation)) {
          cardToMove = topCard;
          sourcePile = this.waste;
          targetFoundation = foundation;
          movedCard = true;
          break;
        }
      }
    }

    if (movedCard && cardToMove && sourcePile && targetFoundation) {
      // Disable interaction during animation
      cardToMove.container.disableInteractive();

      // Animate the card to foundation
      cardToMove.container.setDepth(2000);

      this.tweens.add({
        targets: cardToMove.container,
        x: targetFoundation.x,
        y: targetFoundation.y,
        duration: 150,
        ease: 'Quad.easeInOut',
        onComplete: async () => {
          // Remove card from source pile
          sourcePile!.cards.pop();

          // Add to foundation
          targetFoundation!.cards.push(cardToMove!);

          // Trigger haptic feedback for auto-complete move
          try {
            await RundotGameAPI.triggerHapticAsync('success');
          } catch (error) {
            // Haptics may not be supported, fail silently
            console.warn('Haptic feedback not available:', error);
          }

          // Re-enable interaction
          cardToMove!.container.setInteractive({ draggable: true });

          this.updateAllCards();

          // Continue auto-completing
          this.autoCompleteNextCard();
        }
      });
    } else {
      // No more moves possible or game is won
      this.isAutoCompleting = false;
      this.checkWin();
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
