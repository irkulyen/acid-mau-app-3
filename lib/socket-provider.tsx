import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GameState, GameAction, BlackbirdStateEvent } from "@/shared/game-types";
import type {
  BlackbirdEvent,
  CardPlayFxEvent,
  DrawCardFxEvent,
  ChatMessage,
  PreparationData,
  RoomCreatedPayload,
  RoomJoinedPayload,
} from "@/shared/socket-contract";
export type { BlackbirdEvent, CardPlayFxEvent, DrawCardFxEvent, ChatMessage, PreparationData, RoomCreatedPayload, RoomJoinedPayload } from "@/shared/socket-contract";
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
  const pendingBlackbirdEventsRef = useRef<BlackbirdEvent[]>([]);
  const seenBlackbirdEventIdsRef = useRef<Map<string, number>>(new Map());
  const onCardPlayFxRef = useRef<((event: CardPlayFxEvent) => void) | null>(null);
  const onDrawCardFxRef = useRef<((event: DrawCardFxEvent) => void) | null>(null);
  const onErrorRef = useRef<((error: string) => void) | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const gameStateRef = useRef<GameState | null>(null);
  const recoveringRef = useRef(false);
  const lastStateUpdateAtRef = useRef(0);
  const recoverStartedAtRef = useRef(0);
  const recoverAttemptRef = useRef(0);
  const recoverBlockedUntilRef = useRef(0);
  const recoverFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isJoiningRef = useRef(false);
  const hasJoinedRef = useRef(false);
  const joinInFlightRef = useRef<{ roomCode: string; userId: number; at: number } | null>(null);
  const lastJoinEmitRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  const isRejoiningRef = useRef(false);
  const lastRecoverEmitAtRef = useRef(0);
  const recoverHardFailedNotifiedRef = useRef(false);
  const lastMembershipRecoverAtRef = useRef(0);
  const lastNoStateRecoverAtRef = useRef(0);
  const lastServerErrorRef = useRef<{ message: string; at: number }>({ message: "", at: 0 });
  const hasEverConnectedRef = useRef(false);
  const lastConnectErrorRef = useRef<{ message: string; at: number }>({ message: "", at: 0 });
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
  const markBlackbirdEventSeen = useCallback((eventId?: string) => {
    if (!eventId) return;
    const now = Date.now();
    const seen = seenBlackbirdEventIdsRef.current;
    seen.set(eventId, now);
    if (seen.size <= 300) return;
    for (const [id, at] of seen.entries()) {
      if (now - at > 180_000) {
        seen.delete(id);
      }
    }
    while (seen.size > 300) {
      const oldestKey = seen.keys().next().value;
      if (!oldestKey) break;
      seen.delete(oldestKey);
    }
  }, []);
  const hasSeenBlackbirdEvent = useCallback((eventId?: string) => {
    if (!eventId) return false;
    const seenAt = seenBlackbirdEventIdsRef.current.get(eventId);
    if (!seenAt) return false;
    if (Date.now() - seenAt > 180_000) {
      seenBlackbirdEventIdsRef.current.delete(eventId);
      return false;
    }
    return true;
  }, []);
  const deliverBlackbirdEvent = useCallback((event: BlackbirdEvent, source: "socket" | "state") => {
    const cb = onBlackbirdEventRef.current;
    if (cb) {
      cb(event);
      return;
    }
    pendingBlackbirdEventsRef.current.push(event);
    if (pendingBlackbirdEventsRef.current.length > 20) {
      pendingBlackbirdEventsRef.current = pendingBlackbirdEventsRef.current.slice(-20);
    }
    console.warn("[socket] blackbird-event buffered (no callback yet)", {
      source,
      buffered: pendingBlackbirdEventsRef.current.length,
      type: event?.type,
      id: event?.id,
    });
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

  const emitJoinRoomGuarded = useCallback(
    (
      socket: Socket | null,
      args: { roomCode: string; userId: number; username: string },
      options?: { force?: boolean; cooldownMs?: number },
    ) => {
      if (!socket || !socket.connected) return false;
      const normalizedRoomCode = normalizeRoomCode(args.roomCode);
      const username = args.username?.trim();
      if (!normalizedRoomCode || !Number.isInteger(args.userId) || args.userId <= 0 || !username) return false;

      const currentState = gameStateRef.current;
      const alreadyMember =
        currentState?.roomCode?.toUpperCase() === normalizedRoomCode &&
        currentState.players.some((p) => p.userId === args.userId);
      if (alreadyMember) {
        hasJoinedRef.current = true;
        return false;
      }

      const now = Date.now();
      const cooldownMs = options?.cooldownMs ?? 2500;
      const key = `${normalizedRoomCode}:${args.userId}`;
      const recent =
        lastJoinEmitRef.current.key === key && now - lastJoinEmitRef.current.at < cooldownMs;
      const inFlight =
        joinInFlightRef.current?.roomCode === normalizedRoomCode &&
        joinInFlightRef.current?.userId === args.userId &&
        now - joinInFlightRef.current.at < 10_000;

      if (!options?.force && (recent || inFlight || isJoiningRef.current)) {
        return false;
      }

      isJoiningRef.current = true;
      joinInFlightRef.current = { roomCode: normalizedRoomCode, userId: args.userId, at: now };
      lastJoinEmitRef.current = { key, at: now };
      console.log("[socket] join-room sent", { roomCode: normalizedRoomCode, userId: args.userId });
      socket.emit("join-room", { roomCode: normalizedRoomCode, userId: args.userId, username });
      return true;
    },
    [normalizeRoomCode],
  );

  const recoverSessionOnSocket = useCallback(async (socket: Socket | null) => {
    if (!socket || recoveringRef.current) return;
    if (isJoiningRef.current && !hasJoinedRef.current) return;
    const now = Date.now();
    if (recoverBlockedUntilRef.current > now) return;
    if (recoverStartedAtRef.current > 0 && now - recoverStartedAtRef.current > 30_000) {
      recoverAttemptRef.current = 0;
      recoverStartedAtRef.current = 0;
      recoverHardFailedNotifiedRef.current = false;
    }
    if (recoverAttemptRef.current >= 3) {
      if (!recoverHardFailedNotifiedRef.current) {
        recoverHardFailedNotifiedRef.current = true;
        recoverBlockedUntilRef.current = Date.now() + 30_000;
        emitErrorDeduped("Reconnect fehlgeschlagen. Bitte Raum neu beitreten.");
      }
      return;
    }
    recoveringRef.current = true;
    let emittedRecover = false;
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
      if (!userId || !username) return;

      const currentGameState = gameStateRef.current;
      if (currentGameState) {
        const self = currentGameState.players.find((p) => p.userId === userId);
        if (self) {
          roomId = roomId ?? currentGameState.roomId;
          playerId = playerId ?? self.id;
        }
      }

      const hasRecoverHint = Boolean(normalizedRoomCode || roomId);
      if (hasRecoverHint) {
        const sinceLastEmit = Date.now() - lastRecoverEmitAtRef.current;
        if (sinceLastEmit < 1400 || isRejoiningRef.current) return;
        lastRecoverEmitAtRef.current = Date.now();
        isRejoiningRef.current = true;
        emittedRecover = true;
        if (!recoverStartedAtRef.current) recoverStartedAtRef.current = Date.now();
        recoverAttemptRef.current += 1;
        const attempt = recoverAttemptRef.current;
        console.log("[socket] reconnect-room sent", {
          roomCode: normalizedRoomCode ?? null,
          roomId: roomId ?? null,
          playerId: playerId ?? null,
          userId,
        });
        socket.emit("reconnect-room", {
          userId,
          roomCode: normalizedRoomCode ?? undefined,
          roomId: roomId ?? undefined,
          playerId: playerId ?? undefined,
          username: username ?? undefined,
        });
        // Keep reconnect strictly separate from join-room.
        // If reconnect cannot recover, UI should surface a clean fallback path.
        if (recoverFallbackTimerRef.current) clearTimeout(recoverFallbackTimerRef.current);
          recoverFallbackTimerRef.current = setTimeout(() => {
            const staleSinceRecover = lastStateUpdateAtRef.current < recoverStartedAtRef.current;
            if (attempt !== recoverAttemptRef.current) return;
            if (!socket.connected) return;
            if (!staleSinceRecover) return;
            isRejoiningRef.current = false;
            recoverHardFailedNotifiedRef.current = true;
            recoverBlockedUntilRef.current = Date.now() + 20_000;
            emitErrorDeduped("Reconnect fehlgeschlagen. Bitte Raum neu beitreten.");
          }, 1800);
        }
    } finally {
      recoveringRef.current = false;
      if (!emittedRecover) {
        isRejoiningRef.current = false;
      }
    }
  }, [emitErrorDeduped, normalizeRoomCode]);

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
        isRejoiningRef.current = false;
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
        console.log("[socket] game-state-update received", { roomCode: state.roomCode, roomId: state.roomId });
        isRejoiningRef.current = false;
        lastStateUpdateAtRef.current = Date.now();
        recoverAttemptRef.current = 0;
        recoverStartedAtRef.current = 0;
        recoverBlockedUntilRef.current = 0;
        recoverHardFailedNotifiedRef.current = false;
        setGameState(state);

        const recentBlackbirdEvents = (state.blackbird?.recentEvents || [])
          .filter((event): event is BlackbirdStateEvent => Boolean(event?.id))
          .sort((a, b) => (a.startAt ?? a.emittedAt) - (b.startAt ?? b.emittedAt));
        if (recentBlackbirdEvents.length > 0) {
          console.log("[socket] blackbird state snapshot received", {
            roomId: state.roomId,
            roomCode: state.roomCode,
            recent: recentBlackbirdEvents.length,
            lastEventId: state.blackbird?.lastEventId,
          });
        }
        for (const event of recentBlackbirdEvents) {
          if (hasSeenBlackbirdEvent(event.id)) continue;
          markBlackbirdEventSeen(event.id);
          const replayEvent: BlackbirdEvent = {
            ...event,
            replay: true,
            startAt: event.startAt ?? Date.now() + 120,
          };
          console.log("[socket] blackbird-event reconstructed from state", {
            roomId: state.roomId,
            roomCode: state.roomCode,
            type: replayEvent.type,
            id: replayEvent.id,
            emittedAt: replayEvent.emittedAt,
          });
          deliverBlackbirdEvent(replayEvent, "state");
        }

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
          if (isMember) {
            hasJoinedRef.current = true;
            isJoiningRef.current = false;
            joinInFlightRef.current = null;
            return;
          }
          if (!isMember && socket?.connected) {
            lastMembershipRecoverAtRef.current = now;
            // Reconnect only; do not mix with join-room.
            void recoverSessionOnSocket(socket);
          }
        })();
      });

      socket.on("room-created", (data: RoomCreatedPayload) => {
        console.log("[socket] Room created:", data.roomCode);
        recoverAttemptRef.current = 0;
        recoverStartedAtRef.current = 0;
        recoverBlockedUntilRef.current = 0;
        recoverHardFailedNotifiedRef.current = false;
        persistSessionHints({ roomCode: data.roomCode.toUpperCase(), roomId: data.roomId });
        onRoomCreatedRef.current?.(data);
      });

      socket.on("room-joined", (data: RoomJoinedPayload) => {
        console.log("[socket] Room joined:", data.roomCode);
        console.log("[socket] room-joined received", { roomCode: data.roomCode, roomId: data.roomId });
        isRejoiningRef.current = false;
        hasJoinedRef.current = true;
        isJoiningRef.current = false;
        joinInFlightRef.current = null;
        recoverAttemptRef.current = 0;
        recoverStartedAtRef.current = 0;
        recoverBlockedUntilRef.current = 0;
        recoverHardFailedNotifiedRef.current = false;
        persistSessionHints({ roomCode: data.roomCode.toUpperCase(), roomId: data.roomId });
        onRoomJoinedRef.current?.(data);
      });

      socket.on("join-failed", (data: { message: string; code?: string }) => {
        const message = data?.message || "Failed to join room";
        console.warn("[socket] join-failed:", data?.code || "UNKNOWN", message);
        isRejoiningRef.current = false;
        isJoiningRef.current = false;
        joinInFlightRef.current = null;
        if (data?.code === "ROOM_NOT_FOUND") {
          // Stale local room hints can cause endless auto-rejoin loops after server restarts.
          // Clear them immediately when the server confirms the room no longer exists.
          void AsyncStorage.multiRemove([
            STORAGE_KEYS.roomCode,
            STORAGE_KEYS.roomId,
            STORAGE_KEYS.playerId,
          ]);
          setGameState(null);
          hasJoinedRef.current = false;
          // Do not surface this as a user-facing error toast outside explicit join flow.
          return;
        }
        emitErrorDeduped(message);
      });

      socket.on("game-preparation", (data: PreparationData) => {
        onPreparationRef.current?.(data);
      });

      socket.on("blackbird-event", (event: BlackbirdEvent) => {
        if (hasSeenBlackbirdEvent(event?.id)) {
          return;
        }
        markBlackbirdEventSeen(event?.id);
        console.log("[socket] blackbird-event received", {
          socketId: socket?.id,
          type: event?.type,
          id: event?.id,
          replay: event?.replay === true,
          startAt: event?.startAt,
        });
        deliverBlackbirdEvent(event, "socket");
      });
      socket.on("card-play-fx", (event: CardPlayFxEvent) => {
        onCardPlayFxRef.current?.(event);
      });
      socket.on("draw-card-fx", (event: DrawCardFxEvent) => {
        onDrawCardFxRef.current?.(event);
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
        isRejoiningRef.current = false;
        const inRecoverWindow = Date.now() - recoverStartedAtRef.current < 5000;
        if (inRecoverWindow && data.message === "Game already in progress") {
          // Harmless during recovery fallback; keep silent to avoid false alarm popup.
          return;
        }
        if (isExpectedMoveValidationError(data.message)) {
          // Expected in race conditions between optimistic UI interaction and authoritative server rules.
          // Keep this non-blocking and rely on next state update instead of showing disruptive alerts.
          return;
        }
        if (data.message === "No active session found" || data.message === "Player not found in game") {
          hasJoinedRef.current = false;
          isJoiningRef.current = false;
          joinInFlightRef.current = null;
          recoverAttemptRef.current = 0;
          recoverStartedAtRef.current = 0;
          recoverBlockedUntilRef.current = 0;
          recoverHardFailedNotifiedRef.current = false;
          setGameState(null);
          void AsyncStorage.multiRemove([STORAGE_KEYS.roomCode, STORAGE_KEYS.roomId, STORAGE_KEYS.playerId]);
          return;
        }
        if (/temporarily unavailable/i.test(data.message)) {
          void recoverSessionOnSocket(socket ?? null);
          return;
        }
        if (/too many reconnect attempts/i.test(data.message)) {
          recoverBlockedUntilRef.current = Date.now() + 30_000;
          recoverHardFailedNotifiedRef.current = true;
          return;
        }
        console.error("[socket] Error:", data.message);
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
    classifyConnectError,
    emitErrorDeduped,
    hasSeenBlackbirdEvent,
    markBlackbirdEventSeen,
    deliverBlackbirdEvent,
    normalizeRoomCode,
    persistSessionHints,
    recoverSessionOnSocket,
    isExpectedMoveValidationError,
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
      if (now - lastNoStateRecoverAtRef.current < 5000) return;
      lastNoStateRecoverAtRef.current = now;
      void recoverSessionOnSocket(socket);
    }, 5000);
    return () => clearInterval(interval);
  }, [isConnected, gameState, recoverSessionOnSocket]);

  const createRoom = useCallback((userId: number, username: string, maxPlayers: number = 5, isPrivate: boolean = false) => {
    socketRef.current?.emit("create-room", { userId, username, maxPlayers, isPrivate });
  }, []);

  const joinRoom = useCallback((roomCode: string, userId: number, username: string) => {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    if (!normalizedRoomCode) {
      onErrorRef.current?.("Ungültiger Raum-Code");
      return;
    }
    hasJoinedRef.current = false;
    emitJoinRoomGuarded(socketRef.current, { roomCode: normalizedRoomCode, userId, username }, { cooldownMs: 1800 });
    void AsyncStorage.multiSet([
      [STORAGE_KEYS.roomCode, normalizedRoomCode],
      [STORAGE_KEYS.userId, userId.toString()],
      [STORAGE_KEYS.username, username],
    ]);
    void AsyncStorage.multiRemove([STORAGE_KEYS.roomId, STORAGE_KEYS.playerId]);
  }, [emitJoinRoomGuarded, normalizeRoomCode]);

  const leaveRoom = useCallback((roomId: number, playerId: number) => {
    socketRef.current?.emit("leave-room", { roomId, playerId });
    hasJoinedRef.current = false;
    isJoiningRef.current = false;
    joinInFlightRef.current = null;
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
    if (!cb) return;
    if (pendingBlackbirdEventsRef.current.length === 0) return;
    const buffered = [...pendingBlackbirdEventsRef.current];
    pendingBlackbirdEventsRef.current = [];
    console.log("[socket] flushing buffered blackbird events", { count: buffered.length });
    buffered.forEach((event) => cb(event));
  }, []);

  const setOnCardPlayFx = useCallback((cb: ((event: CardPlayFxEvent) => void) | null) => {
    onCardPlayFxRef.current = cb;
  }, []);

  const setOnDrawCardFx = useCallback((cb: ((event: DrawCardFxEvent) => void) | null) => {
    onDrawCardFxRef.current = cb;
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
