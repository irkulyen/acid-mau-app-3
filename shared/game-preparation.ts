import type { Player, Card } from "./game-types";
import { createDeck, shuffleDeck } from "./deck-utils";
import { compareCards, getHighestCard, getLowestCard } from "./card-comparison";

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

export interface SeatChoice {
  userId: number;
  seatPosition: number;
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
 * Zieht pro Spieler genau eine Karte (in Spielerreihenfolge).
 */
export function drawCardsForPlayers(players: Player[]): SeatDrawResult[] {
  const deck = shuffleDeck(createDeck());
  if (deck.length < players.length) {
    throw new Error("Nicht genug Karten für Vorbereitung");
  }

  return players.map((player, index) => ({
    playerId: player.id,
    username: player.username,
    card: deck[index],
  }));
}

/**
 * Ermittelt die Ziehreihenfolge für die Platzwahl (höchste Karte zuerst).
 */
export function getSeatPickOrderPlayerIds(seatDraws: SeatDrawResult[]): number[] {
  return [...seatDraws]
    .sort((a, b) => compareCards(b.card, a.card))
    .map((d) => d.playerId);
}

/**
 * Baut die finale Sitzordnung anhand expliziter Sitzentscheidungen.
 */
export function applySeatChoices(players: Player[], seatChoices: SeatChoice[]): Player[] {
  const expectedSeats = players.length;
  if (seatChoices.length !== expectedSeats) {
    throw new Error(`Unvollständige Platzwahl: ${seatChoices.length}/${expectedSeats}`);
  }

  const usedSeats = new Set<number>();
  const usedUsers = new Set<number>();
  for (const choice of seatChoices) {
    if (choice.seatPosition < 0 || choice.seatPosition >= expectedSeats) {
      throw new Error(`Ungültiger Sitzplatz: ${choice.seatPosition}`);
    }
    if (usedSeats.has(choice.seatPosition)) {
      throw new Error(`Sitzplatz ${choice.seatPosition} wurde doppelt gewählt`);
    }
    if (usedUsers.has(choice.userId)) {
      throw new Error(`User ${choice.userId} hat mehrfach gewählt`);
    }
    usedSeats.add(choice.seatPosition);
    usedUsers.add(choice.userId);
  }

  const byUser = new Map(players.map((p) => [p.userId, p]));
  const orderedBySeat = [...seatChoices]
    .sort((a, b) => a.seatPosition - b.seatPosition)
    .map((choice, index) => {
      const player = byUser.get(choice.userId);
      if (!player) {
        throw new Error(`Spieler für User ${choice.userId} nicht gefunden`);
      }
      return { ...player, seatPosition: index };
    });

  if (orderedBySeat.length !== players.length) {
    throw new Error("Sitzordnung unvollständig");
  }

  return orderedBySeat;
}

/**
 * Dealerwahl anhand bestehender Sitzordnung.
 */
export function performDealerSelectionForPlayers(players: Player[]): { dealerIndex: number; draws: SeatDrawResult[] } {
  return performDealerSelection(players);
}

/**
 * Platzwahl: Jeder Spieler zieht eine Karte, höchste Karte wählt zuerst.
 */
function performSeatSelection(players: Player[]): { sortedPlayers: Player[]; draws: SeatDrawResult[] } {
  const draws = drawCardsForPlayers(players);
  const drawByPlayerId = new Map(draws.map((d) => [d.playerId, d.card]));
  const playerCards: Array<{ player: Player; card: Card }> = players.map((player) => {
    const card = drawByPlayerId.get(player.id);
    if (!card) throw new Error(`Keine Platzwahl-Karte für ${player.username}`);
    return { player, card };
  });

  // Speichere die Draws in Originalreihenfolge
  // Sortiere nach Kartenwert (höchste zuerst)
  playerCards.sort((a, b) => compareCards(b.card, a.card));

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
  const draws = drawCardsForPlayers(players);
  const drawByPlayerId = new Map(draws.map((d) => [d.playerId, d.card]));
  const playerCards: Array<{ playerIndex: number; card: Card }> = players.map((player, idx) => {
    const card = drawByPlayerId.get(player.id);
    if (!card) throw new Error(`Keine Dealer-Karte für ${player.username}`);
    return { playerIndex: idx, card };
  });

  // Speichere die Draws
  const orderedDraws: SeatDrawResult[] = playerCards.map(pc => ({
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

  return { dealerIndex: dealerEntry.playerIndex, draws: orderedDraws };
}
