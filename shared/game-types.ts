// ============================================================================
// Card Types
// ============================================================================

export type CardSuit = "eichel" | "gruen" | "rot" | "schellen";
export type CardRank = "7" | "8" | "9" | "10" | "bube" | "dame" | "konig" | "ass";

export interface Card {
  suit: CardSuit;
  rank: CardRank;
  id: string; // Unique identifier: "{suit}-{rank}"
}

// ============================================================================
// Game State Types
// ============================================================================

export type GamePhase = "waiting" | "playing" | "round_end" | "game_end";
export type Direction = "clockwise" | "counterclockwise";

export interface Player {
  id: number;
  userId: number;
  username: string;
  avatarUrl?: string;
  hand: Card[];
  lossPoints: number;
  isEliminated: boolean;
  isReady: boolean;
  seatPosition?: number; // Platzwahl: Wird einmal zu Spielbeginn festgelegt (dauerhaft)
}

export interface GameState {
  roomId: number;
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  dealerIndex: number; // Dealer rotates each round
  direction: Direction;
  deck: Card[];
  discardPile: Card[];
  currentWishSuit: CardSuit | null;
  drawChainCount: number; // For "7" chain
  skipNextPlayer: boolean; // For "Ass"
  roundNumber: number;
  hostUserId: number;
  hasRoundStarted: boolean; // Prevents isRoundOver check immediately after startNewRound
  openingFreePlay: boolean; // Schellen-8 als Startkarte: erster Spieler darf beliebige Karte legen
}

// ============================================================================
// Game Actions
// ============================================================================

export type GameAction =
  | { type: "PLAY_CARD"; cardId: string; wishSuit?: CardSuit }
  | { type: "DRAW_CARD" }
  | { type: "START_GAME" }
  | { type: "READY" }
  | { type: "NEXT_ROUND" }
  | { type: "RESTART_ROUND" }
  | { type: "LEAVE_GAME" };

// ============================================================================
// Game Events (Server -> Client)
// ============================================================================

export type GameEvent =
  | { type: "GAME_STATE_UPDATE"; state: GameState }
  | { type: "PLAYER_JOINED"; player: Player }
  | { type: "PLAYER_LEFT"; playerId: number }
  | { type: "CARD_PLAYED"; playerId: number; card: Card }
  | { type: "CARD_DRAWN"; playerId: number; cardCount: number }
  | { type: "ROUND_END"; winnerId: number; lossPoints: Record<number, number> }
  | { type: "GAME_END"; winnerId: number; finalStandings: Player[] }
  | { type: "ERROR"; message: string };

// ============================================================================
// Game Rules
// ============================================================================

export const GAME_RULES = {
  INITIAL_CARDS: 1,
  MAX_LOSS_POINTS: 7,
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 6,
  DECK_SIZE: 32,
} as const;

// ============================================================================
// Special Card Effects
// ============================================================================

export interface SpecialCardEffect {
  rank: CardRank;
  description: string;
  effect: (state: GameState, card: Card, wishSuit?: CardSuit) => GameState;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface CardValidation {
  isValid: boolean;
  reason?: string;
}
