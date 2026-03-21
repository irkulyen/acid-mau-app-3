import type { Card } from "./game-types";

export interface ChatMessage {
  id: number;
  roomId: number;
  userId: number;
  username: string;
  message: string;
  createdAt: string;
}

export interface PreparationDraw {
  playerId: number;
  username: string;
  card: Card;
}

export interface PreparationData {
  phase?: "seat_selection" | "dealer_selection";
  seatDraws: PreparationDraw[];
  dealerDraws: PreparationDraw[];
  seatPickOrderUserIds?: number[];
  seatChoices?: Array<{ userId: number; seatPosition: number }>;
  currentPickerUserId?: number | null;
}

export interface RoomCreatedPayload {
  roomId: number;
  roomCode: string;
  maxPlayers: number;
}

export interface RoomJoinedPayload {
  roomId: number;
  roomCode: string;
  maxPlayers: number;
}

export interface ErrorPayload {
  message: string;
}

export interface BlackbirdEvent {
  id?: string;
  type: "ass" | "unter" | "draw_chain" | "winner" | "loser" | "round_start" | "seven_played" | "mvp";
  playerName?: string;
  drawChainCount?: number;
  wishSuit?: string;
  replay?: boolean;
  sequenceId?: string;
  sequenceStep?: number;
  sequenceTotal?: number;
  intensity?: 1 | 2 | 3 | 4 | 5;
  startAt?: number;
  spotlightUserId?: number;
  spotlightPlayerName?: string;
  variant?: string;
  statsText?: string;
  phrase?: string;
}

export interface CardPlayFxEvent {
  card: Card;
  startAt?: number;
  playerId?: number;
}

export interface DrawCardFxEvent {
  startAt?: number;
  playerId?: number;
  drawCount?: number;
}

export type GameFxEventType =
  | "card_play"
  | "draw_card"
  | "special_card"
  | "draw_chain"
  | "blackbird"
  | "turn_transition"
  | "elimination"
  | "round_transition"
  | "match_result";

export interface GameFxEvent {
  id: string;
  roomId: number;
  sequence: number;
  type: GameFxEventType;
  startAt: number;
  emittedAt: number;
  replay?: boolean;
  playerId?: number;
  userId?: number;
  playerName?: string;
  card?: Card;
  drawCount?: number;
  drawChainCount?: number;
  specialRank?: Card["rank"];
  wishSuit?: string;
  roundNumber?: number;
  eliminatedUserId?: number;
  eliminatedPlayerName?: string;
  winnerUserId?: number;
  winnerPlayerName?: string;
  blackbird?: BlackbirdEvent;
}
