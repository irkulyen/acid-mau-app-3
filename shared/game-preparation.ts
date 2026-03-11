import type { Player, Card } from "./game-types";
import { createDeck, shuffleDeck, dealCards } from "./deck-utils";
import { getHighestCard, getLowestCard } from "./card-comparison";

/**
 * Spielvorbereitung nach ACID-MAU Regelwerk
 * 
 * 1. Platzwahl:
 *    - Jeder Spieler zieht eine Karte
 *    - Höchste Karte wählt zuerst den Sitzplatz
 *    - Sitzordnung bleibt dauerhaft
 * 
 * 2. Dealerwahl:
 *    - Alle Spieler ziehen erneut eine Karte
 *    - Niedrigste Karte ist Dealer
 *    - Kein Gleichstand möglich (durch Rang+Farb-Hierarchie)
 */

export interface SeatDrawResult {
  playerId: number;
  username: string;
  card: Card;
}

export interface PreparationResult {
  players: Player[]; // Mit seatPosition sortiert
  dealerIndex: number;
  seatDraws: SeatDrawResult[]; // Gezogene Karten für Platzwahl (unsortiert, Originalreihenfolge)
  dealerDraws: SeatDrawResult[]; // Gezogene Karten für Dealerwahl (in Sitzreihenfolge)
}

/**
 * Führt Platzwahl und Dealerwahl durch.
 * @param players Unsortierte Spielerliste
 * @returns Sortierte Spielerliste (nach seatPosition) + dealerIndex + gezogene Karten
 */
export function performGamePreparation(players: Player[]): PreparationResult {
  if (players.length < 2) {
    throw new Error("Mindestens 2 Spieler erforderlich");
  }

  // Schritt 1: Platzwahl
  const { sortedPlayers, draws: seatDraws } = performSeatSelection(players);

  // Schritt 2: Dealerwahl
  const { dealerIndex, draws: dealerDraws } = performDealerSelection(sortedPlayers);

  return {
    players: sortedPlayers,
    dealerIndex,
    seatDraws,
    dealerDraws,
  };
}

/**
 * Platzwahl: Jeder Spieler zieht eine Karte, höchste Karte wählt zuerst.
 */
function performSeatSelection(players: Player[]): { sortedPlayers: Player[]; draws: SeatDrawResult[] } {
  const deck = shuffleDeck(createDeck());
  
  // Jeder Spieler zieht eine Karte
  const playerCards: Array<{ player: Player; card: Card }> = [];
  for (let i = 0; i < players.length; i++) {
    const { hand } = dealCards(deck.slice(i), 1);
    playerCards.push({ player: players[i], card: hand[0] });
  }

  // Speichere die Draws in Originalreihenfolge
  const draws: SeatDrawResult[] = playerCards.map(pc => ({
    playerId: pc.player.id,
    username: pc.player.username,
    card: pc.card,
  }));

  // Sortiere nach Kartenwert (höchste zuerst)
  playerCards.sort((a, b) => {
    const cardA = a.card;
    const cardB = b.card;
    const highestCard = getHighestCard([cardA, cardB]);
    return highestCard?.id === cardA.id ? -1 : 1;
  });

  // Weise Sitzplätze zu (0 = erster Platz, höchste Karte)
  const sortedPlayers = playerCards.map((pc, index) => ({
    ...pc.player,
    seatPosition: index,
  }));

  return { sortedPlayers, draws };
}

/**
 * Dealerwahl: Alle Spieler ziehen erneut eine Karte, niedrigste Karte ist Dealer.
 */
function performDealerSelection(players: Player[]): { dealerIndex: number; draws: SeatDrawResult[] } {
  const deck = shuffleDeck(createDeck());
  
  // Jeder Spieler zieht eine Karte
  const playerCards: Array<{ playerIndex: number; card: Card }> = [];
  for (let i = 0; i < players.length; i++) {
    const { hand } = dealCards(deck.slice(i), 1);
    playerCards.push({ playerIndex: i, card: hand[0] });
  }

  // Speichere die Draws
  const draws: SeatDrawResult[] = playerCards.map(pc => ({
    playerId: players[pc.playerIndex].id,
    username: players[pc.playerIndex].username,
    card: pc.card,
  }));

  // Finde niedrigste Karte
  const lowestCard = getLowestCard(playerCards.map(pc => pc.card));
  if (!lowestCard) {
    throw new Error("Keine niedrigste Karte gefunden");
  }

  // Finde Spieler mit niedrigster Karte
  const dealerEntry = playerCards.find(pc => pc.card.id === lowestCard.id);
  if (!dealerEntry) {
    throw new Error("Dealer nicht gefunden");
  }

  return { dealerIndex: dealerEntry.playerIndex, draws };
}
