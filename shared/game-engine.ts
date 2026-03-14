import type { GameState, Player, GameAction, Card, CardSuit } from "./game-types";
import { createDeck, shuffleDeck, dealCards, findCardById, removeCardFromHand } from "./deck-utils";
import { performGamePreparation } from "./game-preparation";
import {
  canPlayCard,
  hasPlayableCard,
  applySpecialCardEffect,
  getInitialCardCount,
  isRoundOver,
  isGameOver,
  getRoundWinner,
  getGameWinner,
  getNextPlayerIndex,
  getNextActivePlayerIndex,
  calculateRoundLossPoints,
  isPlayerEliminated,
  getEffectiveTopCard,
} from "./game-rules";

// ============================================================================
// Game Initialization
// ============================================================================

/**
 * Creates initial game state
 */
export function createGameState(roomId: number, roomCode: string, players: Player[], hostUserId: number): GameState {
  return {
    roomId,
    roomCode,
    phase: "waiting",
    players,
    currentPlayerIndex: 0,
    dealerIndex: 0, // Will be randomized on game start
    direction: "clockwise",
    deck: [],
    discardPile: [],
    currentWishSuit: null,
    drawChainCount: 0,
    skipNextPlayer: false,
    roundNumber: 0,
    hostUserId,
    hasRoundStarted: false,
    openingFreePlay: false,
  };
}

/**
 * Starts a new game
 */
export function startGame(state: GameState): GameState {
  if (state.players.length < 2) {
    throw new Error("Need at least 2 players to start");
  }

  // REGEL: dealerIndex MUSS bereits durch Kartenvergleich festgelegt sein
  // (niedrigste Karte ist Dealer, siehe performDealerSelection)
  if (state.dealerIndex === undefined || state.dealerIndex < 0) {
    throw new Error("dealerIndex must be set before starting game (use performDealerSelection)");
  }

  const newState = { ...state };
  newState.phase = "playing";
  newState.roundNumber = 1;

  return startNewRound(newState);
}

/**
 * Starts a new round
 */
export function startNewRound(state: GameState): GameState {
  const newState = { ...state };

  // Create and shuffle deck
  let deck = createDeck();
  deck = shuffleDeck(deck);

  // Deal cards to players based on their loss points
  const players = newState.players.map((player) => {
    if (player.isEliminated) {
      return player;
    }

    const cardCount = getInitialCardCount(player.lossPoints);
    const { hand, remainingDeck } = dealCards(deck, cardCount);
    deck = remainingDeck;

    return {
      ...player,
      hand,
    };
  });

  // Place first card on discard pile
  const { hand: firstCard, remainingDeck } = dealCards(deck, 1);
  deck = remainingDeck;

  newState.players = players;
  newState.deck = deck;
  newState.discardPile = firstCard;
  
  // Rotate dealer (only for rounds after the first)
  if (newState.roundNumber > 1) {
    newState.dealerIndex = getNextActivePlayerIndex(players, newState.dealerIndex, 1, 1);
  }
  
  // Starting player is the player after the dealer
  newState.currentPlayerIndex = getNextActivePlayerIndex(players, newState.dealerIndex, 1, 1);
  
  newState.direction = "clockwise";
  newState.currentWishSuit = null;
  newState.drawChainCount = 0;
  newState.openingFreePlay = false;
  
  // REGEL: Sonderkarten als Startkarte behandeln
  const startCard = firstCard[0];
  if (startCard) {
    if (startCard.rank === "ass") {
      // REGEL: Ass als Startkarte → erster Spieler setzt aus
      newState.skipNextPlayer = true;
    } else if (startCard.rank === "bube") {
      // REGEL: Unter als Startkarte → freier Eröffnungszug (jede Karte erlaubt)
      // Wunschfarbe bleibt explizit leer.
      newState.currentWishSuit = null;
      newState.skipNextPlayer = false;
      newState.openingFreePlay = true;
    } else if (startCard.rank === "7") {
      // REGEL: 7 als Startkarte → Ziehkette startet
      newState.drawChainCount = 2;
      newState.skipNextPlayer = false;
    } else if (startCard.id === "schellen-8") {
      // REGEL: Schellen-8 als Startkarte → Richtung umkehren + erster Spieler darf beliebige Karte legen
      newState.direction = "counterclockwise";
      newState.skipNextPlayer = false;
      newState.openingFreePlay = true;
    } else {
      newState.skipNextPlayer = false;
    }
  } else {
    newState.skipNextPlayer = false;
  }
  
  newState.phase = "playing";
  
  // FIX 1: Reset hasRoundStarted flag
  newState.hasRoundStarted = false;
  
  // FIX 2: Validate all non-eliminated players have cards
  const activePlayers = newState.players.filter(p => !p.isEliminated);
  const playersWithCards = activePlayers.filter(p => p.hand.length > 0);
  
  if (playersWithCards.length !== activePlayers.length) {
    throw new Error("startNewRound: Not all non-eliminated players received cards");
  }
  
  // FIX 4: Ensure at least 2 players with cards
  if (playersWithCards.length < 2) {
    throw new Error("startNewRound: Need at least 2 players with cards to start round");
  }

  return newState;
}

// ============================================================================
// Game Actions
// ============================================================================

/**
 * Processes a game action and returns the new state
 */
export function processAction(state: GameState, action: GameAction, playerId: number): GameState {
  switch (action.type) {
    case "START_GAME":
      return handleStartGame(state, playerId);

    case "PLAY_CARD":
      return handlePlayCard(state, playerId, action.cardId, action.wishSuit);

    case "DRAW_CARD":
      return handleDrawCard(state, playerId);

    case "READY":
      return handleReady(state, playerId);

    case "NEXT_ROUND":
      return handleNextRound(state);

    case "RESTART_ROUND":
      return handleRestartRound(state, playerId);

    case "LEAVE_GAME":
      return handleLeaveGame(state, playerId);

    default:
      return state;
  }
}

/**
 * Handles starting the game
 */
function handleStartGame(state: GameState, playerId: number): GameState {
  // playerId is the internal player ID (1, 2, 3...), hostUserId is the user ID (e.g. 270001)
  // We need to find the player and compare their userId with hostUserId
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.userId !== state.hostUserId) {
    throw new Error("Only the host can start the game");
  }

  if (state.phase !== "waiting") {
    throw new Error("Game already started");
  }

  // Perform seat selection and dealer selection
  console.log("[game-engine] Performing seat selection and dealer selection...");
  const { players: sortedPlayers, dealerIndex, seatDraws, dealerDraws } = performGamePreparation(state.players);
  console.log("[game-engine] Seat selection complete. Dealer:", sortedPlayers[dealerIndex].username);
  console.log("[game-engine] Seat order:", sortedPlayers.map((p, i) => `${i + 1}. ${p.username}`).join(", "));

  // Update state with sorted players and dealer
  const newState = {
    ...state,
    players: sortedPlayers,
    dealerIndex,
  };

  const gameState = startGame(newState);
  // Attach preparation data for the server to broadcast
  (gameState as any).__preparationData = { seatDraws, dealerDraws };
  return gameState;
}

/**
 * Validates if a card can be played
 */
function validatePlayCard(state: GameState, playerId: number, cardId: string, wishSuit?: CardSuit): { card: Card; currentPlayer: Player } {
  if (state.phase !== "playing") {
    throw new Error("Cannot play card outside of playing phase");
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error("Not your turn");
  }

  // ZUGSPERRE: Spieler mit 0 Karten darf keine Aktionen ausführen
  if (currentPlayer.hand.length === 0) {
    throw new Error("Cannot play card with empty hand");
  }

  const card = findCardById(currentPlayer.hand, cardId);
  if (!card) {
    throw new Error("Card not in hand");
  }

  const effectiveTopCard = getEffectiveTopCard(state.discardPile);
  const validation = canPlayCard(card, effectiveTopCard, state.currentWishSuit, state.drawChainCount, state.openingFreePlay);

  if (!validation.isValid) {
    throw new Error(validation.reason || "Invalid card");
  }

  // If playing Unter, wishSuit is required
  if (card.rank === "bube" && !wishSuit) {
    throw new Error("Must choose a suit when playing Unter");
  }

  return { card, currentPlayer };
}

/**
 * Applies card play to game state
 */
function applyCardPlay(state: GameState, card: Card, currentPlayer: Player, wishSuit?: CardSuit): GameState {
  let newState = { ...state };

  // Remove card from player's hand
  const newPlayers = [...newState.players];
  newPlayers[state.currentPlayerIndex] = {
    ...currentPlayer,
    hand: removeCardFromHand(currentPlayer.hand, card.id),
  };
  newState.players = newPlayers;

  // Add card to discard pile
  newState.discardPile = [...newState.discardPile, card];

  // REGEL: Wunsch endet nur durch:
  // 1. Neuen Unter (wird in applySpecialCardEffect gesetzt)
  // 2. Erfüllte Wunschfarbe (Karte mit gewünschter Farbe gespielt)
  if (newState.currentWishSuit && card.suit === newState.currentWishSuit && card.rank !== "bube") {
    newState.currentWishSuit = null; // Wunsch erfüllt
  }

  // Apply special card effects
  newState = applySpecialCardEffect(newState, card, wishSuit);

  // Mark round as started after first move
  newState.hasRoundStarted = true;
  // openingFreePlay endet nach dem ersten Zug
  newState.openingFreePlay = false;

  return newState;
}

/**
 * Advances turn to next player
 */
function advanceTurn(state: GameState): GameState {
  const newState = { ...state };
  
  // Check if round is over (only after first move)
  if (newState.hasRoundStarted && isRoundOver(newState.players)) {
    return handleRoundEnd(newState);
  }

  // Move to next player
  newState.currentPlayerIndex = getNextPlayerIndex(newState);
  newState.skipNextPlayer = false;

  return newState;
}

/**
 * Handles playing a card
 */
function handlePlayCard(state: GameState, playerId: number, cardId: string, wishSuit?: CardSuit): GameState {
  // 1. Validation
  const { card, currentPlayer } = validatePlayCard(state, playerId, cardId, wishSuit);
  
  // 2. State mutation
  let newState = applyCardPlay(state, card, currentPlayer, wishSuit);
  
  // 3. Turn advancement
  newState = advanceTurn(newState);

  return newState;
}

/**
 * Handles drawing a card
 */
function handleDrawCard(state: GameState, playerId: number): GameState {
  if (state.phase !== "playing") {
    throw new Error("Cannot draw card outside of playing phase");
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error("Not your turn");
  }

  // ZUGSPERRE: Spieler mit 0 Karten darf NIEMALS ziehen
  if (currentPlayer.hand.length === 0) {
    throw new Error("Cannot draw card with empty hand");
  }

  let newState = { ...state };
  
  // REGEL: Ziehen ist IMMER erlaubt, auch wenn Legen möglich wäre
  // (hasPlayableCard-Check entfernt)

  // Determine how many cards to draw
  let cardsToDraw = 1;
  if (newState.drawChainCount > 0) {
    cardsToDraw = newState.drawChainCount;
    newState.drawChainCount = 0;
  }

  // Draw cards from deck
  let deck = [...newState.deck];
  const drawnCards: Card[] = [];

  for (let i = 0; i < cardsToDraw; i++) {
    if (deck.length === 0) {
      // Reshuffle discard pile (except top card) into deck
      // Only reshuffle if there are at least 2 cards in discard pile
      if (newState.discardPile.length > 1) {
        const topCard = newState.discardPile[newState.discardPile.length - 1];
        deck = shuffleDeck(newState.discardPile.slice(0, -1));
        newState.discardPile = [topCard];
      } else {
        // SONDERFALL: Nur eine Ablagekarte + Nachziehstapel leer
        // → Runde SOFORT abgebrochen mit kollektiver Strafe (nur wenn mind. 2 Spieler mit Karten)
        const playersWithCards = newState.players.filter(p => !p.isEliminated && p.hand.length > 0);
        if (playersWithCards.length >= 2) {
          // Runde abbrechen mit kollektiver Strafe
          return abortRoundWithCollectivePenalty(newState);
        }
        // Sonst: Kann nicht mehr ziehen
        break;
      }
    }

    if (deck.length > 0) {
      drawnCards.push(deck[0]);
      deck = deck.slice(1);
    }
  }

  // Add drawn cards to player's hand
  const newPlayers = [...newState.players];
  newPlayers[state.currentPlayerIndex] = {
    ...currentPlayer,
    hand: [...currentPlayer.hand, ...drawnCards],
  };
  newState.players = newPlayers;
  newState.deck = deck;

  // REGEL: Ziehen beendet den Wunsch NICHT
  // (currentWishSuit bleibt erhalten)

  // ANWEISUNG 4: Prüfe Rundenende nach jedem Zug (nur nach erstem Zug)
  // Wenn currentPlayer jetzt 0 Karten hat, prüfe ob nur noch EIN Spieler Karten hat
  if (newState.hasRoundStarted && isRoundOver(newState.players)) {
    return handleRoundEnd(newState);
  }

  // Move to next player
  newState.currentPlayerIndex = getNextPlayerIndex(newState);
  newState.skipNextPlayer = false;

  return newState;
}

/**
 * Aborts round with collective penalty (special case: only one discard card left)
 * REGEL: Wenn Nachziehstapel leer + nur 1 Ablagekarte + mind. 2 Spieler mit Karten
 * → Runde SOFORT abgebrochen, ALLE Spieler mit Karten erhalten +1 Verlustpunkt
 */
function abortRoundWithCollectivePenalty(state: GameState): GameState {
  const newState = { ...state };
  newState.phase = "round_end";

  // Kollektive Strafe: ALLE Spieler mit Karten bekommen +1 Verlustpunkt
  const playersWithCards = newState.players.filter(p => !p.isEliminated && p.hand.length > 0);
  const lossPoints: Record<number, number> = {};
  playersWithCards.forEach(p => {
    lossPoints[p.id] = 1;
  });

  // Update player loss points and check for elimination
  const totalPlayerCount = newState.players.length;
  const newPlayers = newState.players.map((player) => {
    if (lossPoints[player.id]) {
      const newLossPoints = player.lossPoints + lossPoints[player.id];
      return {
        ...player,
        lossPoints: newLossPoints,
        isEliminated: isPlayerEliminated(newLossPoints, totalPlayerCount),
      };
    }
    return player;
  });

  newState.players = newPlayers;

  // Check if game is over
  if (isGameOver(newState.players)) {
    return handleGameEnd(newState);
  }

  return newState;
}

/**
 * Handles round end (regular case: one player has no cards left)
 */
function handleRoundEnd(state: GameState): GameState {
  const winnerId = getRoundWinner(state.players);
  if (!winnerId) {
    return state;
  }

  const newState = { ...state };
  newState.phase = "round_end";

  // Calculate loss points: Nur der Verlierer bekommt +1
  const lossPoints = calculateRoundLossPoints(newState.players, winnerId);

  // Update player loss points and check for elimination
  const totalPlayerCount = newState.players.length;
  const newPlayers = newState.players.map((player) => {
    if (lossPoints[player.id]) {
      const newLossPoints = player.lossPoints + lossPoints[player.id];
      return {
        ...player,
        lossPoints: newLossPoints,
        isEliminated: isPlayerEliminated(newLossPoints, totalPlayerCount),
      };
    }
    return player;
  });

  newState.players = newPlayers;

  // Check if game is over
  if (isGameOver(newState.players)) {
    return handleGameEnd(newState);
  }

  return newState;
}

/**
 * Handles game end
 */
function handleGameEnd(state: GameState): GameState {
  const winnerId = getGameWinner(state.players);
  if (!winnerId) {
    return state;
  }

  const newState = { ...state };
  newState.phase = "game_end";

  return newState;
}

/**
 * Handles ready action (for next round)
 */
function handleReady(state: GameState, playerId: number): GameState {
  if (state.phase !== "round_end") {
    throw new Error("Not in round end phase");
  }

  const newState = { ...state };
  const newPlayers = newState.players.map((player) => {
    if (player.id === playerId) {
      return { ...player, isReady: true };
    }
    return player;
  });

  newState.players = newPlayers;

  // Check if all players are ready
  const allReady = newPlayers.filter((p) => !p.isEliminated).every((p) => p.isReady);
  if (allReady) {
    return handleNextRound(newState);
  }

  return newState;
}

/**
 * Handles next round
 */
function handleNextRound(state: GameState): GameState {
  if (state.phase !== "round_end") {
    throw new Error("Not in round end phase");
  }

  const newState = { ...state };
  newState.roundNumber += 1;

  // Reset ready status
  const newPlayers = newState.players.map((player) => ({
    ...player,
    isReady: false,
  }));
  newState.players = newPlayers;

  return startNewRound(newState);
}

/**
 * Handles restarting the current round (host only)
 * Redeals cards without incrementing round number or changing dealer
 */
function handleRestartRound(state: GameState, playerId: number): GameState {
  if (state.phase !== "playing") {
    throw new Error("Can only restart during active play");
  }

  // Only host can restart
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.userId !== state.hostUserId) {
    throw new Error("Only the host can restart the round");
  }

  const newState = { ...state };

  // Reset ready status
  newState.players = newState.players.map((p) => ({
    ...p,
    isReady: false,
  }));

  return startNewRound(newState);
}

/**
 * Handles player leaving
 */
function handleLeaveGame(state: GameState, playerId: number): GameState {
  const newState = { ...state };
  const playerIndex = newState.players.findIndex((p) => p.id === playerId);
  const leavingPlayer = playerIndex >= 0 ? newState.players[playerIndex] : null;
  
  if (playerIndex === -1) {
    return state; // Player not found
  }
  
  const newPlayers = newState.players.filter((p) => p.id !== playerId);
  newState.players = newPlayers;

  // If host leaves, assign new host
  if (leavingPlayer && newState.hostUserId === leavingPlayer.userId && newPlayers.length > 0) {
    newState.hostUserId = newPlayers[0].userId;
  }
  
  // Adjust currentPlayerIndex if needed
  if (newPlayers.length > 0) {
    // If the leaving player was before or at currentPlayerIndex, shift it back
    if (playerIndex <= newState.currentPlayerIndex) {
      newState.currentPlayerIndex = Math.max(0, newState.currentPlayerIndex - 1);
    }
    // Clamp to valid range
    newState.currentPlayerIndex = Math.min(newState.currentPlayerIndex, newPlayers.length - 1);
    
    // Adjust dealerIndex if needed
    if (playerIndex <= newState.dealerIndex) {
      newState.dealerIndex = Math.max(0, newState.dealerIndex - 1);
    }
    // Clamp to valid range
    newState.dealerIndex = Math.min(newState.dealerIndex, newPlayers.length - 1);
  }

  // Check if game should end
  if (newPlayers.length < 2) {
    newState.phase = "game_end";
  }

  return newState;
}
