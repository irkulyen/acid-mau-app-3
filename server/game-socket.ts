import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import type { GameState, GameAction, GameEvent, Player } from "../shared/game-types";
import type { SeatDrawResult } from "../shared/game-preparation";
import { createGameState, processAction, startGame } from "../shared/game-engine";
import { getPlayableCards, getEffectiveTopCard } from "../shared/game-rules";
import * as db from "./db";
import * as roomManager from "./room-manager";

// In-memory game state storage (in production, use Redis)
const gameStates = new Map<number, GameState>();
const roomSockets = new Map<number, Set<string>>();

// Session persistence: userId → roomId mapping
const userRoomMapping = new Map<number, number>();

// Socket → userId mapping (for per-player state filtering)
const socketUserMapping = new Map<string, number>();

// Disconnect timeouts: userId → timeout handle
const disconnectTimeouts = new Map<number, NodeJS.Timeout>();

// Active bot turn timeouts per room (to prevent double-scheduling)
const botTurnTimeouts = new Map<number, ReturnType<typeof setTimeout>>();

// Pending preparation data: roomId → { seatDraws, dealerDraws }
const pendingPreparation = new Map<number, { seatDraws: SeatDrawResult[]; dealerDraws: SeatDrawResult[] }>();

// Turn timeout: roomId → timeout handle (auto-action if player doesn't act)
const turnTimeouts = new Map<number, ReturnType<typeof setTimeout>>();

/**
 * Bot AI: Choose and execute a move for the current bot player.
 * Called automatically when it's a bot's turn.
 */
function scheduleBotTurn(io: SocketIOServer, roomId: number) {
  // Clear any existing bot timeout for this room
  const existing = botTurnTimeouts.get(roomId);
  if (existing) clearTimeout(existing);

  const delay = 1500 + Math.random() * 1500; // 1500-3000ms delay for natural feel
  const timeout = setTimeout(() => {
    botTurnTimeouts.delete(roomId);
    executeBotTurn(io, roomId);
  }, delay);
  botTurnTimeouts.set(roomId, timeout);
}

function executeBotTurn(io: SocketIOServer, roomId: number) {
  const state = gameStates.get(roomId);
  if (!state || state.phase !== "playing") return;

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.userId >= 0) return; // Not a bot
  if (currentPlayer.isEliminated || currentPlayer.hand.length === 0) return;

  try {
    const topCard = getEffectiveTopCard(state.discardPile);
    const playableCards = getPlayableCards(
      currentPlayer.hand,
      topCard,
      state.currentWishSuit,
      state.drawChainCount
    );

    let action: GameAction;

    if (playableCards.length > 0) {
      // Bot strategy: prefer non-special cards, save Unter/7 for later
      const normalCards = playableCards.filter(c => c.rank !== "bube" && c.rank !== "7");
      const chosen = normalCards.length > 0
        ? normalCards[Math.floor(Math.random() * normalCards.length)]
        : playableCards[Math.floor(Math.random() * playableCards.length)];

      if (chosen.rank === "bube") {
        // Bot picks the suit they have most of
        const suitCounts: Record<string, number> = {};
        currentPlayer.hand.forEach(c => {
          if (c.rank !== "bube") suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
        });
        const bestSuit = Object.entries(suitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "eichel";
        action = { type: "PLAY_CARD", cardId: chosen.id, wishSuit: bestSuit as any };
      } else {
        action = { type: "PLAY_CARD", cardId: chosen.id };
      }
    } else {
      action = { type: "DRAW_CARD" };
    }

    console.log(`[socket] Bot ${currentPlayer.username} plays: ${action.type}${action.type === "PLAY_CARD" ? ` (${(action as any).cardId})` : ""}`);

    const newState = processAction(state, action, currentPlayer.id);
    gameStates.set(roomId, newState);
    detectAndBroadcastBlackbirdEvents(io, roomId, state, newState);
    broadcastFilteredState(io, roomId, newState);

    // Check if next player is also a bot
    checkAndScheduleBotTurn(io, roomId, newState);

    // Handle round end if bot's move ended the round
    if (newState.phase === "round_end" && (state.phase as string) !== "round_end") {
      handleRoundEndBotReady(io, roomId, newState);
    }
  } catch (error: any) {
    console.error(`[socket] Bot ${currentPlayer.username} error:`, error.message);
  }
}

/**
 * After any state update, check if the current player is a bot and schedule their turn.
 * Also starts a turn timeout for human players who are disconnected.
 */
function checkAndScheduleBotTurn(io: SocketIOServer, roomId: number, state: GameState) {
  // Clear any existing turn timeout
  const existingTurnTimeout = turnTimeouts.get(roomId);
  if (existingTurnTimeout) {
    clearTimeout(existingTurnTimeout);
    turnTimeouts.delete(roomId);
  }

  if (state.phase !== "playing") return;
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.isEliminated) return;

  if (currentPlayer.userId < 0) {
    // Bot player: schedule bot turn
    scheduleBotTurn(io, roomId);
  } else {
    // Human player: check if they're connected
    scheduleDisconnectedPlayerTimeout(io, roomId, state, currentPlayer);
  }
}

/**
 * If the current human player is disconnected, auto-draw after 8 seconds.
 */
function scheduleDisconnectedPlayerTimeout(io: SocketIOServer, roomId: number, state: GameState, player: Player) {
  // Check if this player has an active socket
  const sockets = roomSockets.get(roomId);
  let playerConnected = false;
  if (sockets) {
    for (const socketId of sockets) {
      if (socketUserMapping.get(socketId) === player.userId) {
        playerConnected = true;
        break;
      }
    }
  }

  if (!playerConnected) {
    console.log(`[socket] Player ${player.username} (userId: ${player.userId}) is disconnected and it's their turn. Auto-draw in 8s.`);
    const timeout = setTimeout(() => {
      turnTimeouts.delete(roomId);
      const currentState = gameStates.get(roomId);
      if (!currentState || currentState.phase !== "playing") return;
      
      const currentTurnPlayer = currentState.players[currentState.currentPlayerIndex];
      if (!currentTurnPlayer || currentTurnPlayer.id !== player.id) return;

      // Check if still disconnected
      const currentSockets = roomSockets.get(roomId);
      let stillDisconnected = true;
      if (currentSockets) {
        for (const sid of currentSockets) {
          if (socketUserMapping.get(sid) === player.userId) {
            stillDisconnected = false;
            break;
          }
        }
      }

      if (stillDisconnected) {
        try {
          console.log(`[socket] Auto-drawing for disconnected player ${player.username}`);
          const newState = processAction(currentState, { type: "DRAW_CARD" }, player.id);
          gameStates.set(roomId, newState);
          // Auto-draw: Blackbird nur bei echten Spielereignissen (Ass, Unter, 7-Kette)
          // Kein loser/winner hier – Auto-Draw endet keine Runde durch Karten-Ausspielen
          detectAndBroadcastBlackbirdEvents(io, roomId, currentState, newState);
          broadcastFilteredState(io, roomId, newState);
          checkAndScheduleBotTurn(io, roomId, newState);

          if (newState.phase === "round_end" && (currentState.phase as string) !== "round_end") {
            handleRoundEndBotReady(io, roomId, newState);
          }
        } catch (error: any) {
          console.error(`[socket] Auto-draw error for ${player.username}:`, error.message);
        }
      }
    }, 8000);
    turnTimeouts.set(roomId, timeout);
  }
}

/**
 * Handle round end: Auto-READY bots and failsafe NEXT_ROUND.
 * Called after any state change that transitions to round_end.
 */
function handleRoundEndBotReady(io: SocketIOServer, roomId: number, newState: GameState) {
  if (newState.phase !== "round_end") return;

  console.log(`[socket] Round ${newState.roundNumber} ended in room ${roomId}`);

  // Bot-READY: Auto-READY für Bot-Spieler nach 300-800ms
  const botPlayers = newState.players.filter(p => !p.isEliminated && p.userId < 0 && !p.isReady);
  botPlayers.forEach((bot) => {
    const delay = 300 + Math.random() * 500;
    setTimeout(() => {
      const currentState = gameStates.get(roomId);
      if (currentState && currentState.phase === "round_end") {
        try {
          const updatedState = processAction(currentState, { type: "READY" }, bot.id);
          gameStates.set(roomId, updatedState);
          // Nur loser-Event senden wenn Phase gewechselt hat (letzter READY → NEXT_ROUND intern)
          if (updatedState.phase === "playing" && currentState.phase === "round_end") {
            detectAndBroadcastBlackbirdEvents(io, roomId, currentState, updatedState);
          }
          broadcastFilteredState(io, roomId, updatedState);
          console.log(`[socket] Bot ${bot.username} auto-READY in room ${roomId}`);
        } catch (error) {
          console.error(`[socket] Bot-READY error:`, error);
        }
      }
    }, delay);
  });

  // Auto-READY disconnected human players after 3 seconds
  const humanPlayers = newState.players.filter(p => !p.isEliminated && p.userId >= 0 && !p.isReady);
  humanPlayers.forEach((human) => {
    setTimeout(() => {
      const currentState = gameStates.get(roomId);
      if (!currentState || currentState.phase !== "round_end") return;

      // Check if player is still disconnected
      const sockets = roomSockets.get(roomId);
      let connected = false;
      if (sockets) {
        for (const sid of sockets) {
          if (socketUserMapping.get(sid) === human.userId) {
            connected = true;
            break;
          }
        }
      }

      if (!connected) {
        try {
          const player = currentState.players.find(p => p.id === human.id);
          if (player && !player.isReady) {
            const updatedState = processAction(currentState, { type: "READY" }, human.id);
            gameStates.set(roomId, updatedState);
            // Nur loser-Event senden wenn Phase gewechselt hat (letzter READY → NEXT_ROUND intern)
            if (updatedState.phase === "playing" && currentState.phase === "round_end") {
              detectAndBroadcastBlackbirdEvents(io, roomId, currentState, updatedState);
            }
            broadcastFilteredState(io, roomId, updatedState);
            console.log(`[socket] Auto-READY for disconnected player ${human.username} in room ${roomId}`);
          }
        } catch (error) {
          console.error(`[socket] Auto-READY error for disconnected player:`, error);
        }
      }
    }, 3000);
  });

  // Failsafe: Nach 5 Sekunden automatisch NEXT_ROUND
  setTimeout(() => {
    const currentState = gameStates.get(roomId);
    if (currentState && currentState.phase === "round_end") {
      const nonEliminated = currentState.players.filter(p => !p.isEliminated);
      const allReady = nonEliminated.every(p => p.isReady);

      if (allReady) {
        try {
          const updatedState = processAction(currentState, { type: "NEXT_ROUND" }, nonEliminated[0].id);
          gameStates.set(roomId, updatedState);
          // Failsafe: loser-Event nur senden wenn noch kein loser-Event gesendet wurde
          // (Normalfall: Bot-READY hat es bereits gesendet; Failsafe nur als Backup)
          detectAndBroadcastBlackbirdEvents(io, roomId, currentState, updatedState);
          broadcastFilteredState(io, roomId, updatedState);
          checkAndScheduleBotTurn(io, roomId, updatedState);
          console.log(`[socket] Failsafe triggered NEXT_ROUND in room ${roomId}`);
        } catch (error) {
          console.error(`[socket] Failsafe NEXT_ROUND error:`, error);
        }
      }
    }
  }, 5000);
}

/**
 * Filter game state for a specific player:
 * - Own hand: full card data
 * - Other players' hands: replaced with dummy cards (preserves hand.length)
 * - Deck: replaced with dummy cards (preserves deck.length)
 */
function filterStateForPlayer(state: GameState, userId: number): GameState {
  return {
    ...state,
    // Hide deck cards (no one should see the draw pile)
    deck: state.deck.map(() => ({ suit: "schellen" as const, rank: "7" as const, id: "hidden" })),
    // Filter player hands: only show own cards
    players: state.players.map((p) => {
      if (p.userId === userId) {
        return p; // Own hand: full data
      }
      return {
        ...p,
        hand: p.hand.map(() => ({ suit: "schellen" as const, rank: "7" as const, id: "hidden" })),
      };
    }),
  };
}

/**
 * Detect blackbird events by comparing old and new game state.
 * Sends events to all clients so they can show the animation.
 */
function detectAndBroadcastBlackbirdEvents(
  io: SocketIOServer,
  roomId: number,
  oldState: GameState,
  newState: GameState
) {
  const events: Array<{
    type: "ass" | "unter" | "draw_chain" | "winner" | "loser" | "round_start";
    playerName?: string;
    drawChainCount?: number;
    wishSuit?: string;
  }> = [];

  const oldDiscardLen = oldState.discardPile.length;
  const newDiscardLen = newState.discardPile.length;
  const newTopCard = newState.discardPile[newState.discardPile.length - 1];

  // New card was played
  if (newDiscardLen > oldDiscardLen && newTopCard) {
    // Detect Ass played
    if (newTopCard.rank === "ass") {
      events.push({ type: "ass" });
    }

    // Detect Unter (Bube) with wish suit
    if (newTopCard.rank === "bube" && newState.currentWishSuit) {
      events.push({ type: "unter", wishSuit: newState.currentWishSuit });
    }

    // Detect player finished (hand empty, not eliminated, still playing phase)
    if (newState.phase === "playing" || newState.phase === "round_end") {
      const finishedPlayer = newState.players.find(
        (p) => p.hand.length === 0 && !p.isEliminated
      );
      if (finishedPlayer) {
        // Check this player had cards before
        const oldPlayer = oldState.players.find((p) => p.id === finishedPlayer.id);
        if (oldPlayer && oldPlayer.hand.length > 0) {
          events.push({ type: "winner", playerName: finishedPlayer.username });
        }
      }
    }
  }

  // Detect 7er-Kette escalation (4+ cards in chain)
  if (newState.drawChainCount >= 4 && newState.drawChainCount > oldState.drawChainCount) {
    events.push({
      type: "draw_chain",
      drawChainCount: newState.drawChainCount * 2,
    });
  }

  // Detect round start (new round began)
  if (newState.phase === "playing" && oldState.phase === "round_end" && newState.roundNumber > oldState.roundNumber) {
    // Find the loser: player with biggest lossPoints increase this round
    let loserName = "";
    let maxIncrease = 0;
    for (const p of newState.players) {
      const oldP = oldState.players.find((op) => op.id === p.id);
      const increase = p.lossPoints - (oldP?.lossPoints ?? 0);
      if (increase > maxIncrease) {
        maxIncrease = increase;
        loserName = p.username;
      }
    }
    // Nur senden wenn tatsächlich jemand Punkte bekommen hat
    if (loserName) {
      events.push({ type: "loser", playerName: loserName });
    }
  }

  // Send all detected events to all clients
  for (const event of events) {
    io.to(`room-${roomId}`).emit("blackbird-event", event);
    console.log(`[socket] Blackbird event in room ${roomId}: ${event.type}${event.playerName ? ` (${event.playerName})` : ""}`);
  }
}

/**
 * Send filtered game state to each player in a room individually.
 * Each player only sees their own cards.
 */
function broadcastFilteredState(io: SocketIOServer, roomId: number, state: GameState) {
  const sockets = roomSockets.get(roomId);
  if (!sockets) return;

  for (const socketId of sockets) {
    const userId = socketUserMapping.get(socketId);
    const targetSocket = io.sockets.sockets.get(socketId);
    if (!targetSocket) continue;

    if (userId) {
      // Send filtered state for this specific player
      targetSocket.emit("game-state-update", filterStateForPlayer(state, userId));
    } else {
      // Fallback: send state with all hands hidden (spectator/unknown)
      targetSocket.emit("game-state-update", filterStateForPlayer(state, -999));
    }
  }
}

export function setupGameSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    path: "/api/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[socket] Client connected: ${socket.id}`);

    // Reconnect to a game room
    socket.on("reconnect-room", async (data: { userId: number }) => {
      try {
        const { userId } = data;

        // Track socket → user mapping
        socketUserMapping.set(socket.id, userId);

        // Check if user has an active session
        const roomId = userRoomMapping.get(userId);
        if (!roomId) {
          socket.emit("error", { message: "No active session found" });
          return;
        }

        // Check if game still exists
        const gameState = gameStates.get(roomId);
        if (!gameState) {
          userRoomMapping.delete(userId);
          socket.emit("error", { message: "Game no longer exists" });
          return;
        }

        // Cancel disconnect timeout
        const timeout = disconnectTimeouts.get(userId);
        if (timeout) {
          clearTimeout(timeout);
          disconnectTimeouts.delete(userId);
          console.log(`[socket] Cancelled disconnect timeout for user ${userId}`);
        }

        // Rejoin socket room
        socket.join(`room-${roomId}`);

        // Track socket in room
        if (!roomSockets.has(roomId)) {
          roomSockets.set(roomId, new Set());
        }
        roomSockets.get(roomId)!.add(socket.id);

        // If preparation is pending, send preparation data to reconnected player
        const prepData = pendingPreparation.get(roomId);
        if (prepData) {
          socket.emit("game-preparation", {
            seatDraws: prepData.seatDraws,
            dealerDraws: prepData.dealerDraws,
          });
          console.log(`[socket] Sent pending preparation data to reconnected user ${userId}`);
        }

        // Send filtered game state to reconnected player
        socket.emit("game-state-update", filterStateForPlayer(gameState, userId));

        // Send chat history
        try {
          const chatHistory = await db.getRoomChatMessages(roomId);
          socket.emit("chat:history", chatHistory);
        } catch (e) {
          console.error("[socket] Error sending chat history on reconnect:", e);
        }

        console.log(`[socket] User ${userId} reconnected to room ${roomId}`);

        // If it's this player's turn, clear any auto-draw timeout
        const currentTurnPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentTurnPlayer && currentTurnPlayer.userId === userId && gameState.phase === "playing") {
          const existingTurnTimeout = turnTimeouts.get(roomId);
          if (existingTurnTimeout) {
            clearTimeout(existingTurnTimeout);
            turnTimeouts.delete(roomId);
            console.log(`[socket] Cleared auto-draw timeout for reconnected player ${userId}`);
          }
        }
      } catch (error) {
        console.error("[socket] Error reconnecting:", error);
        socket.emit("error", { message: "Failed to reconnect" });
      }
    });

    // Create a new game room
    socket.on("create-room", async (data: { userId: number; username: string; maxPlayers?: number }) => {
      try {
        const { userId, username, maxPlayers = 5 } = data;

        // Track socket → user mapping
        socketUserMapping.set(socket.id, userId);

        // Generiere eindeutigen Room-Code
        let roomCode: string;
        let room = null;
        let attempts = 0;
        do {
          roomCode = roomManager.generateRoomCode();
          room = await roomManager.getRoomByCode(roomCode);
          attempts++;
        } while (room && attempts < 10);

        if (room) {
          socket.emit("error", { message: "Failed to generate unique room code" });
          return;
        }

        // Erstelle Raum
        const newRoom = await roomManager.createRoom({
          roomCode,
          hostUserId: userId,
          maxPlayers,
        });

        const roomId = newRoom.id;

        // Erstelle GameState
        const player: Player = {
          id: 1,
          userId,
          username,
          hand: [],
          lossPoints: 0,
          isEliminated: false,
          isReady: false,
        };

        const gameState = createGameState(roomId, roomCode, [player], userId);
        (gameState as any).maxPlayers = maxPlayers;
        gameStates.set(roomId, gameState);

        // Join socket room
        socket.join(`room-${roomId}`);

        // Track socket in room
        if (!roomSockets.has(roomId)) {
          roomSockets.set(roomId, new Set());
        }
        roomSockets.get(roomId)!.add(socket.id);

        // Track user → room mapping
        userRoomMapping.set(userId, roomId);

        // Sende Raum-Info und GameState
        socket.emit("room-created", {
          roomId,
          roomCode,
          maxPlayers,
        });

        broadcastFilteredState(io, roomId, gameState);

        console.log(`[socket] Room created: ${roomCode} (${roomId}) by ${username} (${userId})`);
      } catch (error) {
        console.error("[socket] Error creating room:", error);
        socket.emit("error", { message: "Failed to create room" });
      }
    });

    // Join a game room
    socket.on("join-room", async (data: { roomCode: string; userId: number; username: string }) => {
      try {
        const { roomCode, userId, username } = data;

        // Track socket → user mapping
        socketUserMapping.set(socket.id, userId);

        // Find or create room (with fallback)
        let room = await roomManager.getRoomByCode(roomCode);

        if (!room) {
          socket.emit("error", { message: "Room not found" });
          return;
        }

        const roomId = room.id;

        // Cancel any pending disconnect timeout for this user
        const pendingTimeout = disconnectTimeouts.get(userId);
        if (pendingTimeout) {
          clearTimeout(pendingTimeout);
          disconnectTimeouts.delete(userId);
          console.log(`[socket] Cancelled disconnect timeout for rejoining user ${userId}`);
        }

        // Check if game state exists
        let gameState = gameStates.get(roomId);

        if (!gameState) {
          // Create new game state
          const maxPlayers = room.maxPlayers || 5;
          const player: Player = {
            id: 1,
            userId,
            username,
            hand: [],
            lossPoints: 0,
            isEliminated: false,
            isReady: false,
          };

          gameState = createGameState(roomId, roomCode, [player], userId);
          (gameState as any).maxPlayers = maxPlayers;
          gameStates.set(roomId, gameState);
        } else {
          // Check if player already exists
          const existingPlayer = gameState.players.find((p) => p.userId === userId);

          if (!existingPlayer) {
            // Add new player
            if (gameState.phase !== "waiting") {
              socket.emit("error", { message: "Game already in progress" });
              return;
            }

            const maxPlayers = (gameState as any).maxPlayers || 5;
            if (gameState.players.length >= maxPlayers) {
              socket.emit("error", { message: "Room is full" });
              return;
            }

            const newPlayer: Player = {
              id: gameState.players.length + 1,
              userId,
              username,
              hand: [],
              lossPoints: 0,
              isEliminated: false,
              isReady: false,
            };

            gameState = {
              ...gameState,
              players: [...gameState.players, newPlayer],
            };
            gameStates.set(roomId, gameState);
          } else if (existingPlayer.username !== username && username) {
            // Update username if it changed (e.g. auto-rejoin used stale AsyncStorage value)
            gameState = {
              ...gameState,
              players: gameState.players.map(p =>
                p.userId === userId ? { ...p, username } : p
              ),
            };
            gameStates.set(roomId, gameState);
            console.log(`[socket] Updated username for user ${userId}: ${existingPlayer.username} -> ${username}`);
          }
        }

        // Join socket room
        socket.join(`room-${roomId}`);

        // Track socket in room
        if (!roomSockets.has(roomId)) {
          roomSockets.set(roomId, new Set());
        }
        roomSockets.get(roomId)!.add(socket.id);

        // Track user → room mapping for reconnect
        userRoomMapping.set(userId, roomId);

        // Send chat history
        try {
          const chatHistory = await db.getRoomChatMessages(roomId);
          socket.emit("chat:history", chatHistory);
        } catch (e) {
          console.error("[socket] Error sending chat history:", e);
        }

        // Broadcast updated state to all players
        broadcastFilteredState(io, roomId, gameState);

        console.log(`[socket] User ${username} (${userId}) joined room ${roomCode} (${roomId})`);
      } catch (error) {
        console.error("[socket] Error joining room:", error);
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // Add bot to room
    socket.on("add-bot", (data: { roomId: number; userId: number }) => {
      try {
        const { roomId, userId } = data;
        const gameState = gameStates.get(roomId);

        if (!gameState) {
          socket.emit("error", { message: "Game not found" });
          return;
        }

        if (gameState.hostUserId !== userId) {
          socket.emit("error", { message: "Only host can add bots" });
          return;
        }

        if (gameState.phase !== "waiting") {
          socket.emit("error", { message: "Can only add bots in waiting phase" });
          return;
        }

        const maxPlayers = (gameState as any).maxPlayers || 5;
        if (gameState.players.length >= maxPlayers) {
          socket.emit("error", { message: "Room is full" });
          return;
        }

        const botNumber = gameState.players.filter((p) => p.userId < 0).length + 1;
        const botNames = ["Alf", "Gizmo", "Yoda", "Pumuckl", "Gollum"];
        const botName = botNames[(botNumber - 1) % botNames.length];

        const bot: Player = {
          id: gameState.players.length + 1,
          userId: -botNumber,
          username: botName,
          hand: [],
          lossPoints: 0,
          isEliminated: false,
          isReady: true,
        };

        const updatedState = {
          ...gameState,
          players: [...gameState.players, bot],
        };

        gameStates.set(roomId, updatedState);
        broadcastFilteredState(io, roomId, updatedState);

        console.log(`[socket] Bot ${botName} added to room ${roomId}`);
      } catch (error) {
        console.error("[socket] Error adding bot:", error);
        socket.emit("error", { message: "Failed to add bot" });
      }
    });

    // Game action (play card, draw card, etc.)
    socket.on("game-action", async (data: { roomId: number; playerId: number; action: GameAction }) => {
      try {
        const { roomId, playerId, action } = data;
        const gameState = gameStates.get(roomId);

        if (!gameState) {
          socket.emit("error", { message: "Game not found" });
          return;
        }

        // Verify player exists
        const player = gameState.players.find((p) => p.id === playerId);
        if (!player) {
          socket.emit("error", { message: "Player not found in game" });
          return;
        }

        console.log(`[socket] Action from ${player.username}: ${action.type}`);

        const newState = processAction(gameState, action, playerId);

        // For START_GAME: extract preparation data and send it before game state
        if (action.type === "START_GAME" && (newState as any).__preparationData) {
          const prepData = (newState as any).__preparationData;
          delete (newState as any).__preparationData;
          
          // Send preparation event to all players in the room
          io.to(`room-${roomId}`).emit("game-preparation", {
            seatDraws: prepData.seatDraws,
            dealerDraws: prepData.dealerDraws,
          });
          
          // Store state but delay broadcasting until clients signal they're done with animation
          gameStates.set(roomId, newState);
          pendingPreparation.set(roomId, prepData);
          
          // Failsafe: broadcast state after 12 seconds regardless
          setTimeout(() => {
            if (pendingPreparation.has(roomId)) {
              pendingPreparation.delete(roomId);
              const currentState = gameStates.get(roomId);
              if (currentState) {
                broadcastFilteredState(io, roomId, currentState);
                checkAndScheduleBotTurn(io, roomId, currentState);
              }
              console.log(`[socket] Failsafe: broadcast game state after preparation timeout in room ${roomId}`);
            }
          }, 12000);
          return; // Don't broadcast state yet
        }

        gameStates.set(roomId, newState);

        // Detect and broadcast blackbird events
        // Bei READY: nur wenn Phase gewechselt hat (letzter READY → intern NEXT_ROUND)
        // Bei NEXT_ROUND: immer (expliziter Rundenstart)
        // Bei Spielaktionen (PLAY_CARD, DRAW_CARD): immer
        if (action.type === "READY") {
          // Nur loser-Event wenn Phase wirklich gewechselt hat
          if (newState.phase === "playing" && gameState.phase === "round_end") {
            detectAndBroadcastBlackbirdEvents(io, roomId, gameState, newState);
          }
        } else {
          detectAndBroadcastBlackbirdEvents(io, roomId, gameState, newState);
        }

        // Broadcast filtered state to all players
        broadcastFilteredState(io, roomId, newState);

        // Check if next player is a bot and schedule their turn
        checkAndScheduleBotTurn(io, roomId, newState);

        // Handle round end: Bot-READY + Failsafe
        if (newState.phase === "round_end" && gameState.phase !== "round_end") {
          handleRoundEndBotReady(io, roomId, newState);
        }

        // Handle game end
        if (newState.phase === "game_end") {
          console.log(`[socket] Game ${roomId} ended`);
          
          // Save stats for all human players (bots have negative userId)
          try {
            const winner = newState.players.find(p => !p.isEliminated);
            for (const player of newState.players) {
              // Skip bots (negative userId)
              if (player.userId < 0) continue;
              
              const won = winner ? player.id === winner.id : false;
              await db.updatePlayerStats(player.userId, won, player.lossPoints);
              console.log(`[socket] Stats saved for ${player.username} (userId: ${player.userId}): won=${won}, lossPoints=${player.lossPoints}`);
            }
            
            // Save game history
            try {
              await db.createGameHistory({
                roomId,
                winnerId: winner?.userId ?? 0,
                totalRounds: newState.roundNumber,
                durationSeconds: 0,
              });
              
              // Save participants
              for (const player of newState.players) {
                if (player.userId < 0) continue;
                await db.createGameParticipant({
                  gameHistoryId: roomId,
                  userId: player.userId,
                  finalPosition: player.isEliminated ? 0 : 1,
                  totalLossPoints: player.lossPoints,
                  cardsPlayed: 0,
                });
              }
            } catch (histErr) {
              console.error(`[socket] Failed to save game history:`, histErr);
            }
          } catch (statsErr) {
            console.error(`[socket] Failed to save player stats:`, statsErr);
          }
        }

        // Logging: round_end → playing
        if (newState.phase === "playing" && gameState.phase === "round_end") {
          const readyPlayers = newState.players.filter(p => !p.isEliminated);
          console.log(`[socket] Round ${newState.roundNumber} started in room ${roomId}`);
          console.log(`[socket] Players: ${readyPlayers.map(p => `${p.username} (ID: ${p.id})`).join(", ")}`);
        }
      } catch (error: any) {
        console.error("[socket] Error processing action:", error);
        socket.emit("error", { message: error.message || "Failed to process action" });
      }
    });

    // Leave room
    socket.on("leave-room", async (data: { roomId: number; playerId: number }) => {
      try {
        const { roomId } = data;

        // Resolve playerId from socket mapping
        const socketUserId = socketUserMapping.get(socket.id);

        socket.leave(`room-${roomId}`);

        // Remove socket from tracking
        const sockets = roomSockets.get(roomId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            roomSockets.delete(roomId);
            gameStates.delete(roomId);
          }
        }

        // Clean up socket → user mapping
        socketUserMapping.delete(socket.id);

        const gameState = gameStates.get(roomId);
        if (gameState && socketUserId) {
          const player = gameState.players.find(p => p.userId === socketUserId);
          if (player) {
            const newState = processAction(gameState, { type: "LEAVE_GAME" }, player.id);
            gameStates.set(roomId, newState);
            broadcastFilteredState(io, roomId, newState);
          }
        }

        // Clean up user → room mapping
        if (socketUserId) {
          userRoomMapping.delete(socketUserId);
        }

        console.log(`[socket] User ${socketUserId} left room ${roomId}`);
      } catch (error) {
        console.error("[socket] Error leaving room:", error);
      }
    });

    // Client signals preparation animation is done
    socket.on("preparation-done", (data: { roomId: number }) => {
      const { roomId } = data;
      if (pendingPreparation.has(roomId)) {
        pendingPreparation.delete(roomId);
        const currentState = gameStates.get(roomId);
        if (currentState) {
          broadcastFilteredState(io, roomId, currentState);
          checkAndScheduleBotTurn(io, roomId, currentState);
        }
        console.log(`[socket] Preparation done, broadcasting game state for room ${roomId}`);
      }
    });

    // Chat: send message
    socket.on("chat:send", async (data: { roomId: number; userId: number; username: string; message: string }) => {
      try {
        const { roomId, userId, username, message } = data;
        const trimmed = message.trim().slice(0, 200);
        if (!trimmed) return;

        // Persist to DB
        await db.saveChatMessage({ roomId, userId, username, message: trimmed });

        // Broadcast to all in room
        const chatMsg = {
          id: Date.now(),
          roomId,
          userId,
          username,
          message: trimmed,
          createdAt: new Date().toISOString(),
        };
        io.to(`room-${roomId}`).emit("chat:message", chatMsg);
        // Also emit to room:${roomId} for backwards compatibility
        io.to(`room:${roomId}`).emit("chat:message", chatMsg);
      } catch (error) {
        console.error("[socket] Error sending chat message:", error);
      }
    });

    // Admin: Close all rooms (Acid_King only)
    socket.on("admin:close-all-rooms", async (data: { username: string }) => {
      const { username } = data;
      if (username !== "Acid_King") {
        socket.emit("error", { message: "Keine Berechtigung" });
        return;
      }

      console.log(`[socket] ADMIN: ${username} closing all rooms`);
      let closedCount = 0;

      // Notify all players in all rooms
      for (const [roomId, state] of gameStates.entries()) {
        io.to(`room-${roomId}`).emit("room-closed", { message: "Raum wurde vom Admin geschlossen" });
        // Clean up bot timeouts
        const botTimeout = botTurnTimeouts.get(roomId);
        if (botTimeout) { clearTimeout(botTimeout); botTurnTimeouts.delete(roomId); }
        const turnTimeout = turnTimeouts.get(roomId);
        if (turnTimeout) { clearTimeout(turnTimeout); turnTimeouts.delete(roomId); }
        closedCount++;
      }

      // Clear all in-memory state
      gameStates.clear();
      pendingPreparation.clear();
      userRoomMapping.clear();

      // Clear all disconnect timeouts
      for (const [uid, timeout] of disconnectTimeouts.entries()) {
        clearTimeout(timeout);
      }
      disconnectTimeouts.clear();

      // Disconnect all sockets from rooms
      for (const [roomId, sockets] of roomSockets.entries()) {
        for (const sid of sockets) {
          const s = io.sockets.sockets.get(sid);
          if (s) s.leave(`room-${roomId}`);
          socketUserMapping.delete(sid);
        }
      }
      roomSockets.clear();

      // Delete all rooms from DB
      try {
        const database = await db.getDb();
        if (database) {
          const { gameRooms } = await import("../drizzle/schema");
          await database.delete(gameRooms);
          console.log(`[socket] ADMIN: All rooms deleted from DB`);
        }
      } catch (err) {
        console.error("[socket] ADMIN: Failed to delete rooms from DB:", err);
      }

      socket.emit("admin:rooms-closed", { count: closedCount });
      console.log(`[socket] ADMIN: ${closedCount} rooms closed`);
    });

    // Disconnect
    socket.on("disconnect", () => {
      console.log(`[socket] Client disconnected: ${socket.id}`);

      // Get userId from socket mapping
      const disconnectedUserId = socketUserMapping.get(socket.id);
      let disconnectedRoomId: number | undefined;

      // Clean up socket → user mapping
      socketUserMapping.delete(socket.id);

      // Find which room this socket belongs to
      for (const [roomId, sockets] of roomSockets.entries()) {
        if (sockets.has(socket.id)) {
          disconnectedRoomId = roomId;
          sockets.delete(socket.id);
          break;
        }
      }

      // If we found the user, set a 30-second timeout before removing them
      if (disconnectedUserId && disconnectedRoomId) {
        console.log(`[socket] User ${disconnectedUserId} disconnected from room ${disconnectedRoomId}, starting 30s timeout`);
        
        const roomId = disconnectedRoomId;

        // Check if it's this player's turn → schedule auto-draw
        const gameState = gameStates.get(roomId);
        if (gameState && gameState.phase === "playing") {
          const currentTurnPlayer = gameState.players[gameState.currentPlayerIndex];
          if (currentTurnPlayer && currentTurnPlayer.userId === disconnectedUserId) {
            scheduleDisconnectedPlayerTimeout(io, roomId, gameState, currentTurnPlayer);
          }
        }

        // Also handle if pending preparation and all human players disconnected
        if (pendingPreparation.has(roomId)) {
          // Check if any human players are still connected
          const sockets = roomSockets.get(roomId);
          let anyHumanConnected = false;
          if (sockets) {
            for (const sid of sockets) {
              const uid = socketUserMapping.get(sid);
              if (uid && uid >= 0) {
                anyHumanConnected = true;
                break;
              }
            }
          }
          if (!anyHumanConnected) {
            // No humans connected, resolve preparation immediately
            pendingPreparation.delete(roomId);
            const currentState = gameStates.get(roomId);
            if (currentState) {
              broadcastFilteredState(io, roomId, currentState);
              checkAndScheduleBotTurn(io, roomId, currentState);
            }
            console.log(`[socket] All humans disconnected during preparation, resolving immediately for room ${roomId}`);
          }
        }

        const timeout = setTimeout(() => {
          console.log(`[socket] Disconnect timeout expired for user ${disconnectedUserId}`);
          
          // Remove user from game
          const gameState = gameStates.get(roomId);
          if (gameState) {
            const player = gameState.players.find(p => p.userId === disconnectedUserId);
            if (player) {
              const newState = processAction(gameState, { type: "LEAVE_GAME" }, player.id);
              gameStates.set(roomId, newState);
              broadcastFilteredState(io, roomId, newState);
            }
          }

          // Clean up mappings
          userRoomMapping.delete(disconnectedUserId!);
          disconnectTimeouts.delete(disconnectedUserId!);
        }, 30000); // 30 seconds

        disconnectTimeouts.set(disconnectedUserId!, timeout as any);
      }

      // Clean up empty rooms
      if (disconnectedRoomId) {
        const sockets = roomSockets.get(disconnectedRoomId);
        if (sockets && sockets.size === 0) {
          console.log(`[socket] No more sockets in room ${disconnectedRoomId}, but keeping gameState for reconnect`);
        }
      }
    });
  });

  console.log("[socket] Game socket server initialized");
  return io;
}
