import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GameState, GameAction } from "@/shared/game-types";
import type {
  BlackbirdEvent,
  CardPlayFxEvent,
  DrawCardFxEvent,
  GameFxEvent,
  ReactionEmoji,
  ReactionEvent,
  ChatMessage,
  PreparationData,
  RoomCreatedPayload,
  RoomJoinedPayload,
} from "@/shared/socket-contract";
export type {
  BlackbirdEvent,
  CardPlayFxEvent,
  DrawCardFxEvent,
  GameFxEvent,
  ReactionEmoji,
  ReactionEvent,
  ChatMessage,
  PreparationData,
  RoomCreatedPayload,
  RoomJoinedPayload,
} from "@/shared/socket-contract";
import * as Auth from "@/lib/_core/auth";
import { AppState, type AppStateStatus } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";

interface SocketContextValue {
  isConnected: boolean;
  gameState: GameState | null;
  chatMessages: ChatMessage[];
  unreadCount: number;
  socket: Socket | null;
  createRoom: (userId: number, username: string, maxPlayers?: number, isPrivate?: boolean) => void;
  joinRoom: (roomCode: string, userId: number, username: string) => void;
  leaveRoom: (roomId: number, playerId: number) => void;
  sendAction: (roomId: number, playerId: number, action: GameAction) => void;
  addBot: (roomId: number, userId: number) => void;
  sendChatMessage: (roomId: number, userId: number, username: string, message: string) => void;
  sendReaction: (roomId: number, emoji: ReactionEmoji, targetUserId?: number) => void;
  markChatRead: () => void;
  markChatClosed: () => void;
  sendPreparationDone: (roomId: number) => void;
  chooseSeat: (roomId: number, seatPosition: number, userId?: number) => void;
  closeAllRooms: (username: string) => void;
  closeEmptyRooms: (username: string) => void;
  recoverSession: () => Promise<void>;
  setOnRoomCreated: (cb: ((data: RoomCreatedPayload) => void) | null) => void;
  setOnRoomJoined: (cb: ((data: RoomJoinedPayload) => void) | null) => void;
  setOnPreparation: (cb: ((data: PreparationData) => void) | null) => void;
  setOnBlackbirdEvent: (cb: ((event: BlackbirdEvent) => void) | null) => void;
  setOnCardPlayFx: (cb: ((event: CardPlayFxEvent) => void) | null) => void;
  setOnDrawCardFx: (cb: ((event: DrawCardFxEvent) => void) | null) => void;
  setOnGameFx: (cb: ((event: GameFxEvent) => void) | null) => void;
  setOnReactionEvent: (cb: ((event: ReactionEvent) => void) | null) => void;
  setOnError: (cb: ((error: string) => void) | null) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);
const STORAGE_KEYS = {
  roomCode: "currentRoomCode",
  roomId: "currentRoomId",
  playerId: "currentPlayerId",
  userId: "currentUserId",
  username: "currentUsername",
} as const;

const parsePositiveInt = (raw: string | null | undefined): number | null => {
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

type JoinFlowSource = "manual" | "retry" | "recover-fallback" | "self-heal" | "server-error-retry";

type JoinInFlight = {
  roomCode: string;
  userId: number;
  username: string;
  source: JoinFlowSource;
  sentAt: number;
  attempts: number;
};

export function SocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const isChatOpenRef = useRef(false);

  // Callback refs – screens register their handlers
  const onRoomCreatedRef = useRef<((data: RoomCreatedPayload) => void) | null>(null);
  const onRoomJoinedRef = useRef<((data: RoomJoinedPayload) => void) | null>(null);
  const onPreparationRef = useRef<((data: PreparationData) => void) | null>(null);
  const onBlackbirdEventRef = useRef<((event: BlackbirdEvent) => void) | null>(null);
  const onCardPlayFxRef = useRef<((event: CardPlayFxEvent) => void) | null>(null);
  const onDrawCardFxRef = useRef<((event: DrawCardFxEvent) => void) | null>(null);
  const onGameFxRef = useRef<((event: GameFxEvent) => void) | null>(null);
  const onReactionEventRef = useRef<((event: ReactionEvent) => void) | null>(null);
  const onErrorRef = useRef<((error: string) => void) | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const gameStateRef = useRef<GameState | null>(null);
  const recoveringRef = useRef(false);
  const lastStateUpdateAtRef = useRef(0);
  const recoverStartedAtRef = useRef(0);
  const recoverAttemptRef = useRef(0);
  const recoverBlockedUntilRef = useRef(0);
  const recoverFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMembershipRecoverAtRef = useRef(0);
  const lastNoStateRecoverAtRef = useRef(0);
  const lastServerErrorRef = useRef<{ message: string; at: number }>({ message: "", at: 0 });
  const hasEverConnectedRef = useRef(false);
  const lastConnectErrorRef = useRef<{ message: string; at: number }>({ message: "", at: 0 });
  const lastAvatarLogKeyRef = useRef("");
  const joinInFlightRef = useRef<JoinInFlight | null>(null);
  const lastJoinEmitRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  const reconnectInFlightRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  const normalizeRoomCode = useCallback((value: string | null | undefined) => {
    if (!value) return null;
    const normalized = value.trim().toUpperCase();
    return /^[A-Z0-9]{6}$/.test(normalized) ? normalized : null;
  }, []);
  const classifyConnectError = useCallback((rawMessage: string, backendUrl: string, socketPath: string) => {
    const msg = (rawMessage || "").toLowerCase();
    if (msg.includes("origin not allowed by cors")) {
      return `Socket-Verbindung blockiert (CORS). Prüfe CORS_ALLOWED_ORIGINS für ${backendUrl} und Socket-Pfad ${socketPath}.`;
    }
    if (
      msg.includes("xhr poll error") ||
      msg.includes("websocket error") ||
      msg.includes("network error") ||
      msg.includes("timeout")
    ) {
      return `Server nicht erreichbar unter ${backendUrl}${socketPath}. Prüfe EXPO_PUBLIC_API_URL, Domain/Port und HTTPS.`;
    }
    if (msg.includes("unauthorized")) {
      return "Socket-Authentifizierung fehlgeschlagen. Bitte neu einloggen.";
    }
    return `Socket-Verbindung fehlgeschlagen: ${rawMessage || "unbekannter Fehler"}`;
  }, []);
  const isExpectedMoveValidationError = useCallback((message: string) => {
    const normalized = (message || "").toLowerCase();
    return (
      normalized.includes("karte passt nicht") ||
      normalized.includes("gleiche farbe oder rang erforderlich") ||
      normalized.includes("ungültiger zug") ||
      normalized.includes("ungueltiger zug") ||
      normalized.includes("invalid move") ||
      normalized.includes("not playable")
    );
  }, []);
  const isExpectedRoomFlowError = useCallback((message: string) => {
    const normalized = (message || "").toLowerCase();
    return (
      normalized.includes("failed to create room") ||
      normalized.includes("session temporarily unavailable") ||
      normalized.includes("room not found") ||
      normalized.includes("invalid room code") ||
      normalized.includes("room is full") ||
      normalized.includes("game already in progress") ||
      normalized.includes("game already started") ||
      normalized.includes("user already has an active room session") ||
      normalized.includes("user already in another active room") ||
      normalized.includes("too many join attempts") ||
      normalized.includes("too many room create attempts")
    );
  }, []);
  const emitErrorDeduped = useCallback((message: string) => {
    const now = Date.now();
    if (
      lastServerErrorRef.current.message === message &&
      now - lastServerErrorRef.current.at < 1200
    ) {
      return;
    }
    lastServerErrorRef.current = { message, at: now };
    onErrorRef.current?.(message);
  }, []);
  const persistSessionHints = useCallback((data: {
    roomCode?: string | null;
    roomId?: number | null;
    playerId?: number | null;
    userId?: number | null;
    username?: string | null;
  }) => {
    const pairs: Array<[string, string]> = [];
    if (typeof data.roomCode === "string" && data.roomCode) {
      pairs.push([STORAGE_KEYS.roomCode, data.roomCode]);
    }
    if (typeof data.roomId === "number" && Number.isInteger(data.roomId) && data.roomId > 0) {
      pairs.push([STORAGE_KEYS.roomId, data.roomId.toString()]);
    }
    if (typeof data.playerId === "number" && Number.isInteger(data.playerId) && data.playerId > 0) {
      pairs.push([STORAGE_KEYS.playerId, data.playerId.toString()]);
    }
    if (typeof data.userId === "number" && Number.isInteger(data.userId) && data.userId > 0) {
      pairs.push([STORAGE_KEYS.userId, data.userId.toString()]);
    }
    if (typeof data.username === "string" && data.username.trim().length >= 1) {
      pairs.push([STORAGE_KEYS.username, data.username]);
    }
    if (pairs.length === 0) return;
    void AsyncStorage.multiSet(pairs).catch((error) => {
      console.warn("[socket] Failed to persist session hints:", error);
    });
  }, []);

  const clearJoinInFlight = useCallback((reason: string) => {
    const current = joinInFlightRef.current;
    if (!current) return;
    console.log(
      `[socket] join-flow cleared (${reason}) roomCode=${current.roomCode} userId=${current.userId} source=${current.source}`,
    );
    joinInFlightRef.current = null;
  }, []);

  const emitJoinRoomGuarded = useCallback((args: {
    roomCode: string;
    userId: number;
    username: string;
    source: JoinFlowSource;
  }): boolean => {
    const socket = socketRef.current;
    if (!socket) return false;
    const normalizedRoomCode = normalizeRoomCode(args.roomCode);
    if (!normalizedRoomCode) return false;

    const now = Date.now();
    const key = `${normalizedRoomCode}:${args.userId}:${args.username}`;
    if (lastJoinEmitRef.current.key === key && now - lastJoinEmitRef.current.at < 850) {
      console.log(
        `[socket] join-room suppressed (burst) roomCode=${normalizedRoomCode} userId=${args.userId} source=${args.source}`,
      );
      return false;
    }

    const inFlight = joinInFlightRef.current;
    if (
      inFlight &&
      inFlight.roomCode === normalizedRoomCode &&
      inFlight.userId === args.userId &&
      now - inFlight.sentAt < 1800
    ) {
      console.log(
        `[socket] join-room suppressed (in-flight) roomCode=${normalizedRoomCode} userId=${args.userId} source=${args.source}`,
      );
      return false;
    }

    const attempts =
      inFlight && inFlight.roomCode === normalizedRoomCode && inFlight.userId === args.userId
        ? inFlight.attempts + 1
        : 1;

    joinInFlightRef.current = {
      roomCode: normalizedRoomCode,
      userId: args.userId,
      username: args.username,
      source: args.source,
      sentAt: now,
      attempts,
    };
    lastJoinEmitRef.current = { key, at: now };
    console.log(
      `[socket] join-room sent roomCode=${normalizedRoomCode} userId=${args.userId} source=${args.source} attempt=${attempts}`,
    );
    socket.emit("join-room", { roomCode: normalizedRoomCode, userId: args.userId, username: args.username });
    return true;
  }, [normalizeRoomCode]);

  const emitReconnectRoomGuarded = useCallback((args: {
    userId: number;
    roomCode?: string;
    roomId?: number;
    playerId?: number;
    username?: string;
  }): boolean => {
    const socket = socketRef.current;
    if (!socket) return false;
    const normalizedRoomCode = normalizeRoomCode(args.roomCode);
    const key = `${args.userId}:${normalizedRoomCode || "-"}:${args.roomId || "-"}:${args.playerId || "-"}`;
    const now = Date.now();
    if (reconnectInFlightRef.current.key === key && now - reconnectInFlightRef.current.at < 1300) {
      console.log(`[socket] reconnect-room suppressed (burst) key=${key}`);
      return false;
    }
    reconnectInFlightRef.current = { key, at: now };
    console.log(
      `[socket] reconnect-room sent userId=${args.userId} roomCode=${normalizedRoomCode || "-"} roomId=${args.roomId || "-"} playerId=${args.playerId || "-"}`,
    );
    socket.emit("reconnect-room", {
      userId: args.userId,
      roomCode: normalizedRoomCode ?? undefined,
      roomId: args.roomId,
      playerId: args.playerId,
      username: args.username,
    });
    return true;
  }, [normalizeRoomCode]);

  const recoverSessionOnSocket = useCallback(async (socket: Socket | null) => {
    if (!socket || recoveringRef.current) return;
    const now = Date.now();
    if (recoverBlockedUntilRef.current > now) return;
    if (recoverStartedAtRef.current > 0 && now - recoverStartedAtRef.current > 30_000) {
      recoverAttemptRef.current = 0;
      recoverStartedAtRef.current = 0;
    }
    if (recoverAttemptRef.current >= 3) return;
    recoveringRef.current = true;
    try {
      const values = await AsyncStorage.multiGet([
        STORAGE_KEYS.roomCode,
        STORAGE_KEYS.roomId,
        STORAGE_KEYS.playerId,
        STORAGE_KEYS.userId,
        STORAGE_KEYS.username,
      ]);
      const map = new Map(values);
      const normalizedRoomCode = normalizeRoomCode(map.get(STORAGE_KEYS.roomCode));
      const userId = parsePositiveInt(map.get(STORAGE_KEYS.userId));
      const username = (map.get(STORAGE_KEYS.username) || "").trim() || undefined;
      let roomId = parsePositiveInt(map.get(STORAGE_KEYS.roomId));
      let playerId = parsePositiveInt(map.get(STORAGE_KEYS.playerId));

      const currentGameState = gameStateRef.current;
      if (userId && currentGameState) {
        const self = currentGameState.players.find((p) => p.userId === userId);
        if (self) {
          roomId = roomId ?? currentGameState.roomId;
          playerId = playerId ?? self.id;
        }
      }

      const hasRecoverHint = Boolean(normalizedRoomCode || roomId || playerId);
      if (userId && hasRecoverHint) {
        if (!recoverStartedAtRef.current) recoverStartedAtRef.current = Date.now();
        recoverAttemptRef.current += 1;
        const attempt = recoverAttemptRef.current;
        emitReconnectRoomGuarded({
          userId,
          roomCode: normalizedRoomCode ?? undefined,
          roomId: roomId ?? undefined,
          playerId: playerId ?? undefined,
          username: username ?? undefined,
        });

        // Fallback reconnect retry only if reconnect did not produce a fresh state update.
        // Keep server authoritative for membership recovery (avoid client-side join fallback races).
        if (recoverFallbackTimerRef.current) clearTimeout(recoverFallbackTimerRef.current);
        if (normalizedRoomCode) {
          recoverFallbackTimerRef.current = setTimeout(() => {
            const staleSinceRecover = lastStateUpdateAtRef.current < recoverStartedAtRef.current;
            if (attempt !== recoverAttemptRef.current) return;
            if (!socket.connected) return;
            if (!staleSinceRecover) return;
            emitReconnectRoomGuarded({
              userId,
              roomCode: normalizedRoomCode,
              roomId: roomId ?? undefined,
              playerId: playerId ?? undefined,
              username: username ?? undefined,
            });
          }, 1400);
        }
      }
    } finally {
      recoveringRef.current = false;
    }
  }, [emitReconnectRoomGuarded, normalizeRoomCode]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    let socket: Socket | null = null;
    let mounted = true;

    const initSocket = async () => {
      const backendUrl = getApiBaseUrl();
      const socketPath = process.env.EXPO_PUBLIC_SOCKET_PATH || "/api/socket.io";
      const token = await Auth.getSessionToken();
      if (!mounted) return;

      console.log("[socket] Connecting globally to:", backendUrl, "path:", socketPath);
      socket = io(backendUrl, {
        path: socketPath,
        // WebSocket-first avoids frequent mobile tunnel/proxy polling failures (xhr poll error).
        transports: ["websocket", "polling"],
        auth: token ? { token } : undefined,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
      });

      socketRef.current = socket;

      socket.on("connect", async () => {
        console.log("[socket] Connected");
        hasEverConnectedRef.current = true;
        setIsConnected(true);
        await recoverSessionOnSocket(socket);
      });

      socket.on("disconnect", (reason) => {
        console.log("[socket] Disconnected:", reason);
        setIsConnected(false);
        clearJoinInFlight("disconnect");
        // Let socket.io reconnection strategy handle reconnects deterministically.
      });

      socket.on("connect_error", (err) => {
        const rawMessage = err?.message || String(err);
        console.warn("[socket] connect_error:", rawMessage);
        const now = Date.now();
        if (hasEverConnectedRef.current) return;
        const prettyMessage = classifyConnectError(rawMessage, backendUrl, socketPath);
        const duplicateRecent =
          lastConnectErrorRef.current.message === prettyMessage &&
          now - lastConnectErrorRef.current.at < 4000;
        if (duplicateRecent) return;
        lastConnectErrorRef.current = { message: prettyMessage, at: now };
        onErrorRef.current?.(prettyMessage);
      });

      socket.on("game-state-update", (state: GameState) => {
        lastStateUpdateAtRef.current = Date.now();
        recoverAttemptRef.current = 0;
        recoverStartedAtRef.current = 0;
        recoverBlockedUntilRef.current = 0;
        if (__DEV__) {
          const avatarKey = `${state.roomId}:${state.players
            .map((p) => `${p.userId}:${p.avatarUrl ?? "-"}`)
            .join("|")}`;
          if (avatarKey !== lastAvatarLogKeyRef.current) {
            lastAvatarLogKeyRef.current = avatarKey;
            console.log("[socket] avatar payload", {
              roomId: state.roomId,
              players: state.players.map((p) => ({
                userId: p.userId,
                username: p.username,
                hasAvatarUrl: Boolean(p.avatarUrl),
                avatarUrl: p.avatarUrl ?? null,
                isBot: p.userId < 0,
              })),
            });
          }
        }
        setGameState(state);
        // Self-heal: if local user is missing from room state, request a targeted rejoin.
        void (async () => {
          const now = Date.now();
          if (now - lastMembershipRecoverAtRef.current < 3000) return;
          const values = await AsyncStorage.multiGet([
            STORAGE_KEYS.roomCode,
            STORAGE_KEYS.userId,
            STORAGE_KEYS.username,
          ]);
          const map = new Map(values);
          const normalizedRoomCode = normalizeRoomCode(map.get(STORAGE_KEYS.roomCode));
          const userIdStr = map.get(STORAGE_KEYS.userId);
          const username = map.get(STORAGE_KEYS.username);
          if (!normalizedRoomCode || !userIdStr || !username) return;
          const userId = parseInt(userIdStr, 10);
          if (Number.isNaN(userId)) return;
          const self = state.players.find((p) => p.userId === userId);
          if (self) {
            persistSessionHints({
              roomCode: state.roomCode.toUpperCase(),
              roomId: state.roomId,
              playerId: self.id,
              userId,
              username: self.username || username,
            });
          }
          if (state.roomCode.toUpperCase() !== normalizedRoomCode) return;
          const isMember = state.players.some((p) => p.userId === userId);
          if (!isMember && socket?.connected) {
            lastMembershipRecoverAtRef.current = now;
            emitReconnectRoomGuarded({
              userId,
              roomCode: normalizedRoomCode,
              roomId: state.roomId,
              username,
            });
          }
        })();
      });

      socket.on("room-created", (data: RoomCreatedPayload) => {
        console.log("[socket] Room created:", data.roomCode);
        recoverAttemptRef.current = 0;
        recoverStartedAtRef.current = 0;
        recoverBlockedUntilRef.current = 0;
        reconnectInFlightRef.current = { key: "", at: 0 };
        clearJoinInFlight("room-created");
        persistSessionHints({ roomCode: data.roomCode.toUpperCase(), roomId: data.roomId });
        onRoomCreatedRef.current?.(data);
      });

      socket.on("room-joined", (data: RoomJoinedPayload) => {
        console.log("[socket] Room joined:", data.roomCode);
        recoverAttemptRef.current = 0;
        recoverStartedAtRef.current = 0;
        recoverBlockedUntilRef.current = 0;
        reconnectInFlightRef.current = { key: "", at: 0 };
        clearJoinInFlight("room-joined");
        persistSessionHints({ roomCode: data.roomCode.toUpperCase(), roomId: data.roomId });
        onRoomJoinedRef.current?.(data);
      });

      socket.on("join-failed", (data: { message: string; code?: string }) => {
        const message = data?.message || "Failed to join room";
        console.warn("[socket] join-failed:", data?.code || "UNKNOWN", message);
        const inFlight = joinInFlightRef.current;
        const source = inFlight?.source;
        const isUserInitiated = source === "manual" || source === "retry";
        const isAutoRecoverSource =
          source === "recover-fallback" ||
          source === "server-error-retry" ||
          source === "self-heal";
        clearJoinInFlight(`join-failed:${data?.code || "UNKNOWN"}`);
        if (data?.code === "ROOM_NOT_FOUND") {
          // Stale local room hints can cause endless auto-rejoin loops after server restarts.
          // Clear them immediately when the server confirms the room no longer exists.
          void AsyncStorage.multiRemove([
            STORAGE_KEYS.roomCode,
            STORAGE_KEYS.roomId,
            STORAGE_KEYS.playerId,
          ]);
          setGameState(null);
          // Show only when user explicitly initiated the join flow.
          if (isUserInitiated) {
            emitErrorDeduped(message);
          }
          return;
        }
        if (/temporarily unavailable/i.test(message) && isAutoRecoverSource) {
          // Auto-recovery should not trap the user in stale-room loops.
          // Clear room hints and stay silent; manual user actions can start a fresh join/create.
          void AsyncStorage.multiRemove([
            STORAGE_KEYS.roomCode,
            STORAGE_KEYS.roomId,
            STORAGE_KEYS.playerId,
          ]);
          setGameState(null);
          return;
        }
        emitErrorDeduped(message);
      });

      socket.on("game-preparation", (data: PreparationData) => {
        onPreparationRef.current?.(data);
      });

      socket.on("blackbird-event", (event: BlackbirdEvent) => {
        onBlackbirdEventRef.current?.(event);
      });
      socket.on("card-play-fx", (event: CardPlayFxEvent) => {
        onCardPlayFxRef.current?.(event);
      });
      socket.on("draw-card-fx", (event: DrawCardFxEvent) => {
        onDrawCardFxRef.current?.(event);
      });
      socket.on("game-fx", (event: GameFxEvent) => {
        onGameFxRef.current?.(event);
      });
      socket.on("reaction:event", (event: ReactionEvent) => {
        onReactionEventRef.current?.(event);
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
        const normalizedMessage = (data.message || "").trim().toLowerCase();
        const inRecoverWindow = Date.now() - recoverStartedAtRef.current < 5000;
        if (inRecoverWindow && normalizedMessage === "game already in progress") {
          // Harmless during recovery fallback; keep silent to avoid false alarm popup.
          return;
        }
        if (normalizedMessage === "game already started") {
          // Duplicate START_GAME action can happen on laggy mobile taps/reconnects.
          // Treat as idempotent and force a session refresh instead of showing a blocking popup.
          await recoverSessionOnSocket(socket);
          return;
        }
        if (isExpectedMoveValidationError(data.message)) {
          // Expected in race conditions between optimistic UI interaction and authoritative server rules.
          // Keep this non-blocking and rely on next state update instead of showing disruptive alerts.
          return;
        }
        if (data.message === "No active session found" || data.message === "Player not found in game") {
          try {
            const values = await AsyncStorage.multiGet([
              STORAGE_KEYS.roomCode,
              STORAGE_KEYS.roomId,
              STORAGE_KEYS.playerId,
              STORAGE_KEYS.userId,
              STORAGE_KEYS.username,
            ]);
            const map = new Map(values);
            const roomCode = map.get(STORAGE_KEYS.roomCode);
            const userIdStr = map.get(STORAGE_KEYS.userId);
            const username = map.get(STORAGE_KEYS.username);
            const roomId = parsePositiveInt(map.get(STORAGE_KEYS.roomId));
            const playerId = parsePositiveInt(map.get(STORAGE_KEYS.playerId));
            const normalizedRoomCode = normalizeRoomCode(roomCode);
            if (normalizedRoomCode && userIdStr && username) {
              emitReconnectRoomGuarded({
                userId: parseInt(userIdStr, 10),
                roomCode: normalizedRoomCode,
                roomId: roomId ?? undefined,
                playerId: playerId ?? undefined,
                username,
              });
            }
          } catch (e) {
            console.error("[socket] Auto-reconnect error:", e);
          }
          return;
        }
        if (/temporarily unavailable/i.test(normalizedMessage)) {
          try {
            const hasActiveRoomState = Boolean(gameStateRef.current);
            const source = joinInFlightRef.current?.source;
            const isAutoRecoverSource =
              source === "recover-fallback" ||
              source === "server-error-retry" ||
              source === "self-heal";
            if (!hasActiveRoomState && (inRecoverWindow || isAutoRecoverSource)) {
              // Stale reconnect hints after app/server restarts: stop auto-retry loop.
              await AsyncStorage.multiRemove([
                STORAGE_KEYS.roomCode,
                STORAGE_KEYS.roomId,
                STORAGE_KEYS.playerId,
              ]);
              recoverAttemptRef.current = 0;
              recoverStartedAtRef.current = 0;
              recoverBlockedUntilRef.current = Date.now() + 10_000;
              if (recoverFallbackTimerRef.current) {
                clearTimeout(recoverFallbackTimerRef.current);
                recoverFallbackTimerRef.current = null;
              }
              clearJoinInFlight("stale-temporary-unavailable");
              return;
            }
            const values = await AsyncStorage.multiGet([
              STORAGE_KEYS.roomCode,
              STORAGE_KEYS.roomId,
              STORAGE_KEYS.playerId,
              STORAGE_KEYS.userId,
              STORAGE_KEYS.username,
            ]);
            const map = new Map(values);
            const roomCode = map.get(STORAGE_KEYS.roomCode);
            const roomId = parsePositiveInt(map.get(STORAGE_KEYS.roomId));
            const playerId = parsePositiveInt(map.get(STORAGE_KEYS.playerId));
            const userIdStr = map.get(STORAGE_KEYS.userId);
            const username = map.get(STORAGE_KEYS.username);
            const normalizedRoomCode = normalizeRoomCode(roomCode);
            if (normalizedRoomCode && userIdStr && username) {
              setTimeout(() => {
                emitReconnectRoomGuarded({
                  userId: parseInt(userIdStr, 10),
                  roomCode: normalizedRoomCode,
                  roomId: roomId ?? undefined,
                  playerId: playerId ?? undefined,
                  username,
                });
              }, 850);
            }
          } catch (e) {
            console.error("[socket] Temporary-unavailable retry error:", e);
          }
          return;
        }
        if (/too many reconnect attempts/i.test(normalizedMessage)) {
          recoverBlockedUntilRef.current = Date.now() + 30_000;
          return;
        }
        if (isExpectedRoomFlowError(data.message)) {
          console.log("[socket] handled error:", data.message);
        } else {
          console.error("[socket] Error:", data.message);
        }
        emitErrorDeduped(data.message);
      });
    };

    void initSocket();

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;
      const current = socketRef.current;
      if (!current) return;

      if ((prevState === "background" || prevState === "inactive") && nextState === "active") {
        if (current.disconnected) current.connect();
        void recoverSessionOnSocket(current);
      }
    });

    return () => {
      mounted = false;
      appStateSub.remove();
      if (recoverFallbackTimerRef.current) {
        clearTimeout(recoverFallbackTimerRef.current);
        recoverFallbackTimerRef.current = null;
      }
      socket?.disconnect();
    };
  }, [
    clearJoinInFlight,
    classifyConnectError,
    emitJoinRoomGuarded,
    emitReconnectRoomGuarded,
    emitErrorDeduped,
    normalizeRoomCode,
    persistSessionHints,
    recoverSessionOnSocket,
    isExpectedMoveValidationError,
    isExpectedRoomFlowError,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) return;
      if (appStateRef.current !== "active") return;
      if (!gameState) return;
      const staleForMs = Date.now() - lastStateUpdateAtRef.current;
      if (staleForMs < 15000) return;
      void recoverSessionOnSocket(socket);
    }, 6000);
    return () => clearInterval(interval);
  }, [gameState, recoverSessionOnSocket]);

  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) return;
      if (gameState) return;
      const now = Date.now();
      if (recoverBlockedUntilRef.current > now) return;
      if (now - lastNoStateRecoverAtRef.current < 2500) return;
      lastNoStateRecoverAtRef.current = now;
      void recoverSessionOnSocket(socket);
    }, 2500);
    return () => clearInterval(interval);
  }, [isConnected, gameState, recoverSessionOnSocket]);

  const createRoom = useCallback((userId: number, username: string, maxPlayers: number = 5, isPrivate: boolean = false) => {
    console.log(
      `[socket] create-room sent userId=${userId} username=${username} maxPlayers=${maxPlayers} isPrivate=${isPrivate}`,
    );
    socketRef.current?.emit("create-room", { userId, username, maxPlayers, isPrivate });
  }, []);

  const joinRoom = useCallback((roomCode: string, userId: number, username: string) => {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    if (!normalizedRoomCode) {
      onErrorRef.current?.("Ungültiger Raum-Code");
      return;
    }
    emitJoinRoomGuarded({
      roomCode: normalizedRoomCode,
      userId,
      username,
      source: "manual",
    });
    void AsyncStorage.multiSet([
      [STORAGE_KEYS.roomCode, normalizedRoomCode],
      [STORAGE_KEYS.userId, userId.toString()],
      [STORAGE_KEYS.username, username],
    ]);
    void AsyncStorage.multiRemove([STORAGE_KEYS.roomId, STORAGE_KEYS.playerId]);
  }, [emitJoinRoomGuarded, normalizeRoomCode]);

  const leaveRoom = useCallback((roomId: number, playerId: number) => {
    socketRef.current?.emit("leave-room", { roomId, playerId });
    void AsyncStorage.multiRemove([
      STORAGE_KEYS.roomCode,
      STORAGE_KEYS.roomId,
      STORAGE_KEYS.playerId,
      STORAGE_KEYS.userId,
      STORAGE_KEYS.username,
    ]);
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

  const sendReaction = useCallback((roomId: number, emoji: ReactionEmoji, targetUserId?: number) => {
    socketRef.current?.emit("reaction:send", { roomId, emoji, targetUserId });
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

  const chooseSeat = useCallback((roomId: number, seatPosition: number, userId?: number) => {
    socketRef.current?.emit("preparation:choose-seat", {
      roomId,
      seatPosition,
      // Backward compatibility for older server payload shapes.
      seatIndex: seatPosition,
      userId,
    });
  }, []);

  const closeAllRooms = useCallback((username: string) => {
    socketRef.current?.emit("admin:close-all-rooms", { username });
  }, []);

  const closeEmptyRooms = useCallback((username: string) => {
    socketRef.current?.emit("admin:close-empty-rooms", { username });
  }, []);

  const recoverSession = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) return;
    if (socket.disconnected) socket.connect();
    await recoverSessionOnSocket(socket);
  }, [recoverSessionOnSocket]);

  const setOnRoomCreated = useCallback((cb: ((data: RoomCreatedPayload) => void) | null) => {
    onRoomCreatedRef.current = cb;
  }, []);

  const setOnRoomJoined = useCallback((cb: ((data: RoomJoinedPayload) => void) | null) => {
    onRoomJoinedRef.current = cb;
  }, []);

  const setOnPreparation = useCallback((cb: ((data: PreparationData) => void) | null) => {
    onPreparationRef.current = cb;
  }, []);

  const setOnBlackbirdEvent = useCallback((cb: ((event: BlackbirdEvent) => void) | null) => {
    onBlackbirdEventRef.current = cb;
  }, []);

  const setOnCardPlayFx = useCallback((cb: ((event: CardPlayFxEvent) => void) | null) => {
    onCardPlayFxRef.current = cb;
  }, []);

  const setOnDrawCardFx = useCallback((cb: ((event: DrawCardFxEvent) => void) | null) => {
    onDrawCardFxRef.current = cb;
  }, []);

  const setOnGameFx = useCallback((cb: ((event: GameFxEvent) => void) | null) => {
    onGameFxRef.current = cb;
  }, []);

  const setOnReactionEvent = useCallback((cb: ((event: ReactionEvent) => void) | null) => {
    onReactionEventRef.current = cb;
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
      sendReaction,
      markChatRead,
      markChatClosed,
      sendPreparationDone,
      chooseSeat,
      closeAllRooms,
      closeEmptyRooms,
      recoverSession,
      setOnRoomCreated,
      setOnRoomJoined,
      setOnPreparation,
      setOnBlackbirdEvent,
      setOnCardPlayFx,
      setOnDrawCardFx,
      setOnGameFx,
      setOnReactionEvent,
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
