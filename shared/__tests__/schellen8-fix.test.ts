import { describe, it, expect } from "vitest";
import { createGameState, startNewRound } from "../game-engine";
import { canPlayCard, applySpecialCardEffect, getNextPlayerIndex } from "../game-rules";
import type { GameState, Player, Card } from "../game-types";

function makePlayer(id: number, hand: Card[]): Player {
  return {
    id,
    userId: id,
    username: `Player${id}`,
    hand,
    lossPoints: 0,
    isEliminated: false,
    isReady: false,
  };
}

function makeState(players: Player[], discardPile: Card[]): GameState {
  return {
    roomId: 1,
    roomCode: "TEST",
    phase: "playing",
    players,
    currentPlayerIndex: 0,
    dealerIndex: 0,
    direction: "clockwise",
    deck: [],
    discardPile,
    currentWishSuit: null,
    drawChainCount: 0,
    skipNextPlayer: false,
    roundNumber: 1,
    hostUserId: 1,
    hasRoundStarted: false,
    openingFreePlay: false,
  };
}

const SCHELLEN_8: Card = { id: "schellen-8", suit: "schellen", rank: "8" };
const EICHEL_7: Card = { id: "eichel-7", suit: "eichel", rank: "7" };
const ROT_KONIG: Card = { id: "rot-konig", suit: "rot", rank: "konig" };
const GRUEN_9: Card = { id: "gruen-9", suit: "gruen", rank: "9" };

describe("Schellen-8 Fixes", () => {
  describe("Bug 1: Schellen-8 als Startkarte — openingFreePlay", () => {
    it("openingFreePlay=true: beliebige Karte ist spielbar", () => {
      const state = makeState(
        [makePlayer(1, [ROT_KONIG]), makePlayer(2, [GRUEN_9])],
        [SCHELLEN_8]
      );
      // Beliebige Karte soll spielbar sein
      const result = canPlayCard(ROT_KONIG, SCHELLEN_8, null, 0, true);
      expect(result.isValid).toBe(true);
    });

    it("openingFreePlay=false: normale Regeln gelten", () => {
      const state = makeState(
        [makePlayer(1, [ROT_KONIG]), makePlayer(2, [GRUEN_9])],
        [SCHELLEN_8]
      );
      // ROT_KONIG passt nicht auf EICHEL_7 (andere Farbe, anderer Rang)
      const result = canPlayCard(ROT_KONIG, EICHEL_7, null, 0, false);
      expect(result.isValid).toBe(false);
    });
  });

  describe("Bug 2: Schellen-8 bei 2 Spielern — B muss aussetzen", () => {
    it("applySpecialCardEffect setzt skipNextPlayer=true bei 2 Spielern", () => {
      const state = makeState(
        [makePlayer(1, [EICHEL_7]), makePlayer(2, [GRUEN_9])],
        [EICHEL_7]
      );
      const newState = applySpecialCardEffect(state, SCHELLEN_8);
      expect(newState.skipNextPlayer).toBe(true);
    });

    it("getNextPlayerIndex: bei skipNextPlayer + 2 Spielern bleibt Spieler 0 dran", () => {
      const state = makeState(
        [makePlayer(1, [EICHEL_7]), makePlayer(2, [GRUEN_9])],
        [SCHELLEN_8]
      );
      const stateWithSkip = { ...state, skipNextPlayer: true };
      const nextIndex = getNextPlayerIndex(stateWithSkip);
      expect(nextIndex).toBe(0); // Spieler 0 bleibt dran
    });
  });
});
