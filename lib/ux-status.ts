import type { CardSuit, GameState, Player } from "@/shared/game-types";

export type UiTone = "neutral" | "success" | "warning" | "danger";

export interface RoomFlowStatus {
  tone: UiTone;
  title: string;
  detail: string;
}

const WISH_SUIT_LABEL: Record<CardSuit, string> = {
  eichel: "Eichel",
  gruen: "Grün",
  rot: "Rot",
  schellen: "Schellen",
};

export function toFriendlyRoomError(raw: string): string {
  const message = (raw || "").trim();
  const normalized = message.toLowerCase();
  if (!message) return "Unbekannter Verbindungsfehler. Bitte erneut versuchen.";
  if (normalized.includes("invalid room code") || normalized.includes("ungültiger raum-code")) {
    return "Der Raum-Code ist ungültig. Prüfe die 6 Zeichen und versuche es erneut.";
  }
  if (normalized.includes("room not found")) {
    return "Der Raum wurde nicht gefunden. Prüfe den Code oder bitte den Host um einen neuen Raum.";
  }
  if (normalized.includes("room is full")) {
    return "Der Raum ist bereits voll.";
  }
  if (normalized.includes("game already in progress") || normalized.includes("game already started")) {
    return "Die Partie läuft bereits. Bitte einem wartenden Raum beitreten.";
  }
  if (normalized.includes("failed to create room")) {
    return "Raum konnte aktuell nicht erstellt werden. Bitte kurz warten und erneut versuchen.";
  }
  if (normalized.includes("failed to generate unique room code")) {
    return "Raum-Code konnte nicht erstellt werden. Bitte erneut versuchen.";
  }
  if (normalized.includes("session temporarily unavailable") || normalized.includes("game session unavailable")) {
    return "Die Sitzung ist kurzzeitig nicht verfügbar. Bitte in ein paar Sekunden erneut versuchen.";
  }
  if (normalized.includes("too many join attempts")) {
    return "Zu viele Beitrittsversuche in kurzer Zeit. Bitte kurz warten und erneut versuchen.";
  }
  if (normalized.includes("socket-verbindung blockiert") || normalized.includes("server nicht erreichbar")) {
    return "Server aktuell nicht erreichbar. Prüfe Verbindung und versuche es erneut.";
  }
  if (normalized.includes("user already has an active room session") || normalized.includes("user already in another active room")) {
    return "Du bist bereits in einem aktiven Raum. Kehre dorthin zurück oder verlasse ihn zuerst.";
  }
  return message;
}

export function getRoomFlowStatus(params: {
  isConnected: boolean;
  isJoining: boolean;
  hasRoomState: boolean;
  joinAttempt?: number;
}): RoomFlowStatus {
  const { isConnected, isJoining, hasRoomState, joinAttempt = 0 } = params;
  if (!isConnected && hasRoomState) {
    return {
      tone: "warning",
      title: "Verbindung unterbrochen",
      detail: "Wir verbinden dich automatisch wieder mit dem Raum.",
    };
  }
  if (!isConnected) {
    return {
      tone: "warning",
      title: "Verbindung wird aufgebaut",
      detail: "Wir verbinden gerade zum Server.",
    };
  }
  if (isJoining && !hasRoomState) {
    return {
      tone: "warning",
      title: "Raumbeitritt läuft",
      detail: `Beitrittsversuch ${Math.max(1, joinAttempt)} läuft...`,
    };
  }
  if (!hasRoomState) {
    return {
      tone: "success",
      title: "Verbunden",
      detail: "Server erreichbar. Noch keinem Raum beigetreten.",
    };
  }
  return {
    tone: "success",
    title: "Verbunden",
    detail: "Raumstatus ist synchron.",
  };
}

export function shouldShowSecondaryGameBanner(params: {
  isCompactHeight: boolean;
  drawChainCount: number;
  hasWishSuit: boolean;
  hasNoPlayableCards: boolean;
  hasActiveFx?: boolean;
}): boolean {
  const {
    isCompactHeight,
    drawChainCount,
    hasWishSuit,
    hasNoPlayableCards,
    hasActiveFx = false,
  } = params;
  if (hasActiveFx) return false;
  // Critical decision states always outrank secondary banners.
  if (drawChainCount > 0) return false;
  if (hasWishSuit) return false;
  if (hasNoPlayableCards) return false;
  // Compact layouts stay focused on primary decision cues.
  if (isCompactHeight) return false;
  return true;
}

export interface GamePriorityPill {
  key: string;
  label: string;
  tone: UiTone;
}

export function getPlayableCount(params: {
  state: GameState;
  currentPlayer: Player;
  isMyTurn: boolean;
}): number {
  const { state, currentPlayer, isMyTurn } = params;
  if (!isMyTurn) return 0;
  if (!state.playableCardIds) return currentPlayer.hand.length;
  const playableSet = new Set(state.playableCardIds);
  return currentPlayer.hand.reduce((count, card) => (playableSet.has(card.id) ? count + 1 : count), 0);
}

export function getGamePriorityPills(params: {
  state: GameState;
  currentPlayer: Player;
  isMyTurn: boolean;
}): GamePriorityPill[] {
  const { state, isMyTurn } = params;
  const currentTurnPlayer = state.players[state.currentPlayerIndex];
  const pills: GamePriorityPill[] = [];
  pills.push({
    key: "turn",
    tone: isMyTurn ? "success" : "neutral",
    label: isMyTurn ? "Du bist am Zug" : `Am Zug: ${currentTurnPlayer?.username ?? "-"}`,
  });
  if (state.drawChainCount > 0) {
    pills.push({
      key: "draw-chain",
      tone: "warning",
      label: `Ziehkette +${state.drawChainCount}`,
    });
    return pills;
  }
  if (state.currentWishSuit) {
    pills.push({
      key: "wish-suit",
      tone: "warning",
      label: `Wunschfarbe: ${WISH_SUIT_LABEL[state.currentWishSuit]}`,
    });
    return pills;
  }
  if (state.skipNextPlayer) {
    pills.push({
      key: "skip",
      tone: "warning",
      label: "Aussetzen aktiv",
    });
    return pills;
  }
  pills.push({
    key: "direction",
    tone: "neutral",
    label: state.direction === "counterclockwise" ? "Richtung: gegen Uhrzeigersinn" : "Richtung: im Uhrzeigersinn",
  });
  return pills;
}
