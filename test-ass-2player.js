// Test: 2 Spieler, Ass spielen
const { createGameState, startGame, processAction } = require('./shared/game-engine.ts');
const { performGamePreparation } = require('./shared/game-preparation.ts');

const players = [
  { id: 1, userId: 1, username: "Player1", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
  { id: 2, userId: 2, username: "Player2", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
];

const { players: sortedPlayers, dealerIndex } = performGamePreparation(players);
const state = createGameState(1, "TEST", sortedPlayers, 1);
state.dealerIndex = dealerIndex;
const gameState = startGame(state);

console.log("Initial state:");
console.log("- Phase:", gameState.phase);
console.log("- Current player:", gameState.players[gameState.currentPlayerIndex].username);
console.log("- Player 1 hand:", gameState.players[0].hand.length, "cards");
console.log("- Player 2 hand:", gameState.players[1].hand.length, "cards");
console.log("- Discard pile top:", gameState.discardPile[gameState.discardPile.length - 1]?.id);

// Find an Ass in current player's hand
const currentPlayer = gameState.players[gameState.currentPlayerIndex];
const assCard = currentPlayer.hand.find(c => c.rank === "ass");

if (assCard) {
  console.log("\nPlaying Ass:", assCard.id);
  try {
    const newState = processAction(gameState, { type: "PLAY_CARD", cardId: assCard.id }, currentPlayer.id);
    console.log("After Ass:");
    console.log("- Phase:", newState.phase);
    console.log("- Current player:", newState.players[newState.currentPlayerIndex].username);
    console.log("- Player 1 hand:", newState.players[0].hand.length, "cards");
    console.log("- Player 2 hand:", newState.players[1].hand.length, "cards");
    console.log("- skipNextPlayer:", newState.skipNextPlayer);
  } catch (e) {
    console.error("Error:", e.message);
  }
} else {
  console.log("\nNo Ass in current player's hand");
}
