import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Card, GameState, Player } from "../game-types";

let mockedDeck: Card[] = [];

vi.mock("../deck-utils", async () => {
  const actual = await vi.importActual<typeof import("../deck-utils")>("../deck-utils");
  return {
    ...actual,
    createDeck: () => mockedDeck.map((card) => ({ ...card })),
    shuffleDeck: (deck: Card[]) => deck,
  };
});

import { createGameState, processAction, startNewRound } from "../game-engine";

function makeCard(suit: Card["suit"], rank: Card["rank"]): Card {
  return { suit, rank, id: `${suit}-${rank}` };
}

function makePlayer(id: number): Player {
  return {
    id,
    userId: id,
    username: `Player${id}`,
    hand: [],
    lossPoints: 0,
    isEliminated: false,
    isReady: false,
  };
}

function makeBaseState(players: Player[]): GameState {
  return {
    roomId: 1,
    roomCode: "TEST01",
    phase: "playing",
    players,
    currentPlayerIndex: 0,
    dealerIndex: 0,
    direction: "clockwise",
    deck: [],
    discardPile: [makeCard("rot", "9")],
    currentWishSuit: null,
    drawChainCount: 0,
    skipNextPlayer: false,
    roundNumber: 1,
    hostUserId: 1,
    hasRoundStarted: true,
    openingFreePlay: false,
    blackbird: {
      recentEvents: [],
      updatedAt: Date.now(),
    },
  };
}

describe("Confirmed Round Rule Set", () => {
  beforeEach(() => {
    mockedDeck = [];
  });

  it("Ass as start card skips the first player immediately", () => {
    const players = [makePlayer(1), makePlayer(2), makePlayer(3)];
    const state = createGameState(1, "ROOM01", players, 1);
    state.phase = "playing";
    state.roundNumber = 1;
    state.dealerIndex = 0;

    mockedDeck = [
      makeCard("eichel", "7"),
      makeCard("gruen", "8"),
      makeCard("rot", "9"),
      makeCard("schellen", "ass"),
      makeCard("eichel", "10"),
      makeCard("gruen", "dame"),
    ];

    const next = startNewRound(state);
    expect(next.discardPile[0]?.rank).toBe("ass");
    // dealer=0 -> normal start would be index 1; with ass-start skip -> index 2
    expect(next.currentPlayerIndex).toBe(2);
    expect(next.skipNextPlayer).toBe(false);
  });

  it("Schellen-8 as start card sets dealer as current player", () => {
    const players = [makePlayer(1), makePlayer(2), makePlayer(3)];
    const state = createGameState(1, "ROOM02", players, 1);
    state.phase = "playing";
    state.roundNumber = 1;
    state.dealerIndex = 1;

    mockedDeck = [
      makeCard("eichel", "7"),
      makeCard("gruen", "8"),
      makeCard("rot", "9"),
      makeCard("schellen", "8"),
      makeCard("eichel", "10"),
      makeCard("gruen", "dame"),
    ];

    const next = startNewRound(state);
    expect(next.discardPile[0]?.id).toBe("schellen-8");
    expect(next.direction).toBe("counterclockwise");
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.openingFreePlay).toBe(true);
  });

  it("When draw pile is empty and only one discard card exists, round restarts", () => {
    const state = makeBaseState([makePlayer(1), makePlayer(2)]);
    state.dealerIndex = 0;
    state.deck = [];
    state.discardPile = [makeCard("rot", "9")];
    state.players[0].hand = [makeCard("eichel", "konig")];
    state.players[1].hand = [makeCard("gruen", "konig")];

    mockedDeck = [
      makeCard("eichel", "7"),
      makeCard("gruen", "8"),
      makeCard("rot", "10"),
      makeCard("schellen", "9"),
      makeCard("eichel", "dame"),
    ];

    const next = processAction(state, { type: "DRAW_CARD" }, 1);
    expect(next.phase).toBe("playing");
    expect(next.roundNumber).toBe(1);
    expect(next.discardPile.length).toBe(1);
    expect(next.players[0].hand.length).toBe(1);
    expect(next.players[1].hand.length).toBe(1);
  });

  it("NEXT_ROUND is rejected until all active players are READY", () => {
    const state = makeBaseState([makePlayer(1), makePlayer(2), makePlayer(3)]);
    state.phase = "round_end";
    state.players[0].isReady = true;
    state.players[1].isReady = false;
    state.players[2].isReady = true;

    expect(() => processAction(state, { type: "NEXT_ROUND" }, 1)).toThrow(
      "Cannot start next round until all active players are READY",
    );
  });
});

