/**
 * Reproduziert den Online-Modus Bug:
 * A legt Schellen-8 → B ist dran (falsch, A sollte dran bleiben)
 *
 * Simuliert genau was der Server macht:
 * 1. processAction mit Schellen-8
 * 2. filterStateForPlayer (wie broadcastFilteredState)
 * 3. Client-seitige isMyTurn-Berechnung
 */
import { describe, it, expect } from "vitest";
import { processAction } from "../game-engine";
import type { GameState, Player, Card } from "../game-types";

function makePlayer(id: number, userId: number, username: string, hand: Card[]): Player {
  return {
    id,
    userId,
    username,
    hand,
    lossPoints: 0,
    isEliminated: false,
    isReady: true,
  };
}

function makeState(players: Player[], discardPile: Card[]): GameState {
  return {
    roomId: 1,
    roomCode: "TEST",
    phase: "playing",
    players,
    currentPlayerIndex: 0, // PlayerA (userId=100) ist dran
    dealerIndex: 0,
    direction: "clockwise",
    discardPile,
    deck: [
      { id: "eichel-7", suit: "eichel", rank: "7" },
    ],
    currentWishSuit: null,
    drawChainCount: 0,
    skipNextPlayer: false,
    roundNumber: 1,
    hostUserId: 100,
    hasRoundStarted: true,
    openingFreePlay: false,
  };
}

// Simuliert filterStateForPlayer wie im Server
function filterStateForPlayer(state: GameState, userId: number): GameState {
  return {
    ...state,
    deck: state.deck.map(() => ({ suit: "schellen" as const, rank: "7" as const, id: "hidden" })),
    players: state.players.map((p) => {
      if (p.userId === userId) return p;
      return {
        ...p,
        hand: p.hand.map(() => ({ suit: "schellen" as const, rank: "7" as const, id: "hidden" })),
      };
    }),
  };
}

const SCHELLEN_8: Card = { id: "schellen-8", suit: "schellen", rank: "8" };
const ROT_9: Card = { id: "rot-9", suit: "rot", rank: "9" };
const SCHELLEN_9: Card = { id: "schellen-9", suit: "schellen", rank: "9" };

describe("Schellen-8 Online-Modus Simulation", () => {
  it("A (userId=100) legt Schellen-8 → gefilterter State zeigt A als currentPlayer", () => {
    // PlayerA: userId=100, interne id=1
    // PlayerB: userId=200, interne id=2
    const playerA = makePlayer(1, 100, "PlayerA", [SCHELLEN_8, ROT_9]);
    const playerB = makePlayer(2, 200, "PlayerB", [ROT_9]);
    const state = makeState([playerA, playerB], [SCHELLEN_9]);

    // Server: processAction
    const newState = processAction(state, { type: "PLAY_CARD", cardId: "schellen-8" }, 1);
    
    console.log("=== Server State nach Schellen-8 ===");
    console.log("currentPlayerIndex:", newState.currentPlayerIndex);
    console.log("currentPlayer:", newState.players[newState.currentPlayerIndex].username);
    console.log("direction:", newState.direction);
    console.log("skipNextPlayer:", newState.skipNextPlayer);

    // Server: filterStateForPlayer für PlayerA (userId=100)
    const filteredForA = filterStateForPlayer(newState, 100);
    
    // Client-seitige isMyTurn-Berechnung (wie in play.tsx)
    const currentPlayerA = filteredForA.players.find(p => p.userId === 100);
    const isMyTurnA = filteredForA.players[filteredForA.currentPlayerIndex]?.id === currentPlayerA?.id;
    
    console.log("=== Client-Sicht PlayerA ===");
    console.log("currentPlayerIndex (gefiltert):", filteredForA.currentPlayerIndex);
    console.log("currentPlayer (gefiltert):", filteredForA.players[filteredForA.currentPlayerIndex].username);
    console.log("currentPlayerA.id:", currentPlayerA?.id);
    console.log("isMyTurnA:", isMyTurnA);

    // Server: filterStateForPlayer für PlayerB (userId=200)
    const filteredForB = filterStateForPlayer(newState, 200);
    const currentPlayerB = filteredForB.players.find(p => p.userId === 200);
    const isMyTurnB = filteredForB.players[filteredForB.currentPlayerIndex]?.id === currentPlayerB?.id;
    
    console.log("=== Client-Sicht PlayerB ===");
    console.log("isMyTurnB:", isMyTurnB);

    // Erwartung: A ist dran, B nicht
    expect(isMyTurnA).toBe(true);
    expect(isMyTurnB).toBe(false);
  });
});

  it("A (userId=100) an Index 1 legt Schellen-8 → A bleibt dran", () => {
    const playerB = makePlayer(2, 200, "PlayerB", [ROT_9]);
    const playerA = makePlayer(1, 100, "PlayerA", [SCHELLEN_8, ROT_9]);
    // A ist an Index 1, B an Index 0
    const state = {
      ...makeState([playerB, playerA], [SCHELLEN_9]),
      currentPlayerIndex: 1, // A ist dran
    };

    const newState = processAction(state, { type: "PLAY_CARD", cardId: "schellen-8" }, 1);
    
    console.log("=== A an Index 1 ===");
    console.log("currentPlayerIndex:", newState.currentPlayerIndex);
    console.log("currentPlayer:", newState.players[newState.currentPlayerIndex].username);

    const filteredForA = filterStateForPlayer(newState, 100);
    const currentPlayerA = filteredForA.players.find(p => p.userId === 100);
    const isMyTurnA = filteredForA.players[filteredForA.currentPlayerIndex]?.id === currentPlayerA?.id;
    console.log("isMyTurnA:", isMyTurnA);

    expect(isMyTurnA).toBe(true);
  });
