import { describe, it, expect } from "vitest";
import { createGameState, startGame, processAction } from "./shared/game-engine";
import { performGamePreparation } from "./shared/game-preparation";
import type { Player } from "./shared/game-types";

describe("2-Player Ass scenario", () => {
  it("should handle Ass card with 2 players correctly", () => {
    const players: Player[] = [
      { id: 1, userId: 1, username: "Player1", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
      { id: 2, userId: 2, username: "Player2", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
    ];

    const { players: sortedPlayers, dealerIndex } = performGamePreparation(players);
    const state = createGameState(1, "TEST", sortedPlayers, 1);
    state.dealerIndex = dealerIndex;
    let gameState = startGame(state);

    console.log("Initial:");
    console.log("- Current player:", gameState.players[gameState.currentPlayerIndex].username);
    console.log("- Player 0 hand:", gameState.players[0].hand.length);
    console.log("- Player 1 hand:", gameState.players[1].hand.length);

    // Find an Ass in current player's hand
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const assCard = currentPlayer.hand.find(c => c.rank === "ass");

    if (assCard) {
      console.log("\nPlaying Ass:", assCard.id);
      gameState = processAction(gameState, { type: "PLAY_CARD", cardId: assCard.id }, currentPlayer.id);
      
      console.log("After Ass:");
      console.log("- Phase:", gameState.phase);
      console.log("- Current player:", gameState.players[gameState.currentPlayerIndex].username);
      console.log("- Player 0 hand:", gameState.players[0].hand.length);
      console.log("- Player 1 hand:", gameState.players[1].hand.length);
      console.log("- skipNextPlayer:", gameState.skipNextPlayer);
      console.log("- currentPlayerIndex:", gameState.currentPlayerIndex);

      expect(gameState.phase).toBe("playing");
    } else {
      console.log("No Ass found, test skipped");
    }
  });
});
