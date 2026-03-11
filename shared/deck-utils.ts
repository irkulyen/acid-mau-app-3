import type { Card, CardSuit, CardRank } from "./game-types";

// ============================================================================
// Deck Creation
// ============================================================================

const SUITS: CardSuit[] = ["eichel", "gruen", "rot", "schellen"];
const RANKS: CardRank[] = ["7", "8", "9", "10", "bube", "dame", "konig", "ass"];

/**
 * Creates a standard 32-card German deck (Altdeutsches Blatt)
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        suit,
        rank,
        id: `${suit}-${rank}`,
      });
    }
  }

  return deck;
}

/**
 * Shuffles a deck using Fisher-Yates algorithm
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Deals cards from deck to players
 */
export function dealCards(deck: Card[], numCards: number): { hand: Card[]; remainingDeck: Card[] } {
  const hand = deck.slice(0, numCards);
  const remainingDeck = deck.slice(numCards);

  return { hand, remainingDeck };
}

// ============================================================================
// Card Utilities
// ============================================================================

/**
 * Checks if a card is a special card
 * NOTE: Schellen-8 is NOT a special card in terms of restrictions for the next player.
 * It only reverses direction but is otherwise transparent (normal play rules apply).
 */
export function isSpecialCard(card: Card): boolean {
  return card.rank === "bube" || card.rank === "ass" || card.rank === "7";
}

/**
 * Gets the display name for a card
 */
export function getCardDisplayName(card: Card): string {
  const suitNames: Record<CardSuit, string> = {
    eichel: "Eichel",
    gruen: "Grün",
    rot: "Rot",
    schellen: "Schellen",
  };

  const rankNames: Record<CardRank, string> = {
    "7": "Sieben",
    "8": "Acht",
    "9": "Neun",
    "10": "Zehn",
    bube: "Bube",
    dame: "Dame",
    konig: "König",
    ass: "Ass",
  };

  return `${suitNames[card.suit]} ${rankNames[card.rank]}`;
}

/**
 * Gets the color for a suit (for UI rendering)
 */
export function getSuitColor(suit: CardSuit): string {
  const colors: Record<CardSuit, string> = {
    eichel: "#8B4513", // Brown
    gruen: "#228B22", // Green
    rot: "#DC143C", // Red
    schellen: "#FFD700", // Gold
  };

  return colors[suit];
}

/**
 * Gets the emoji symbol for a suit
 */
export function getSuitSymbol(suit: CardSuit): string {
  const symbols: Record<CardSuit, string> = {
    eichel: "🌰", // Acorn
    gruen: "🍀", // Green leaves
    rot: "❤️", // Heart
    schellen: "🔔", // Bell
  };

  return symbols[suit];
}

/**
 * Finds a card in a hand by ID
 */
export function findCardById(hand: Card[], cardId: string): Card | undefined {
  return hand.find((card) => card.id === cardId);
}

/**
 * Removes a card from a hand
 */
export function removeCardFromHand(hand: Card[], cardId: string): Card[] {
  return hand.filter((card) => card.id !== cardId);
}
