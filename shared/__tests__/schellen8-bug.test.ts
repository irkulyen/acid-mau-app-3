/// <reference types="vitest/globals" />
import { createGameState, processAction } from "../game-engine";
import type { Player, GameState, Card } from "../game-types";

function createTwoPlayers(): Player[] {
  return [
    { id: 1, userId: 1, username: "PlayerA", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
    { id: 2, userId: 2, username: "PlayerB", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
  ];
}

function buildState(): GameState {
  const players = createTwoPlayers();
  const state = createGameState(1, "TEST", players, 1);
  return {
    ...state,
    phase: "playing",
    hasRoundStarted: true,
    currentPlayerIndex: 0,
    dealerIndex: 0,
    direction: "clockwise",
    drawChainCount: 0,
    skipNextPlayer: false,
    roundNumber: 1,
    discardPile: [{ suit: "schellen", rank: "9", id: "schellen-9" }],
    deck: [{ suit: "rot", rank: "7", id: "rot-7" }],
    players: [
      {
        ...players[0],
        hand: [
          { suit: "schellen", rank: "8", id: "schellen-8" },
          { suit: "rot", rank: "9", id: "rot-9" },
        ],
      },
      {
        ...players[1],
        hand: [
          { suit: "eichel", rank: "9", id: "eichel-9" },
          { suit: "gruen", rank: "7", id: "gruen-7" },
        ],
      },
    ],
  };
}

describe("Schellen-8 bei 2 Spielern", () => {
  it("A legt Schellen-8 → A bleibt dran", () => {
    const state = buildState();
    const newState = processAction(state, { type: "PLAY_CARD", cardId: "schellen-8" }, 1);
    expect(newState.currentPlayerIndex).toBe(0);
    expect(newState.players[newState.currentPlayerIndex].username).toBe("PlayerA");
  });

  it("A legt Schellen-8 → B kann NICHT legen (wirft Fehler)", () => {
    const state = buildState();
    const afterA = processAction(state, { type: "PLAY_CARD", cardId: "schellen-8" }, 1);

    // B versucht eichel-9 zu legen — muss fehlschlagen weil B nicht dran ist
    expect(() => {
      processAction(afterA, { type: "PLAY_CARD", cardId: "eichel-9" }, 2);
    }).toThrow("Not your turn");
  });

  it("A legt Schellen-8 → A kann danach legen", () => {
    const state = buildState();
    const afterA = processAction(state, { type: "PLAY_CARD", cardId: "schellen-8" }, 1);

    // A legt rot-9 (passt auf schellen-9 via Rang 9, Schellen-8 ist transparent)
    expect(() => {
      processAction(afterA, { type: "PLAY_CARD", cardId: "rot-9" }, 1);
    }).not.toThrow();
  });
});
