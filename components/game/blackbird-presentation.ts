import { hashString, pickBySeed } from "../../lib/deterministic";

export type BlackbirdEventType =
  | "round_start"
  | "winner"
  | "loser"
  | "draw_chain"
  | "seven_played"
  | "direction_shift"
  | "ass"
  | "unter"
  | "invalid"
  | "mvp";

const ROUND_START_PHRASES = [
  "Na gut… neue Runde.",
  "Mal sehen, wer diesmal abstürzt.",
  "Konzentriert euch. Oder versucht es zumindest.",
  "Auf geht’s.",
];

const WINNER_PHRASES = [
  (n: string) => `${n} ist durch.`,
  (n: string) => `${n} legt die letzte Karte.`,
  () => "Und weg ist er.",
  () => "Nicht schlecht.",
  () => "Sauber gespielt.",
];

const LOSER_PHRASES = [
  (n: string) => `Autsch, ${n}.`,
  () => "Das tat weh.",
  () => "Das war wohl nichts.",
];

const DRAW_CHAIN_PHRASES = [
  (count: number) => `Oh oh… das wird teuer (+${count}).`,
  () => "Zieh mal schön Karten.",
  () => "Das eskaliert gerade.",
  () => "Ich glaube, das tut gleich weh.",
];

const SEVEN_PLAYED_PHRASES = [
  (count: number) => (count > 1 ? `Sieben gelegt. Ziehkette bei ${count}.` : "Sieben gelegt."),
  () => "Oh oh… das wird teuer.",
  () => "Das eskaliert gerade.",
];

const DIRECTION_SHIFT_PHRASES = [
  () => "Richtung gedreht.",
  () => "Drehung. Jetzt andersrum.",
  () => "Die Runde kippt.",
];

const ASS_PHRASES = [
  "Pause für dich.",
  "Du setzt aus.",
  "Kurz zuschauen.",
];

const UNTER_PHRASES = [
  () => "Neue Farbe.",
  () => "Interessante Wahl.",
  () => "Mal sehen, ob das funktioniert.",
];

const MVP_PHRASES = [
  (s: string) => `Highlight: ${s}`,
  (s: string) => `MVP: ${s}`,
  (s: string) => `Starker Moment: ${s}`,
];

const INVALID_PHRASES = [
  () => "Nicht spielbar.",
  () => "Der Zug zählt nicht.",
  () => "Das passt nicht.",
];

export type BlackbirdPresentationInput = {
  eventId?: string;
  eventType?: BlackbirdEventType;
  winnerName?: string;
  loserName?: string;
  drawChainCount?: number;
  wishSuit?: string;
  statsText?: string;
  phraseFromServer?: string;
};

export type BlackbirdPresentation = {
  eventType: BlackbirdEventType;
  phrase: string;
  seedBase: number;
};

export function resolveBlackbirdPresentation(input: BlackbirdPresentationInput): BlackbirdPresentation {
  const seedBase = hashString(
    `${input.eventId || ""}:${input.eventType || ""}:${input.winnerName || ""}:${input.loserName || ""}:${input.drawChainCount || 0}:${input.wishSuit || ""}:${input.statsText || ""}`,
  );

  let eventType: BlackbirdEventType = input.eventType || "round_start";
  let phrase: string;

  if (input.winnerName) {
    eventType = "winner";
    phrase = pickBySeed(WINNER_PHRASES, seedBase, 1)(input.winnerName);
  } else if (input.loserName) {
    eventType = "loser";
    phrase = pickBySeed(LOSER_PHRASES, seedBase, 2)(input.loserName);
  } else if (input.eventType === "seven_played") {
    phrase = pickBySeed(SEVEN_PLAYED_PHRASES, seedBase, 3)(input.drawChainCount || 1);
  } else if (input.eventType === "direction_shift") {
    phrase = pickBySeed(DIRECTION_SHIFT_PHRASES, seedBase, 33)();
  } else if (input.eventType === "draw_chain" && input.drawChainCount) {
    phrase = pickBySeed(DRAW_CHAIN_PHRASES, seedBase, 4)(input.drawChainCount);
  } else if (input.eventType === "ass") {
    phrase = pickBySeed(ASS_PHRASES, seedBase, 5);
  } else if (input.eventType === "unter" && input.wishSuit) {
    phrase = pickBySeed(UNTER_PHRASES, seedBase, 6)();
  } else if (input.eventType === "invalid") {
    phrase = pickBySeed(INVALID_PHRASES, seedBase, 34)();
  } else if (input.eventType === "mvp" && input.statsText) {
    phrase = pickBySeed(MVP_PHRASES, seedBase, 7)(input.statsText);
  } else {
    phrase = pickBySeed(ROUND_START_PHRASES, seedBase, 8);
  }

  if (input.phraseFromServer && input.phraseFromServer.trim().length > 0) {
    phrase = input.phraseFromServer.trim();
  }

  return { eventType, phrase, seedBase };
}
