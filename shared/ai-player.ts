import type { GameState, GameAction, Card, CardSuit } from "./game-types";
import { canPlayCard, getEffectiveTopCard } from "./game-rules";

/**
 * Simple AI logic for practice mode
 * Strategy: Play first valid card, or draw if no valid cards
 */
export class AIPlayer {
  private readonly difficulty: "easy" | "medium" | "hard";

  constructor(difficulty: "easy" | "medium" | "hard" = "easy") {
    this.difficulty = difficulty;
  }

  /**
   * Decide which action the AI should take
   */
  decideAction(gameState: GameState, playerId: number): GameAction {
    const player = gameState.players.find((p) => p.id === playerId);
    if (!player) {
      return { type: "DRAW_CARD" };
    }

    if (gameState.discardPile.length === 0) {
      return { type: "DRAW_CARD" };
    }

    // Get effective top card (Schellen-8 transparent)
    const effectiveTopCard = getEffectiveTopCard(gameState.discardPile);

    // Find playable cards
    const playableCards = player.hand.filter((card) =>
      canPlayCard(card, effectiveTopCard, gameState.currentWishSuit, gameState.drawChainCount).isValid
    );

    if (playableCards.length === 0) {
      return { type: "DRAW_CARD" };
    }

    // Choose card based on difficulty
    const chosenCard = this.chooseCard(playableCards, gameState);

    // If it's an Unter, choose a suit
    if (chosenCard.rank === "bube") {
      const wishSuit = this.chooseSuit(player.hand);
      return {
        type: "PLAY_CARD",
        cardId: chosenCard.id,
        wishSuit,
      };
    }

    return {
      type: "PLAY_CARD",
      cardId: chosenCard.id,
    };
  }

  /**
   * Choose which card to play from playable cards
   */
  private chooseCard(playableCards: Card[], gameState: GameState): Card {
    if (this.difficulty === "easy") {
      // Easy: Just play first playable card
      return playableCards[0];
    }

    // Medium/Hard: Try to play special cards first
    const specialCards = playableCards.filter(
      (c) => c.rank === "7" || c.rank === "ass" || c.rank === "bube" || (c.rank === "8" && c.suit === "schellen")
    );

    if (specialCards.length > 0) {
      return specialCards[0];
    }

    return playableCards[0];
  }

  /**
   * Choose which suit to wish for when playing Unter
   */
  private chooseSuit(hand: Card[]): CardSuit {
    // Count suits in hand (excluding Unter)
    const suitCounts: Record<CardSuit, number> = {
      eichel: 0,
      gruen: 0,
      rot: 0,
      schellen: 0,
    };

    hand.forEach((card) => {
      if (card.rank !== "bube") {
        suitCounts[card.suit]++;
      }
    });

    // Choose suit with most cards
    let maxCount = 0;
    let chosenSuit: CardSuit = "eichel";

    (Object.keys(suitCounts) as CardSuit[]).forEach((suit) => {
      if (suitCounts[suit] > maxCount) {
        maxCount = suitCounts[suit];
        chosenSuit = suit;
      }
    });

    return chosenSuit;
  }
}
