import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GameState, GameAction, Card } from "@/shared/game-types";

export interface ChatMessage {
  id: number;
  roomId: number;
  userId: number;
  username: string;
  message: string;
  createdAt: string;
}

export interface PreparationDraw {
  playerId: number;
  username: string;
  card: Card;
}

export interface PreparationData {
  seatDraws: PreparationDraw[];
  dealerDraws: PreparationDraw[];
}

export interface BlackbirdEvent {
  type: "ass" | "unter" | "draw_chain" | "winner" | "loser" | "round_start";
  playerName?: string;
  drawChainCount?: number;
  wishSuit?: string;
}

interface UseGameSocketOptions {
  onGameStateUpdate?: (state: GameState) => void;
  onPreparation?: (data: PreparationData) => void;
  onBlackbirdEvent?: (event: BlackbirdEvent) => void;
  onError?: (error: string) => void;
  onRoomCreated?: (data: { roomId: number; roomCode: string; maxPlayers: number }) => void;
}

export function useGameSocket(options: UseGameSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isChatOpenRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Callback-Refs: immer aktueller Callback, auch wenn useEffect-Closure eingefroren ist
  const onGameStateUpdateRef = useRef(options.onGameStateUpdate);
  const onPreparationRef = useRef(options.onPreparation);
  const onBlackbirdEventRef = useRef(options.onBlackbirdEvent);
  const onErrorRef = useRef(options.onError);
  const onRoomCreatedRef = useRef(options.onRoomCreated);
  useEffect(() => { onGameStateUpdateRef.current = options.onGameStateUpdate; }, [options.onGameStateUpdate]);
  useEffect(() => { onPreparationRef.current = options.onPreparation; }, [options.onPreparation]);
  useEffect(() => { onBlackbirdEventRef.current = options.onBlackbirdEvent; }, [options.onBlackbirdEvent]);
  useEffect(() => { onErrorRef.current = options.onError; }, [options.onError]);
  useEffect(() => { onRoomCreatedRef.current = options.onRoomCreated; }, [options.onRoomCreated]);

  useEffect(() => {
    // Connect to WebSocket server
    const backendUrl = process.env.EXPO_PUBLIC_API_URL || "https://crazyamsel.manus.space";
    console.log("[socket] Connecting to backend:", backendUrl);
    
    const socket = io(backendUrl, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", async () => {
      console.log("[socket] Connected to game server");
      setIsConnected(true);
      setIsReconnecting(false);
      reconnectAttempts.current = 0;
      
      // Try to reconnect to previous room
      const userIdStr = await AsyncStorage.getItem("currentUserId");
      if (userIdStr) {
        const userId = parseInt(userIdStr);
        console.log("[socket] Attempting to reconnect user:", userId);
        socket.emit("reconnect-room", { userId });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("[socket] Disconnected from game server:", reason);
      setIsConnected(false);
      
      // Auto-reconnect if disconnected unexpectedly
      if (reason === "io server disconnect") {
        // Server disconnected, don't auto-reconnect
        return;
      }
      
      if (reconnectAttempts.current < maxReconnectAttempts) {
        setIsReconnecting(true);
        const attempt = reconnectAttempts.current;
        reconnectAttempts.current++;
        
        // Exponential backoff: 2s, 4s, 8s, 16s, 32s
        const delay = Math.min(2000 * Math.pow(2, attempt), 32000);
        console.log(`[socket] Reconnect attempt ${attempt + 1}/${maxReconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
          if (socket.disconnected) {
            console.log("[socket] Attempting reconnect...");
            socket.connect();
          }
        }, delay);
      } else {
        console.log("[socket] Max reconnect attempts reached");
        onErrorRef.current?.("Verbindung verloren. Bitte App neu starten.");
      }
    });

    socket.on("game-state-update", (state: GameState) => {
      console.log("[socket] Game state updated", state);
      setGameState(state);
      onGameStateUpdateRef.current?.(state);
    });

    socket.on("game-preparation", (data: PreparationData) => {
      console.log("[socket] Game preparation data received", data);
      onPreparationRef.current?.(data);
    });

    socket.on("blackbird-event", (event: BlackbirdEvent) => {
      console.log("[socket] Blackbird event received:", event.type, event.playerName ?? "");
      onBlackbirdEventRef.current?.(event);
    });

    socket.on("chat:history", (messages: ChatMessage[]) => {
      setChatMessages(messages);
    });

    socket.on("chat:message", (msg: ChatMessage) => {
      setChatMessages(prev => [...prev, msg]);
      if (!isChatOpenRef.current) {
        setUnreadCount(prev => prev + 1);
      }
    });

    socket.on("room-created", (data: { roomId: number; roomCode: string; maxPlayers: number }) => {
      console.log("[socket] Room created:", data.roomCode);
      onRoomCreatedRef.current?.(data);
    });

    socket.on("error", async (data: { message: string }) => {
      // "No active session found" — try to rejoin via stored room data
      if (data.message === "No active session found") {
        console.log("[socket] No active session, trying to rejoin from stored data...");
        try {
          const roomCode = await AsyncStorage.getItem("currentRoomCode");
          const userIdStr = await AsyncStorage.getItem("currentUserId");
          const username = await AsyncStorage.getItem("currentUsername");
          
          if (roomCode && userIdStr && username) {
            const userId = parseInt(userIdStr);
            console.log("[socket] Auto-rejoining room:", roomCode, "as", username);
            socket.emit("join-room", { roomCode, userId, username });
          } else {
            console.log("[socket] No stored room data for auto-rejoin");
          }
        } catch (e) {
          console.error("[socket] Error during auto-rejoin:", e);
        }
        return;
      }
      
      // "Player not found in game" — also try to rejoin
      if (data.message === "Player not found in game") {
        console.log("[socket] Player not found, trying to rejoin...");
        try {
          const roomCode = await AsyncStorage.getItem("currentRoomCode");
          const userIdStr = await AsyncStorage.getItem("currentUserId");
          const username = await AsyncStorage.getItem("currentUsername");
          
          if (roomCode && userIdStr && username) {
            const userId = parseInt(userIdStr);
            console.log("[socket] Auto-rejoining room:", roomCode, "as", username);
            socket.emit("join-room", { roomCode, userId, username });
          }
        } catch (e) {
          console.error("[socket] Error during auto-rejoin:", e);
        }
        return;
      }
      
      console.error("[socket] Error:", data.message);
      onErrorRef.current?.(data.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createRoom = useCallback((userId: number, username: string, maxPlayers: number = 5) => {
    if (!socketRef.current) return;
    
    console.log("[socket] Creating room for user:", userId);
    socketRef.current.emit("create-room", { userId, username, maxPlayers });
  }, []);

  const joinRoom = useCallback((roomCode: string, userId: number, username: string) => {
    if (!socketRef.current) return;
    
    console.log("[socket] Joining room:", roomCode);
    socketRef.current.emit("join-room", { roomCode, userId, username });
    
    // Store for reconnect
    AsyncStorage.setItem("currentRoomCode", roomCode);
    AsyncStorage.setItem("currentUserId", userId.toString());
    AsyncStorage.setItem("currentUsername", username);
  }, []);

  const leaveRoom = useCallback((roomId: number, playerId: number) => {
    if (!socketRef.current) return;
    
    console.log("[socket] Leaving room:", roomId);
    socketRef.current.emit("leave-room", { roomId, playerId });
    
    // Clear reconnect data
    AsyncStorage.removeItem("currentRoomCode");
    AsyncStorage.removeItem("currentUserId");
    AsyncStorage.removeItem("currentUsername");
  }, []);

  const sendAction = useCallback((roomId: number, playerId: number, action: GameAction) => {
    if (!socketRef.current) {
      console.error("[socket] Cannot send action: not connected");
      return;
    }
    
    console.log("[socket] Sending action:", action);
    socketRef.current.emit("game-action", { roomId, playerId, action });
  }, []);

  const addBot = useCallback((roomId: number, userId: number) => {
    if (!socketRef.current) {
      console.error("[socket] Cannot add bot: not connected");
      return;
    }
    
    console.log("[socket] Adding bot to room:", roomId);
    socketRef.current.emit("add-bot", { roomId, userId });
  }, []);

  const sendChatMessage = useCallback((roomId: number, userId: number, username: string, message: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit("chat:send", { roomId, userId, username, message });
  }, []);

  const markChatRead = useCallback(() => {
    isChatOpenRef.current = true;
    setUnreadCount(0);
  }, []);

  const markChatClosed = useCallback(() => {
    isChatOpenRef.current = false;
  }, []);

  const sendPreparationDone = useCallback((roomId: number) => {
    if (!socketRef.current) return;
    socketRef.current.emit("preparation-done", { roomId });
  }, []);

  const closeAllRooms = useCallback((username: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit("admin:close-all-rooms", { username });
  }, []);

  return {
    isConnected,
    isReconnecting,
    gameState,
    chatMessages,
    unreadCount,
    createRoom,
    joinRoom,
    leaveRoom,
    sendAction,
    addBot,
    sendChatMessage,
    markChatRead,
    markChatClosed,
    sendPreparationDone,
    closeAllRooms,
  };
}
