import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GameState, GameAction, Card } from "@/shared/game-types";
import { getApiBaseUrl } from "@/constants/oauth";

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

interface SocketContextValue {
  isConnected: boolean;
  gameState: GameState | null;
  chatMessages: ChatMessage[];
  unreadCount: number;
  socket: Socket | null;
  createRoom: (userId: number, username: string, maxPlayers?: number) => void;
  joinRoom: (roomCode: string, userId: number, username: string) => void;
  leaveRoom: (roomId: number, playerId: number) => void;
  sendAction: (roomId: number, playerId: number, action: GameAction) => void;
  addBot: (roomId: number, userId: number) => void;
  sendChatMessage: (roomId: number, userId: number, username: string, message: string) => void;
  markChatRead: () => void;
  markChatClosed: () => void;
  sendPreparationDone: (roomId: number) => void;
  closeAllRooms: (username: string) => void;
  setOnRoomCreated: (cb: ((data: { roomId: number; roomCode: string; maxPlayers: number }) => void) | null) => void;
  setOnPreparation: (cb: ((data: PreparationData) => void) | null) => void;
  setOnBlackbirdEvent: (cb: ((event: BlackbirdEvent) => void) | null) => void;
  setOnError: (cb: ((error: string) => void) | null) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const isChatOpenRef = useRef(false);

  // Callback refs – screens register their handlers
  const onRoomCreatedRef = useRef<((data: { roomId: number; roomCode: string; maxPlayers: number }) => void) | null>(null);
  const onPreparationRef = useRef<((data: PreparationData) => void) | null>(null);
  const onBlackbirdEventRef = useRef<((event: BlackbirdEvent) => void) | null>(null);
  const onErrorRef = useRef<((error: string) => void) | null>(null);

  const pendingJoinRef = useRef<string | null>(null);

  useEffect(() => {
    const backendUrl = getApiBaseUrl();
    console.log("[socket] Connecting globally to:", backendUrl);

    const socket = io(backendUrl, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", async () => {
      console.log("[socket] Connected");
      setIsConnected(true);

      // Try to reconnect to previous room
      const userIdStr = await AsyncStorage.getItem("currentUserId");
      if (userIdStr) {
        const userId = parseInt(userIdStr);
        console.log("[socket] Attempting to reconnect user:", userId);
        socket.emit("reconnect-room", { userId });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("[socket] Disconnected:", reason);
      setIsConnected(false);
    });

    socket.on("game-state-update", (state: GameState) => {
      setGameState(state);
    });

    socket.on("room-created", (data: { roomId: number; roomCode: string; maxPlayers: number }) => {
      console.log("[socket] Room created:", data.roomCode);
      onRoomCreatedRef.current?.(data);
    });

    socket.on("join-room-success", (data: { roomId: number; roomCode: string }) => {
      pendingJoinRef.current = null;
      AsyncStorage.setItem("currentRoomCode", data.roomCode);
      console.log("[socket] Join ACK:", data.roomCode, data.roomId);
    });

    socket.on("join-room-failed", (data: { reason: string }) => {
      pendingJoinRef.current = null;
      console.error("[socket] Join failed:", data.reason);
    });

    socket.on("game-preparation", (data: PreparationData) => {
      onPreparationRef.current?.(data);
    });

    socket.on("blackbird-event", (event: BlackbirdEvent) => {
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

    socket.on("error", async (data: { message: string }) => {
      if (data.message === "No active session found" || data.message === "Player not found in game") {
        try {
          const roomCode = await AsyncStorage.getItem("currentRoomCode");
          const userIdStr = await AsyncStorage.getItem("currentUserId");
          const username = await AsyncStorage.getItem("currentUsername");
          if (roomCode && userIdStr && username) {
            socket.emit("join-room", { roomCode, userId: parseInt(userIdStr), username });
          }
        } catch (e) {
          console.error("[socket] Auto-rejoin error:", e);
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
    socketRef.current?.emit("create-room", { userId, username, maxPlayers });
  }, []);

  const joinRoom = useCallback((roomCode: string, userId: number, username: string) => {
    const normalizedCode = roomCode.trim().toUpperCase();
    pendingJoinRef.current = normalizedCode;
    socketRef.current?.emit("join-room", { roomCode: normalizedCode, userId, username });
    AsyncStorage.setItem("currentUserId", userId.toString());
    AsyncStorage.setItem("currentUsername", username);
  }, []);

  const leaveRoom = useCallback((roomId: number, playerId: number) => {
    socketRef.current?.emit("leave-room", { roomId, playerId });
    AsyncStorage.removeItem("currentRoomCode");
    AsyncStorage.removeItem("currentUserId");
    AsyncStorage.removeItem("currentUsername");
  }, []);

  const sendAction = useCallback((roomId: number, playerId: number, action: GameAction) => {
    socketRef.current?.emit("game-action", { roomId, playerId, action });
  }, []);

  const addBot = useCallback((roomId: number, userId: number) => {
    socketRef.current?.emit("add-bot", { roomId, userId });
  }, []);

  const sendChatMessage = useCallback((roomId: number, userId: number, username: string, message: string) => {
    socketRef.current?.emit("chat:send", { roomId, userId, username, message });
  }, []);

  const markChatRead = useCallback(() => {
    isChatOpenRef.current = true;
    setUnreadCount(0);
  }, []);

  const markChatClosed = useCallback(() => {
    isChatOpenRef.current = false;
  }, []);

  const sendPreparationDone = useCallback((roomId: number) => {
    socketRef.current?.emit("preparation-done", { roomId });
  }, []);

  const closeAllRooms = useCallback((username: string) => {
    socketRef.current?.emit("admin:close-all-rooms", { username });
  }, []);

  const setOnRoomCreated = useCallback((cb: ((data: { roomId: number; roomCode: string; maxPlayers: number }) => void) | null) => {
    onRoomCreatedRef.current = cb;
  }, []);

  const setOnPreparation = useCallback((cb: ((data: PreparationData) => void) | null) => {
    onPreparationRef.current = cb;
  }, []);

  const setOnBlackbirdEvent = useCallback((cb: ((event: BlackbirdEvent) => void) | null) => {
    onBlackbirdEventRef.current = cb;
  }, []);

  const setOnError = useCallback((cb: ((error: string) => void) | null) => {
    onErrorRef.current = cb;
  }, []);

  return (
    <SocketContext.Provider value={{
      isConnected,
      gameState,
      chatMessages,
      unreadCount,
      socket: socketRef.current,
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
      setOnRoomCreated,
      setOnPreparation,
      setOnBlackbirdEvent,
      setOnError,
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}
