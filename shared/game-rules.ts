import type { GameState, Player, Card, CardSuit, CardValidation } from "./game-types";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets the effective top card for validation.
 * Schellen-8 is transparent - the card underneath remains valid for the next play.
 */
export function getEffectiveTopCard(discardPile: Card[]): Card {
  if (discardPile.length === 0) {
    throw new Error("Discard pile is empty");
  }

  const topCard = discardPile[discardPile.length - 1];
  
  // If top card is Schellen-8, use the card underneath
  if (topCard.id === "schellen-8" && discardPile.length >= 2) {
    return discardPile[discardPile.length - 2];
  }

  return topCard;
}

// ============================================================================
// Card Validation
// ============================================================================

/**
 * Checks if a card can be played on top of another card
 * VERBINDLICHE PRIORITÄTENREIHENFOLGE:
 * 1. ZIEHKETTE (drawChainCount > 0) - MUSS VOR ALLEN ANDEREN geprüft werden
 * 2. WUNSCHFARBE (wishSuit != null) - NUR wenn drawChainCount === 0
 * 3. NORMALES LEGEN - wenn keine Ziehkette und kein Wunsch
 * 4. UNTER (SONDERREGEL) - IMMER spielbar, AUSSER bei Ziehkette
 * 
 * @param drawChainCount Aktive 7-Ziehkette (0 = keine)
 */
export function canPlayCard(card: Card, topCard: Card, wishSuit: CardSuit | null, drawChainCount: number = 0, openingFreePlay: boolean = false): CardValidation {
  // SONDERREGEL: Schellen-8 als Startkarte → erster Spieler darf beliebige Karte legen
  if (openingFreePlay) {
    return { isValid: true };
  }

  // ============================================================
  // 1. ZIEHKETTE (drawChainCount > 0)
  // MUSS VOR ALLEN ANDEREN geprüft werden
  // ============================================================
  if (drawChainCount > 0) {
    // Nur Rang "7" erlaubt
    if (card.rank === "7") {
      return { isValid: true };
    }
    // Unter VERBOTEN bei Ziehkette
    // Wunschfarbe VERBOTEN bei Ziehkette
    return {
      isValid: false,
      reason: "Bei aktiver 7-Ziehkette ist nur eine weitere 7 erlaubt",
    };
  }

  // ============================================================
  // 2. WUNSCHFARBE (wishSuit != null)
  // NUR wenn drawChainCount === 0
  // ============================================================
  if (wishSuit) {
    // Erlaubt: passende Wunschfarbe ODER Unter ODER Schellen-8
    if (card.suit === wishSuit || card.rank === "bube" || card.id === "schellen-8") {
      return { isValid: true };
    }
    return {
      isValid: false,
      reason: `Du musst ${wishSuit} spielen oder einen Unter`,
    };
  }

  // ============================================================
  // 3. NORMALES LEGEN
  // Wenn keine Ziehkette und kein Wunsch
  // ============================================================
  
  // SONDERREGEL: Wenn topCard ein Bube ist, ist JEDE Karte spielbar
  // (Bube als Startkarte hat keine Wunschfarbe, daher gilt normale Legeregel)
  if (topCard.rank === "bube") {
    return { isValid: true };
  }
  
  // SONDERREGEL: Schellen-8 ist IMMER spielbar (außer bei Ziehkette, bereits abgefangen)
  if (card.id === "schellen-8") {
    return { isValid: true };
  }
  
  // Erlaubt: gleiche Farbe ODER gleicher Rang
  if (card.suit === topCard.suit || card.rank === topCard.rank) {
    return { isValid: true };
  }

  // ============================================================
  // 4. UNTER (SONDERREGEL)
  // IMMER spielbar, AUSSER bei Ziehkette (bereits abgefangen)
  // ============================================================
  if (card.rank === "bube") {
    return { isValid: true };
  }

  return {
    isValid: false,
    reason: "Karte passt nicht (gleiche Farbe oder Rang erforderlich)",
  };
}

/**
 * Checks if a player has any playable cards
 */
export function hasPlayableCard(hand: Card[], topCard: Card, wishSuit: CardSuit | null, drawChainCount: number = 0): boolean {
  return hand.some((card) => canPlayCard(card, topCard, wishSuit, drawChainCount).isValid);
}

/**
 * Gets all playable cards from a hand
 */
export function getPlayableCards(hand: Card[], topCard: Card, wishSuit: CardSuit | null, drawChainCount: number = 0): Card[] {
  return hand.filter((card) => canPlayCard(card, topCard, wishSuit, drawChainCount).isValid);
}

// ============================================================================
// Special Card Effects
// ============================================================================

/**
 * Applies the effect of a special card to the game state
 */
export function applySpecialCardEffect(state: GameState, card: Card, wishSuit?: CardSuit): GameState {
  const newState = { ...state };

  switch (card.rank) {
    case "bube":
      // Unter allows choosing a suit
      if (wishSuit) {
        newState.currentWishSuit = wishSuit;
      }
      // Reset draw chain when playing non-7 card
      newState.drawChainCount = 0;
      break;

    case "ass":
      // Ass skips the next player (works for all player counts)
      // Bei 2 Spielern: getNextPlayerIndex() behandelt Skip speziell (Spieler bleibt dran)
      newState.skipNextPlayer = true;
      // Reset draw chain when playing non-7 card
      newState.drawChainCount = 0;
      break;

    case "7":
      // 7 starts or continues a draw chain
      newState.drawChainCount += 2;
      break;

    default:
      // Check for Schellen-8 (reverses direction)
      if (card.id === "schellen-8") {
        newState.direction = newState.direction === "clockwise" ? "counterclockwise" : "clockwise";
        // Bei 2 Spielern: Richtungswechsel = Skip (nächster Spieler wird übersprungen)
        const activePlayers = newState.players.filter(p => !p.isEliminated);
        if (activePlayers.length === 2) {
          newState.skipNextPlayer = true;
        }
      }
      // Reset draw chain when playing non-7 card
      newState.drawChainCount = 0;
      break;
  }

  return newState;
}

/**
 * Determines how many cards to deal at the start of a round
 * REGEL: Startkarten = Niederlagen + 1
 * 
 * WICHTIG: lossPoints = Anzahl Niederlagen (nicht Kartenwert)
 */
export function getInitialCardCount(lossPoints: number): number {
  return 1 + lossPoints;
}

/**
 * Gets the maximum allowed loss points based on player count
 * REGEL (VERBINDLICH): Tabellengesteuerte Eliminierung
 * 2-4 Spieler → 7 Startkarten max (7 Niederlagen)
 * 5 Spieler   → 6 Startkarten max (6 Niederlagen)
 * 6 Spieler   → 5 Startkarten max (5 Niederlagen)
 * Nächste Niederlage → ausgeschieden
 */
export function getMaxLossPoints(playerCount: number): number {
  // Explizite Tabelle (KEINE generische Logik)
  const eliminationTable: Record<number, number> = {
    2: 7,
    3: 7,
    4: 7,
    5: 6,
    6: 5,
  };

  if (playerCount < 2 || playerCount > 6) {
    throw new Error(`Invalid player count: ${playerCount}. Must be 2-6.`);
  }

  return eliminationTable[playerCount];
}

/**
 * Checks if a player is eliminated
 * Rules: 2-4 players: 7 losses, 5 players: 6 losses, 6 players: 5 losses
 */
export function isPlayerEliminated(lossPoints: number, playerCount: number): boolean {
  return lossPoints >= getMaxLossPoints(playerCount);
}

/**
 * Checks if the round is over (only one player has cards left)
 */
export function isRoundOver(players: GameState["players"]): boolean {
  // Round is over when only one active player has cards remaining
  const playersWithCards = players.filter((p) => !p.isEliminated && p.hand.length > 0);
  return playersWithCards.length === 1;
}

/**
 * Checks if the game is over (only one player not eliminated)
 */
export function isGameOver(players: GameState["players"]): boolean {
  const activePlayers = players.filter((p) => !p.isEliminated);
  return activePlayers.length === 1;
}

/**
 * Gets the loser of a round (player with cards remaining)
 * Note: This function is misnamed - it returns the LOSER, not the winner
 */
export function getRoundWinner(players: GameState["players"]): number | null {
  // The "winner" (actually loser) is the player who still has cards
  const playersWithCards = players.filter((p) => !p.isEliminated && p.hand.length > 0);
  if (playersWithCards.length === 1) {
    return playersWithCards[0].id;
  }
  return null;
}

/**
 * Gets the winner of the game (last player standing)
 */
export function getGameWinner(players: GameState["players"]): number | null {
  const activePlayers = players.filter((p) => !p.isEliminated);
  if (activePlayers.length === 1) {
    return activePlayers[0].id;
  }
  return null;
}

/**
 * Gets the next active (non-eliminated) player index from a starting position
 * @param players - Array of all players
 * @param startIndex - Starting index
 * @param direction - Direction to search (1 for forward, -1 for backward)
 * @param stepsToSkip - Number of active players to skip (default: 1)
 * @returns Index of the next active player
 */
export function getNextActivePlayerIndex(
  players: GameState["players"],
  startIndex: number,
  direction: 1 | -1 = 1,
  stepsToSkip: number = 1
): number {
  // TURN-LOGIK ABSICHERUNG: Nur Spieler mit Karten sind aktiv
  const activePlayers = players.filter((p) => !p.isEliminated && p.hand.length > 0);

  if (activePlayers.length === 0) {
    return startIndex; // Fallback: no active players
  }

  let nextIndex = startIndex;
  const increment = direction;

  // Skip the specified number of active players (nicht eliminiert UND mit Karten)
  for (let i = 0; i < stepsToSkip; i++) {
    do {
      nextIndex = (nextIndex + increment + players.length) % players.length;
    } while (players[nextIndex].isEliminated || players[nextIndex].hand.length === 0);
  }

  return nextIndex;
}

/**
 * Advances to the next player (uses getNextActivePlayerIndex internally)
 */
export function getNextPlayerIndex(state: GameState): number {
  const { players, currentPlayerIndex, direction, skipNextPlayer } = state;
  const directionIncrement = direction === "clockwise" ? 1 : -1;
  
  // Bei 2 aktiven Spielern: Skip bedeutet "bleib beim aktuellen Spieler"
  // WICHTIG: Zähle Spieler die NICHT eliminiert sind, unabhängig von hand.length
  // (hand.length kann 0 sein wenn Spieler gerade seine letzte Karte gespielt hat)
  const activePlayers = players.filter(p => !p.isEliminated);
  if (skipNextPlayer && activePlayers.length === 2) {
    // Spieler bleibt dran (nächster Spieler wird übersprungen = aktueller Spieler wieder dran)
    return currentPlayerIndex;
  }
  
  const stepsToSkip = skipNextPlayer ? 2 : 1;
  return getNextActivePlayerIndex(players, currentPlayerIndex, directionIncrement, stepsToSkip);
}

/**
 * Calculates loss points for the round loser
 * According to rules: Only the last player with cards gets +1 loss point
 */
export function calculateRoundLossPoints(players: GameState["players"], loserId: number): Record<number, number> {
  const lossPoints: Record<number, number> = {};

  // Only the loser (last player with cards) gets +1 loss point
  lossPoints[loserId] = 1;

  return lossPoints;
}
