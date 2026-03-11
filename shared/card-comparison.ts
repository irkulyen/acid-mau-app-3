import type { Card, CardSuit, CardRank } from "./game-types";

/**
 * Kartenvergleich nach ACID-MAU Regelwerk
 * 
 * REGEL: ZUERST zählt immer der RANG, NUR bei gleichem Rang entscheidet die FARBE.
 * 
 * RÄNGE (hoch → niedrig): Ass, König, Dame, Bube, Zehn, Neun, Acht, Sieben
 * FARBEN (hoch → niedrig): Eichel, Grün, Rot, Schellen
 */

const RANK_ORDER: Record<CardRank, number> = {
  ass: 8,
  konig: 7,
  dame: 6,
  bube: 5,
  "10": 4,
  "9": 3,
  "8": 2,
  "7": 1,
};

const SUIT_ORDER: Record<CardSuit, number> = {
  eichel: 4,
  gruen: 3,
  rot: 2,
  schellen: 1,
};

/**
 * Vergleicht zwei Karten nach Regelwerk.
 * @returns Positive Zahl wenn card1 > card2, negative Zahl wenn card1 < card2, 0 wenn gleich
 */
export function compareCards(card1: Card, card2: Card): number {
  // ZUERST Rang vergleichen
  const rankDiff = RANK_ORDER[card1.rank] - RANK_ORDER[card2.rank];
  if (rankDiff !== 0) {
    return rankDiff;
  }

  // NUR bei gleichem Rang: Farbe vergleichen
  return SUIT_ORDER[card1.suit] - SUIT_ORDER[card2.suit];
}

/**
 * Findet die höchste Karte in einem Array.
 */
export function getHighestCard(cards: Card[]): Card | null {
  if (cards.length === 0) return null;
  
  return cards.reduce((highest, current) => 
    compareCards(current, highest) > 0 ? current : highest
  );
}

/**
 * Findet die niedrigste Karte in einem Array.
 */
export function getLowestCard(cards: Card[]): Card | null {
  if (cards.length === 0) return null;
  
  return cards.reduce((lowest, current) => 
    compareCards(current, lowest) < 0 ? current : lowest
  );
}
