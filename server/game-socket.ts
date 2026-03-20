import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import type { GameState, GameAction, Player, Card } from "../shared/game-types";
import type { GameFxEvent } from "../shared/socket-contract";
import type { SeatDrawResult } from "../shared/game-preparation";
import { applySeatChoices, drawCardsForPlayers, getSeatPickOrderPlayerIds, performDealerSelectionForPlayers } from "../shared/game-preparation";
import { createGameState, processAction, startGame } from "../shared/game-engine";
import { canPlayCard, getEffectiveTopCard, getPlayableCards } from "../shared/game-rules";
import * as db from "./db";
import * as roomManager from "./room-manager";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { createCorsOriginMatcher } from "./_core/cors";
import { realtimeStore } from "./realtime-store";
import { telemetry } from "./telemetry";

const roomSockets = new Map<number, Set<string>>();

// Socket → userId mapping (for per-player state filtering)
const socketUserMapping = new Map<string, number>();

// Disconnect timeouts: userId → timeout handle
const disconnectTimeouts = new Map<number, NodeJS.Timeout>();

// Active bot turn timeouts per room (to prevent double-scheduling)
const botTurnTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
const seatSelectionFailsafeTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
const SEAT_SELECTION_FAILSAFE_MS = 12_000;

// Turn timeout: roomId → timeout handle (auto-action if player doesn't act)
const turnTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
const eventRateLimits = new Map<string, { count: number; resetAt: number }>();
const roomCleanupTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
const blackbirdHistory = new Map<number, BlackbirdEventPayload[]>();
const gameFxHistory = new Map<number, GameFxEvent[]>();
const roomFxSequences = new Map<number, number>();
const roomFxNextStartAt = new Map<number, number>();
type BlackbirdRuntimeState = {
  lastAnyAt: number;
  lastByType: Partial<Record<BlackbirdEventType, number>>;
  lastSignatureAt: Record<string, number>;
  recentPhrases: string[];
};
const blackbirdRuntime = new Map<number, BlackbirdRuntimeState>();
let blackbirdSequenceCounter = 0;
const roomMutationQueues = new Map<number, Promise<void>>();
const userMutationQueues = new Map<number, Promise<void>>();
const blockedSocketOrigins = new Set<string>();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type BlackbirdEventType = "ass" | "unter" | "draw_chain" | "winner" | "loser" | "round_start" | "seven_played" | "mvp";
type BlackbirdEventPayload = {
  id: string;
  type: BlackbirdEventType;
  playerName?: string;
  drawChainCount?: number;
  wishSuit?: string;
  replay?: boolean;
  sequenceId?: string;
  sequenceStep?: number;
  sequenceTotal?: number;
  intensity?: 1 | 2 | 3 | 4 | 5;
  startAt?: number;
  spotlightUserId?: number;
  spotlightPlayerName?: string;
  variant?: string;
  statsText?: string;
  phrase?: string;
  emittedAt: number;
};

const BLACKBIRD_GLOBAL_COOLDOWN_MS = 6_000;
const BLACKBIRD_TYPE_COOLDOWN_MS: Record<BlackbirdEventType, number> = {
  round_start: 9_000,
  winner: 1_500,
  loser: 1_500,
  draw_chain: 3_000,
  seven_played: 2_200,
  ass: 8_000,
  unter: 8_000,
  mvp: 6_000,
};
const BLACKBIRD_TYPE_PRIORITY: Record<BlackbirdEventType, number> = {
  mvp: 100,
  loser: 95,
  winner: 90,
  seven_played: 85,
  draw_chain: 80,
  round_start: 70,
  ass: 60,
  unter: 60,
};
const BLACKBIRD_SKIP_CHANCE: Record<BlackbirdEventType, number> = {
  round_start: 0.7,
  winner: 0,
  loser: 0,
  draw_chain: 0.55,
  seven_played: 0,
  ass: 0.7,
  unter: 0.7,
  mvp: 0.6,
};
const BLACKBIRD_RARE_CHANCE = 0.06;
const BLACKBIRD_RECENT_PHRASE_WINDOW = 8;

const BB_ROUND_START = [
  "Neue Runde.",
  "Konzentriert euch.",
  "Los geht's.",
  "Mal sehen, wer diesmal verliert.",
];
const BB_WINNER = [
  (n?: string) => n ? `${n} ist durch.` : "Und weg bist du.",
  (n?: string) => n ? `${n} spielt sauber.` : "Nicht schlecht.",
  () => "Der Rest darf weiterspielen.",
  () => "Sauber.",
];
const BB_LOSER = [
  (n?: string) => n ? `Autsch, ${n}.` : "Autsch.",
  () => "Das war schwach.",
  () => "Das ging nach hinten los.",
  () => "Vielleicht nächstes Mal.",
];
const BB_DRAW_CHAIN = [
  (count?: number) => `Oh, das wird teuer${count ? ` (+${count})` : ""}.`,
  () => "Zieh einfach.",
  () => "Das eskaliert gerade.",
  () => "Du kommst da nicht raus.",
  () => "Das wird lang.",
];
const BB_SEVEN_PLAYED = [
  () => "Boom.",
  () => "Sieben. Viel Spaß beim Ziehen.",
  () => "Das wird unangenehm.",
  () => "Das tut jetzt weh.",
  () => "Selber schuld.",
  (count?: number) => count && count > 1 ? `Ziehkette bei ${count}.` : "Sieben gelegt.",
];
const BB_ASS = [
  () => "Pause für dich.",
  () => "Du darfst zuschauen.",
  () => "Kurz still sein.",
  () => "Nächster.",
];
const BB_UNTER = [
  () => "Neue Farbe.",
  () => "Mal sehen, ob das klug war.",
  () => "Interessante Wahl.",
  () => "Mutig.",
];
const BB_RARE = [
  "Ich habe schon bessere Spiele gesehen.",
  "Mutig. Oder einfach schlecht.",
  "Das war... kreativ.",
  "Ich würde das nicht so spielen.",
];

type PendingPreparation = {
  phase: "seat_selection" | "dealer_selection";
  seatDraws: SeatDrawResult[];
  dealerDraws: SeatDrawResult[];
  seatPickOrderUserIds: number[];
  seatChoices: Array<{ userId: number; seatPosition: number }>;
  currentPickerUserId: number | null;
};

function getNextPlayerId(players: Player[]): number {
  if (players.length === 0) return 1;
  return Math.max(...players.map((p) => p.id)) + 1;
}

async function getUserAvatarUrl(userId: number): Promise<string | undefined> {
  try {
    const profile = await db.getPlayerProfile(userId);
    return profile?.avatarUrl || undefined;
  } catch {
    return undefined;
  }
}

function toPreparationPayload(prep: PendingPreparation) {
  return {
    phase: prep.phase,
    seatDraws: prep.seatDraws,
    dealerDraws: prep.dealerDraws,
    seatPickOrderUserIds: prep.seatPickOrderUserIds,
    seatChoices: prep.seatChoices,
    currentPickerUserId: prep.currentPickerUserId,
  };
}

function pickFirstAvailableSeat(totalPlayers: number, seatChoices: Array<{ userId: number; seatPosition: number }>): number {
  const used = new Set(seatChoices.map((s) => s.seatPosition));
  for (let i = 0; i < totalPlayers; i++) {
    if (!used.has(i)) return i;
  }
  throw new Error("No free seat available");
}

function createSeatPreparation(gameState: GameState): PendingPreparation {
  const seatDraws = drawCardsForPlayers(gameState.players);
  const seatPickOrderPlayerIds = getSeatPickOrderPlayerIds(seatDraws);
  const userIdByPlayerId = new Map(gameState.players.map((p) => [p.id, p.userId]));
  const seatPickOrderUserIds = seatPickOrderPlayerIds
    .map((pid) => userIdByPlayerId.get(pid))
    .filter((uid): uid is number => typeof uid === "number");

  if (seatPickOrderUserIds.length !== gameState.players.length) {
    throw new Error("Seat pick order mismatch");
  }

  return {
    phase: "seat_selection",
    seatDraws,
    dealerDraws: [],
    seatPickOrderUserIds,
    seatChoices: [],
    currentPickerUserId: seatPickOrderUserIds[0] ?? null,
  };
}

function assignRandomSeats(prep: PendingPreparation, totalPlayers: number) {
  const randomizedSeats = shuffleArray(Array.from({ length: totalPlayers }, (_, i) => i));
  prep.seatChoices = prep.seatPickOrderUserIds.map((userId, index) => ({
    userId,
    seatPosition: randomizedSeats[index],
  }));
  prep.currentPickerUserId = null;
}

function getSocketAuth(socket: Socket): { userId: number; role: string } | null {
  const auth = socket.data?.auth as { userId?: number; role?: string } | undefined;
  if (!auth?.userId || !auth.role) return null;
  return { userId: auth.userId, role: auth.role };
}

async function hasAdminAccess(userId: number, role: string): Promise<boolean> {
  if (role === "admin") return true;
  if (ENV.adminUserIds.has(userId)) {
    return true;
  }
  const user = await db.getUserById(userId).catch(() => null);
  if (user?.role === "admin") {
    return true;
  }
  return false;
}

function sanitizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.trim();
  if (username.length < 3 || username.length > 50) return null;
  return username;
}

function normalizeRoomCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return null;
  return code;
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function toMetricSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "unknown";
}

type UserRoomMembership = {
  roomId: number;
  state: GameState;
};

async function getRoomByCodeWithRetry(roomCode: string, attempts = 3, delayMs = 120) {
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const room = await roomManager.getRoomByCode(roomCode);
      if (room) return room;
    } catch (error) {
      lastError = error;
    }
    if (i < attempts - 1) await sleep(delayMs * (i + 1));
  }
  if (lastError) throw lastError;
  return null;
}

async function getGameStateWithRetry(roomId: number, attempts = 3, delayMs = 120): Promise<GameState | undefined> {
  for (let i = 0; i < attempts; i++) {
    const state = await realtimeStore.getGameState(roomId);
    if (state) return state;
    if (i < attempts - 1) await sleep(delayMs * (i + 1));
  }
  return undefined;
}

async function getUserRoomMemberships(userId: number): Promise<UserRoomMembership[]> {
  const roomIds = await realtimeStore.getAllRoomIds();
  const memberships: UserRoomMembership[] = [];
  for (const roomId of roomIds) {
    const state = await realtimeStore.getGameState(roomId);
    if (!state) continue;
    if (state.players.some((player) => player.userId === userId)) {
      memberships.push({ roomId, state });
    }
  }
  return memberships;
}

async function getAuthoritativeUserSession(userId: number): Promise<UserRoomMembership | null> {
  const mappedRoomId = await realtimeStore.getUserRoom(userId);
  if (mappedRoomId) {
    const mappedState = await getGameStateWithRetry(mappedRoomId, 2, 80);
    if (mappedState?.players.some((player) => player.userId === userId)) {
      return { roomId: mappedRoomId, state: mappedState };
    }
    await realtimeStore.deleteUserRoom(userId);
    telemetry.inc("rooms.mapping_stale_cleared");
    console.warn(`[socket] Cleared stale user-room mapping userId=${userId} roomId=${mappedRoomId}`);
  }

  const memberships = await getUserRoomMemberships(userId);
  if (memberships.length === 1) {
    await realtimeStore.setUserRoom(userId, memberships[0].roomId);
    telemetry.inc("rooms.mapping_recovered.scan");
    return memberships[0];
  }
  if (memberships.length > 1) {
    telemetry.inc("rooms.user_multi_membership_detected");
    console.error(
      `[socket] User ${userId} appears in multiple rooms: ${memberships.map((m) => m.roomId).join(", ")}`,
    );
  }
  return null;
}

async function clearUserRoomMappingIfMatches(userId: number, roomId: number) {
  const mappedRoomId = await realtimeStore.getUserRoom(userId);
  if (mappedRoomId === roomId) {
    await realtimeStore.deleteUserRoom(userId);
  }
}

function evictDuplicateUserSocketsInRoom(
  io: SocketIOServer,
  roomId: number,
  userId: number,
  keepSocketId: string,
) {
  const sockets = roomSockets.get(roomId);
  if (!sockets || sockets.size <= 1) return;

  let evicted = 0;
  for (const sid of Array.from(sockets)) {
    if (sid === keepSocketId) continue;
    if (socketUserMapping.get(sid) !== userId) continue;
    const staleSocket = io.sockets.sockets.get(sid);
    staleSocket?.leave(`room-${roomId}`);
    sockets.delete(sid);
    socketUserMapping.delete(sid);
    evicted += 1;
  }

  if (evicted > 0) {
    telemetry.inc("rooms.duplicate_user_socket_evicted", evicted);
    console.warn(
      `[socket] Evicted ${evicted} duplicate socket(s) for user ${userId} in room ${roomId}; keep=${keepSocketId}`,
    );
  }
}

function isRateLimited(socketId: string, event: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const key = `${socketId}:${event}`;
  const existing = eventRateLimits.get(key);
  if (!existing || now >= existing.resetAt) {
    eventRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (existing.count >= limit) {
    telemetry.inc(`rate_limit.${event}`);
    return true;
  }

  existing.count += 1;
  eventRateLimits.set(key, existing);
  return false;
}

async function isUserMappedToRoom(userId: number, roomId: number): Promise<boolean> {
  return (await realtimeStore.getUserRoom(userId)) === roomId;
}

function isUserConnectedInRoom(roomId: number, userId: number): boolean {
  const sockets = roomSockets.get(roomId);
  if (!sockets) return false;
  for (const socketId of sockets) {
    if (socketUserMapping.get(socketId) === userId) return true;
  }
  return false;
}

function detachSocketFromTrackedRooms(socket: Socket): number[] {
  const detached: number[] = [];
  for (const [roomId, sockets] of roomSockets.entries()) {
    if (!sockets.delete(socket.id)) continue;
    socket.leave(`room-${roomId}`);
    detached.push(roomId);
    if (sockets.size === 0) {
      roomSockets.delete(roomId);
    }
  }
  return detached;
}

function attachSocketToTrackedRoom(socket: Socket, roomId: number) {
  detachSocketFromTrackedRooms(socket);
  socket.join(`room-${roomId}`);
  if (!roomSockets.has(roomId)) {
    roomSockets.set(roomId, new Set());
  }
  roomSockets.get(roomId)!.add(socket.id);
}

function clampIntensity(v: number): 1 | 2 | 3 | 4 | 5 {
  const rounded = Math.max(1, Math.min(5, Math.round(v)));
  return rounded as 1 | 2 | 3 | 4 | 5;
}

function deriveEventIntensity(event: Omit<BlackbirdEventPayload, "id" | "emittedAt">): 1 | 2 | 3 | 4 | 5 {
  switch (event.type) {
    case "seven_played":
      return clampIntensity(2 + Math.floor((event.drawChainCount || 0) / 2));
    case "draw_chain":
      return clampIntensity(2 + Math.floor((event.drawChainCount || 0) / 2));
    case "winner":
    case "loser":
      return 4;
    case "mvp":
      return 5;
    case "round_start":
      return 3;
    case "ass":
    case "unter":
    default:
      return 2;
  }
}

function deriveVariant(event: Omit<BlackbirdEventPayload, "id" | "emittedAt">): string {
  if (event.type === "seven_played") return "impact";
  if (event.type === "draw_chain") return "voltage";
  if (event.type === "loser") return "drama";
  if (event.type === "winner") return "victory";
  if (event.type === "mvp") return "legendary";
  if (event.type === "unter") return "wild";
  if (event.type === "ass") return "skip";
  return "default";
}

function getBlackbirdRuntime(roomId: number): BlackbirdRuntimeState {
  const existing = blackbirdRuntime.get(roomId);
  if (existing) return existing;
  const created: BlackbirdRuntimeState = {
    lastAnyAt: 0,
    lastByType: {},
    lastSignatureAt: {},
    recentPhrases: [],
  };
  blackbirdRuntime.set(roomId, created);
  return created;
}

function shouldEmitBlackbirdEvent(roomId: number, event: Omit<BlackbirdEventPayload, "id" | "emittedAt">): boolean {
  const now = Date.now();
  const runtime = getBlackbirdRuntime(roomId);
  const type = event.type;
  const typePriority = BLACKBIRD_TYPE_PRIORITY[type];

  const sinceAny = now - runtime.lastAnyAt;
  if (sinceAny < BLACKBIRD_GLOBAL_COOLDOWN_MS && typePriority < 85) {
    return false;
  }

  const lastByType = runtime.lastByType[type] ?? 0;
  if (now - lastByType < BLACKBIRD_TYPE_COOLDOWN_MS[type] && typePriority < 90) {
    return false;
  }

  const signature = `${event.type}:${event.playerName || ""}:${event.drawChainCount || ""}:${event.wishSuit || ""}`;
  const lastSig = runtime.lastSignatureAt[signature] ?? 0;
  if (now - lastSig < 1_200) {
    return false;
  }

  let skipChance = BLACKBIRD_SKIP_CHANCE[type];
  if (type === "draw_chain") {
    const chain = event.drawChainCount ?? 0;
    if (chain >= 7) skipChance = 0;
    else if (chain >= 5) skipChance = 0.15;
    else if (chain >= 4) skipChance = 0.35;
    else skipChance = 0.6;
  }
  if (skipChance > 0 && Math.random() < skipChance) {
    return false;
  }

  runtime.lastAnyAt = now;
  runtime.lastByType[type] = now;
  runtime.lastSignatureAt[signature] = now;
  return true;
}

function pickNonRepeatingPhrase(roomId: number, candidates: string[]): string {
  if (candidates.length === 0) return "";
  const runtime = getBlackbirdRuntime(roomId);
  const recent = new Set(runtime.recentPhrases);
  const pool = candidates.filter((c) => !recent.has(c));
  const chosen = (pool.length ? pool : candidates)[Math.floor(Math.random() * (pool.length ? pool.length : candidates.length))];
  runtime.recentPhrases.push(chosen);
  if (runtime.recentPhrases.length > BLACKBIRD_RECENT_PHRASE_WINDOW) {
    runtime.recentPhrases = runtime.recentPhrases.slice(-BLACKBIRD_RECENT_PHRASE_WINDOW);
  }
  return chosen;
}

function buildBlackbirdPhrase(roomId: number, event: Omit<BlackbirdEventPayload, "id" | "emittedAt">): string {
  if (Math.random() < BLACKBIRD_RARE_CHANCE) {
    return pickNonRepeatingPhrase(roomId, BB_RARE);
  }

  const playerName = event.playerName || event.spotlightPlayerName;
  switch (event.type) {
    case "winner":
      return pickNonRepeatingPhrase(roomId, BB_WINNER.map((f) => f(playerName)));
    case "loser":
      return pickNonRepeatingPhrase(roomId, BB_LOSER.map((f) => f(playerName)));
    case "seven_played":
      return pickNonRepeatingPhrase(roomId, BB_SEVEN_PLAYED.map((f) => f(event.drawChainCount)));
    case "draw_chain":
      return pickNonRepeatingPhrase(roomId, BB_DRAW_CHAIN.map((f) => f(event.drawChainCount)));
    case "ass":
      return pickNonRepeatingPhrase(roomId, BB_ASS.map((f) => f()));
    case "unter":
      return pickNonRepeatingPhrase(roomId, BB_UNTER.map((f) => f()));
    case "mvp":
      return pickNonRepeatingPhrase(roomId, [`Highlight: ${event.statsText || "Starker Moment."}`]);
    case "round_start":
    default:
      return pickNonRepeatingPhrase(roomId, BB_ROUND_START);
  }
}

function pushBlackbirdHistory(roomId: number, events: BlackbirdEventPayload[]) {
  const prev = blackbirdHistory.get(roomId) || [];
  const now = Date.now();
  const merged = [...prev, ...events]
    .filter((e) => now - e.emittedAt <= 15_000)
    .slice(-20);
  blackbirdHistory.set(roomId, merged);
}

type GameFxEmitInput = Omit<GameFxEvent, "id" | "roomId" | "sequence" | "emittedAt" | "startAt"> & {
  startAt?: number;
};

function nextGameFxSequence(roomId: number): number {
  const next = (roomFxSequences.get(roomId) ?? 0) + 1;
  roomFxSequences.set(roomId, next);
  return next;
}

function reserveFxStartAt(roomId: number, preferredStartAt?: number, minGapMs = 140): number {
  const now = Date.now();
  const baseline = Math.max(now + 40, preferredStartAt ?? now + 120);
  const lastStartAt = roomFxNextStartAt.get(roomId) ?? 0;
  const startAt = Math.max(baseline, lastStartAt + minGapMs);
  roomFxNextStartAt.set(roomId, startAt);
  return startAt;
}

function pushGameFxHistory(roomId: number, event: GameFxEvent) {
  const prev = gameFxHistory.get(roomId) || [];
  const now = Date.now();
  const merged = [...prev, event]
    .filter((entry) => now - entry.emittedAt <= 20_000)
    .slice(-80);
  gameFxHistory.set(roomId, merged);
}

function emitGameFx(io: SocketIOServer, roomId: number, event: GameFxEmitInput, minGapMs = 140): GameFxEvent {
  const emittedAt = Date.now();
  const sequence = nextGameFxSequence(roomId);
  const startAt = typeof event.startAt === "number"
    ? event.startAt
    : reserveFxStartAt(roomId, undefined, minGapMs);
  const previous = roomFxNextStartAt.get(roomId) ?? 0;
  if (startAt > previous) {
    roomFxNextStartAt.set(roomId, startAt);
  }
  const payload: GameFxEvent = {
    ...event,
    id: `fx-${roomId}-${sequence}-${Math.floor(Math.random() * 1000)}`,
    roomId,
    sequence,
    startAt,
    emittedAt,
  };
  pushGameFxHistory(roomId, payload);
  io.to(`room-${roomId}`).emit("game-fx", payload);
  telemetry.inc(`fx.${event.type}`);
  return payload;
}

function replayGameFxEventsForSocket(socket: Socket, roomId: number) {
  const now = Date.now();
  const replayable = (gameFxHistory.get(roomId) || []).filter((event) => now - event.emittedAt <= 12_000);
  if (replayable.length === 0) return;

  replayable.forEach((event, index) => {
    const replayEvent: GameFxEvent = {
      ...event,
      replay: true,
      startAt: now + 160 + index * 190,
    };
    socket.emit("game-fx", replayEvent);
  });
  telemetry.inc("fx.replayed", replayable.length);
}

function emitCardPlayFx(
  io: SocketIOServer,
  roomId: number,
  data: {
    card: Card;
    playerId?: number;
    userId?: number;
    playerName?: string;
    startAt?: number;
  },
) {
  const startAt = reserveFxStartAt(roomId, data.startAt, 160);
  io.to(`room-${roomId}`).emit("card-play-fx", {
    card: data.card,
    playerId: data.playerId,
    startAt,
  });
  emitGameFx(
    io,
    roomId,
    {
      type: "card_play",
      card: data.card,
      playerId: data.playerId,
      userId: data.userId,
      playerName: data.playerName,
      startAt,
    },
    10,
  );
}

function emitDrawCardFx(
  io: SocketIOServer,
  roomId: number,
  data: {
    playerId?: number;
    userId?: number;
    playerName?: string;
    drawCount?: number;
    startAt?: number;
  },
) {
  const startAt = reserveFxStartAt(roomId, data.startAt, 120);
  io.to(`room-${roomId}`).emit("draw-card-fx", {
    playerId: data.playerId,
    drawCount: data.drawCount,
    startAt,
  });
  emitGameFx(
    io,
    roomId,
    {
      type: "draw_card",
      playerId: data.playerId,
      userId: data.userId,
      playerName: data.playerName,
      drawCount: data.drawCount,
      startAt,
    },
    10,
  );
}

function emitStateTransitionFx(
  io: SocketIOServer,
  roomId: number,
  oldState: GameState,
  newState: GameState,
  actorPlayerId?: number,
) {
  for (const player of newState.players) {
    const oldPlayer = oldState.players.find((entry) => entry.id === player.id);
    if (!oldPlayer) continue;
    if (!oldPlayer.isEliminated && player.isEliminated) {
      emitGameFx(io, roomId, {
        type: "elimination",
        playerId: player.id,
        userId: player.userId,
        playerName: player.username,
        eliminatedUserId: player.userId,
        eliminatedPlayerName: player.username,
      }, 220);
    }
  }

  if (oldState.phase === "round_end" && newState.phase === "playing" && newState.roundNumber > oldState.roundNumber) {
    emitGameFx(io, roomId, {
      type: "round_transition",
      roundNumber: newState.roundNumber,
      playerId: actorPlayerId,
    }, 240);
  }

  if (oldState.phase !== "game_end" && newState.phase === "game_end") {
    const winner = newState.players.find((player) => !player.isEliminated);
    emitGameFx(io, roomId, {
      type: "match_result",
      roundNumber: newState.roundNumber,
      winnerUserId: winner?.userId,
      winnerPlayerName: winner?.username,
      playerId: winner?.id,
      playerName: winner?.username,
    }, 240);
  }
}

function emitBlackbirdEvents(io: SocketIOServer, roomId: number, events: Array<Omit<BlackbirdEventPayload, "id" | "emittedAt">>) {
  if (!ENV.enableBlackbirdEvents) return;
  if (events.length === 0) return;
  const accepted = events.filter((event) => shouldEmitBlackbirdEvent(roomId, event));
  if (accepted.length === 0) return;
  const now = Date.now();
  const hasSequence = accepted.length > 1;
  const sequenceId = hasSequence ? `seq-${roomId}-${++blackbirdSequenceCounter}` : undefined;

  const normalized: BlackbirdEventPayload[] = accepted.map((event, index) => {
    const startAt = reserveFxStartAt(roomId, event.startAt ?? (now + 220 + index * 900), 520);
    return {
      ...event,
      id: `bb-${roomId}-${now}-${index}-${Math.floor(Math.random() * 1000)}`,
      sequenceId,
      sequenceStep: hasSequence ? index + 1 : undefined,
      sequenceTotal: hasSequence ? accepted.length : undefined,
      startAt,
      intensity: event.intensity ?? deriveEventIntensity(event),
      variant: event.variant ?? deriveVariant(event),
      phrase: event.phrase ?? buildBlackbirdPhrase(roomId, event),
      emittedAt: now,
    };
  });

  pushBlackbirdHistory(roomId, normalized);
  for (const payload of normalized) {
    io.to(`room-${roomId}`).emit("blackbird-event", payload);
    const { emittedAt, ...blackbirdEvent } = payload;
    emitGameFx(io, roomId, {
      type: "blackbird",
      userId: payload.spotlightUserId,
      playerName: payload.spotlightPlayerName ?? payload.playerName,
      startAt: payload.startAt,
      blackbird: blackbirdEvent,
    }, 30);
    telemetry.inc("blackbird.emitted");
  }
  if (hasSequence) telemetry.inc("blackbird.sequences");
}

function replayBlackbirdEventsForSocket(socket: Socket, roomId: number) {
  if (!ENV.enableBlackbirdEvents) return;
  const now = Date.now();
  const replayable = (blackbirdHistory.get(roomId) || []).filter((e) => now - e.emittedAt <= 12_000);
  if (replayable.length === 0) return;

  replayable.forEach((event, i) => {
    socket.emit("blackbird-event", {
      ...event,
      replay: true,
      startAt: now + 180 + i * 450,
    });
  });
  telemetry.inc("blackbird.replayed", replayable.length);
}

function cancelRoomCleanup(roomId: number) {
  const timeout = roomCleanupTimeouts.get(roomId);
  if (timeout) {
    clearTimeout(timeout);
    roomCleanupTimeouts.delete(roomId);
  }
}

async function withRoomMutation<T>(roomId: number, task: () => Promise<T>): Promise<T> {
  const previous = roomMutationQueues.get(roomId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.catch(() => undefined).then(() => current);
  roomMutationQueues.set(roomId, queued);

  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    release();
    if (roomMutationQueues.get(roomId) === queued) {
      roomMutationQueues.delete(roomId);
    }
  }
}

async function withUserMutation<T>(userId: number, task: () => Promise<T>): Promise<T> {
  const previous = userMutationQueues.get(userId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.catch(() => undefined).then(() => current);
  userMutationQueues.set(userId, queued);

  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    release();
    if (userMutationQueues.get(userId) === queued) {
      userMutationQueues.delete(userId);
    }
  }
}

function scheduleRoomCleanup(roomId: number, delayMs = 30 * 60 * 1000) {
  cancelRoomCleanup(roomId);
  const timeout = setTimeout(() => {
    void (async () => {
    const sockets = roomSockets.get(roomId);
    if (sockets && sockets.size > 0) return;

    const botTimeout = botTurnTimeouts.get(roomId);
    if (botTimeout) {
      clearTimeout(botTimeout);
      botTurnTimeouts.delete(roomId);
    }
    const turnTimeout = turnTimeouts.get(roomId);
    if (turnTimeout) {
      clearTimeout(turnTimeout);
      turnTimeouts.delete(roomId);
    }
    const seatTimeout = seatSelectionFailsafeTimeouts.get(roomId);
    if (seatTimeout) {
      clearTimeout(seatTimeout);
      seatSelectionFailsafeTimeouts.delete(roomId);
    }

    await realtimeStore.deleteGameState(roomId);
    roomSockets.delete(roomId);
    await realtimeStore.deletePreparation(roomId);
    blackbirdHistory.delete(roomId);
    blackbirdRuntime.delete(roomId);
    gameFxHistory.delete(roomId);
    roomFxSequences.delete(roomId);
    roomFxNextStartAt.delete(roomId);

    // Clear room-related user mappings
    for (const [uid, mappedRoomId] of await realtimeStore.getUserMappings()) {
      if (mappedRoomId === roomId) {
        const disconnectTimeout = disconnectTimeouts.get(uid);
        if (disconnectTimeout) {
          clearTimeout(disconnectTimeout);
          disconnectTimeouts.delete(uid);
        }
        await realtimeStore.deleteUserRoom(uid);
      }
    }
    roomCleanupTimeouts.delete(roomId);
    void roomManager.deleteRoom(roomId);
    console.log(`[socket] Cleaned up inactive room ${roomId}`);
    telemetry.inc("rooms.cleaned_up");
    })();
  }, delayMs);

  roomCleanupTimeouts.set(roomId, timeout);
}

/**
 * Bot AI: Choose and execute a move for the current bot player.
 * Called automatically when it's a bot's turn.
 */
function scheduleBotTurn(io: SocketIOServer, roomId: number) {
  if (!ENV.enableBots) return;
  // Clear any existing bot timeout for this room
  const existing = botTurnTimeouts.get(roomId);
  if (existing) clearTimeout(existing);

  const delay = 1500 + Math.random() * 1500; // 1500-3000ms delay for natural feel
  const timeout = setTimeout(() => {
    botTurnTimeouts.delete(roomId);
    void executeBotTurn(io, roomId);
  }, delay);
  botTurnTimeouts.set(roomId, timeout);
}

async function executeBotTurn(io: SocketIOServer, roomId: number) {
  try {
    const result = await withRoomMutation(roomId, async () => {
      const state = await realtimeStore.getGameState(roomId);
      if (!state || state.phase !== "playing") return null;

      const currentPlayer = state.players[state.currentPlayerIndex];
      if (!currentPlayer || currentPlayer.userId >= 0) return null; // Not a bot
      if (currentPlayer.isEliminated || currentPlayer.hand.length === 0) return null;

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
      await realtimeStore.setGameState(roomId, newState);
      return {
        previousState: state,
        newState,
        action,
        actorPlayerId: currentPlayer.id,
        actorUserId: currentPlayer.userId,
        actorPlayerName: currentPlayer.username,
      };
    });

    if (!result) return;

    if (result.action.type === "PLAY_CARD") {
      const prevTop = result.previousState.discardPile[result.previousState.discardPile.length - 1];
      const nextTop = result.newState.discardPile[result.newState.discardPile.length - 1];
      if (nextTop && (!prevTop || prevTop.id !== nextTop.id)) {
        emitCardPlayFx(io, roomId, {
          card: nextTop,
          playerId: result.actorPlayerId,
          userId: result.actorUserId,
          playerName: result.actorPlayerName,
          startAt: Date.now() + 130,
        });
      }
    } else if (result.action.type === "DRAW_CARD") {
      const actorBefore = result.previousState.players.find((player) => player.id === result.actorPlayerId);
      const actorAfter = result.newState.players.find((player) => player.id === result.actorPlayerId);
      const drawCount = Math.max(1, (actorAfter?.hand.length ?? 0) - (actorBefore?.hand.length ?? 0));
      emitDrawCardFx(io, roomId, {
        playerId: result.actorPlayerId,
        userId: result.actorUserId,
        playerName: result.actorPlayerName,
        drawCount,
        startAt: Date.now() + 90,
      });
    }

    detectAndBroadcastBlackbirdEvents(io, roomId, result.previousState, result.newState);
    emitStateTransitionFx(io, roomId, result.previousState, result.newState, result.actorPlayerId);
    broadcastFilteredState(io, roomId, result.newState);
    checkAndScheduleBotTurn(io, roomId, result.newState);

    if (result.newState.phase === "round_end" && result.previousState.phase !== "round_end") {
      handleRoundEndBotReady(io, roomId, result.newState);
    }
  } catch (error: any) {
    console.error(`[socket] Bot turn error in room ${roomId}:`, error.message);
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
    if (ENV.enableAutoDrawForDisconnectedPlayers) {
      scheduleDisconnectedPlayerTimeout(io, roomId, state, currentPlayer);
    }
  }
}

/**
 * If the current human player is disconnected, auto-draw after 8 seconds.
 */
function scheduleDisconnectedPlayerTimeout(io: SocketIOServer, roomId: number, state: GameState, player: Player) {
  if (!isUserConnectedInRoom(roomId, player.userId)) {
    console.log(`[socket] Player ${player.username} (userId: ${player.userId}) is disconnected and it's their turn. Auto-draw in 8s.`);
    const timeout = setTimeout(() => {
      void (async () => {
      turnTimeouts.delete(roomId);
      try {
        const result = await withRoomMutation(roomId, async () => {
          const currentState = await realtimeStore.getGameState(roomId);
          if (!currentState || currentState.phase !== "playing") return null;

          const currentTurnPlayer = currentState.players[currentState.currentPlayerIndex];
          if (!currentTurnPlayer || currentTurnPlayer.id !== player.id) return null;
          if (isUserConnectedInRoom(roomId, player.userId)) return null;

          console.log(`[socket] Auto-drawing for disconnected player ${player.username}`);
          const newState = processAction(currentState, { type: "DRAW_CARD" }, player.id);
          await realtimeStore.setGameState(roomId, newState);
          return {
            previousState: currentState,
            newState,
            actorPlayerId: player.id,
            actorUserId: player.userId,
            actorPlayerName: player.username,
          };
        });

        if (!result) return;

        const actorBefore = result.previousState.players.find((entry) => entry.id === result.actorPlayerId);
        const actorAfter = result.newState.players.find((entry) => entry.id === result.actorPlayerId);
        const drawCount = Math.max(1, (actorAfter?.hand.length ?? 0) - (actorBefore?.hand.length ?? 0));
        emitDrawCardFx(io, roomId, {
          playerId: result.actorPlayerId,
          userId: result.actorUserId,
          playerName: result.actorPlayerName,
          drawCount,
          startAt: Date.now() + 80,
        });
        detectAndBroadcastBlackbirdEvents(io, roomId, result.previousState, result.newState);
        emitStateTransitionFx(io, roomId, result.previousState, result.newState, result.actorPlayerId);
        broadcastFilteredState(io, roomId, result.newState);
        checkAndScheduleBotTurn(io, roomId, result.newState);

        if (result.newState.phase === "round_end" && result.previousState.phase !== "round_end") {
          handleRoundEndBotReady(io, roomId, result.newState);
        }
      } catch (error: any) {
        console.error(`[socket] Auto-draw error for ${player.username}:`, error.message);
      }
      })();
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
  if (ENV.enableBots && ENV.enableAutoReadyOnRoundEnd) {
    const botPlayers = newState.players.filter(p => !p.isEliminated && p.userId < 0 && !p.isReady);
    botPlayers.forEach((bot) => {
      const delay = 300 + Math.random() * 500;
      setTimeout(() => {
        void (async () => {
          try {
            const result = await withRoomMutation(roomId, async () => {
              const currentState = await realtimeStore.getGameState(roomId);
              if (!currentState || currentState.phase !== "round_end") return null;
              const updatedState = processAction(currentState, { type: "READY" }, bot.id);
              await realtimeStore.setGameState(roomId, updatedState);
              return { previousState: currentState, updatedState };
            });
            if (!result) return;
            if (result.updatedState.phase === "playing" && result.previousState.phase === "round_end") {
              detectAndBroadcastBlackbirdEvents(io, roomId, result.previousState, result.updatedState);
            }
            emitStateTransitionFx(io, roomId, result.previousState, result.updatedState, bot.id);
            broadcastFilteredState(io, roomId, result.updatedState);
            console.log(`[socket] Bot ${bot.username} auto-READY in room ${roomId}`);
          } catch (error) {
            console.error(`[socket] Bot-READY error:`, error);
          }
        })();
      }, delay);
    });
  }

  // Auto-READY disconnected human players after 3 seconds
  if (ENV.enableAutoReadyOnRoundEnd) {
    const humanPlayers = newState.players.filter(p => !p.isEliminated && p.userId >= 0 && !p.isReady);
    humanPlayers.forEach((human) => {
      setTimeout(() => {
        void (async () => {
        try {
          const result = await withRoomMutation(roomId, async () => {
            const currentState = await realtimeStore.getGameState(roomId);
            if (!currentState || currentState.phase !== "round_end") return null;
            if (isUserConnectedInRoom(roomId, human.userId)) return null;
            const player = currentState.players.find(p => p.id === human.id);
            if (!player || player.isReady) return null;
            const updatedState = processAction(currentState, { type: "READY" }, human.id);
            await realtimeStore.setGameState(roomId, updatedState);
            return { previousState: currentState, updatedState };
          });
          if (!result) return;
          if (result.updatedState.phase === "playing" && result.previousState.phase === "round_end") {
            detectAndBroadcastBlackbirdEvents(io, roomId, result.previousState, result.updatedState);
          }
          emitStateTransitionFx(io, roomId, result.previousState, result.updatedState, human.id);
          broadcastFilteredState(io, roomId, result.updatedState);
          console.log(`[socket] Auto-READY for disconnected player ${human.username} in room ${roomId}`);
        } catch (error) {
          console.error(`[socket] Auto-READY error for disconnected player:`, error);
        }
        })();
      }, 3000);
    });
  }

  // Failsafe: Nach 5 Sekunden automatisch NEXT_ROUND
  if (ENV.enableAutoNextRound) {
    setTimeout(() => {
      void (async () => {
      try {
        const result = await withRoomMutation(roomId, async () => {
          const currentState = await realtimeStore.getGameState(roomId);
          if (!currentState || currentState.phase !== "round_end") return null;
          const nonEliminated = currentState.players.filter(p => !p.isEliminated);
          const allReady = nonEliminated.every(p => p.isReady);
          if (!allReady || nonEliminated.length === 0) return null;
          const actorPlayerId = nonEliminated[0].id;
          const updatedState = processAction(currentState, { type: "NEXT_ROUND" }, actorPlayerId);
          await realtimeStore.setGameState(roomId, updatedState);
          return { previousState: currentState, updatedState, actorPlayerId };
        });
        if (!result) return;
        detectAndBroadcastBlackbirdEvents(io, roomId, result.previousState, result.updatedState);
        emitStateTransitionFx(io, roomId, result.previousState, result.updatedState, result.actorPlayerId);
        broadcastFilteredState(io, roomId, result.updatedState);
        checkAndScheduleBotTurn(io, roomId, result.updatedState);
        console.log(`[socket] Failsafe triggered NEXT_ROUND in room ${roomId}`);
      } catch (error) {
        console.error(`[socket] Failsafe NEXT_ROUND error:`, error);
      }
      })();
    }, 5000);
  }
}

/**
 * Filter game state for a specific player:
 * - Own hand: full card data
 * - Other players' hands: replaced with dummy cards (preserves hand.length)
 * - Deck: replaced with dummy cards (preserves deck.length)
 */
function filterStateForPlayer(state: GameState, userId: number): GameState {
  const filtered: GameState = {
    ...state,
    playableCardIds: [],
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

  if (state.phase !== "playing") {
    return filtered;
  }

  const player = state.players.find((p) => p.userId === userId);
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!player || !currentPlayer || currentPlayer.id !== player.id) {
    return filtered;
  }
  if (state.discardPile.length === 0) {
    return filtered;
  }

  const effectiveTop = getEffectiveTopCard(state.discardPile);
  filtered.playableCardIds = player.hand
    .filter((card) =>
      canPlayCard(card, effectiveTop, state.currentWishSuit, state.drawChainCount, state.openingFreePlay).isValid
    )
    .map((card) => card.id);

  return filtered;
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
  if (!ENV.enableBlackbirdEvents) return;
  const events: Array<Omit<BlackbirdEventPayload, "id" | "emittedAt">> = [];

  const oldDiscardLen = oldState.discardPile.length;
  const newDiscardLen = newState.discardPile.length;
  const newTopCard = newState.discardPile[newState.discardPile.length - 1];
  const actor = newState.players.find((p) => {
    const oldP = oldState.players.find((op) => op.id === p.id);
    if (!oldP) return false;
    return oldP.hand.length - p.hand.length === 1;
  });

  // New card was played
  if (newDiscardLen > oldDiscardLen && newTopCard) {
    // Detect seven played (client uses this for synchronized impact FX)
    if (newTopCard.rank === "7") {
      events.push({
        type: "seven_played",
        drawChainCount: newState.drawChainCount,
        spotlightUserId: actor?.userId,
        spotlightPlayerName: actor?.username,
      });
    }

    // Detect Ass played
    if (newTopCard.rank === "ass") {
      events.push({
        type: "ass",
        spotlightUserId: actor?.userId,
        spotlightPlayerName: actor?.username,
      });
    }

    // Detect Unter (Bube) with wish suit
    if (newTopCard.rank === "bube" && newState.currentWishSuit) {
      events.push({
        type: "unter",
        wishSuit: newState.currentWishSuit,
        spotlightUserId: actor?.userId,
        spotlightPlayerName: actor?.username,
      });
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
          events.push({
            type: "winner",
            playerName: finishedPlayer.username,
            spotlightUserId: finishedPlayer.userId,
            spotlightPlayerName: finishedPlayer.username,
            intensity: 4,
          });
        }
      }
    }
  }

  // Detect 7er-Kette escalation (4+ cards in chain)
  if (newState.drawChainCount >= 4 && newState.drawChainCount > oldState.drawChainCount) {
    events.push({
      type: "draw_chain",
      drawChainCount: newState.drawChainCount,
      spotlightUserId: actor?.userId,
      spotlightPlayerName: actor?.username,
    });
  }

  // Detect round start (new round began)
  if (newState.phase === "playing" && oldState.phase === "round_end" && newState.roundNumber > oldState.roundNumber) {
    events.push({
      type: "round_start",
      intensity: 3,
      statsText: `Runde ${newState.roundNumber}`,
    });

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
      events.push({
        type: "loser",
        playerName: loserName,
        spotlightPlayerName: loserName,
        intensity: 4,
      });
      events.push({
        type: "mvp",
        statsText: `Max Chain: ${Math.max(0, oldState.drawChainCount, newState.drawChainCount)} • Runde ${newState.roundNumber}`,
        spotlightPlayerName: actor?.username || loserName,
        intensity: 5,
      });
    }
  }

  emitBlackbirdEvents(io, roomId, events);
  for (const event of events) {
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

    if (userId !== undefined) {
      // Send filtered state for this specific player
      targetSocket.emit("game-state-update", filterStateForPlayer(state, userId));
    } else {
      // Fallback: send state with all hands hidden (spectator/unknown)
      targetSocket.emit("game-state-update", filterStateForPlayer(state, -999));
    }
  }
}

export function setupGameSocket(httpServer: HTTPServer) {
  const { isAllowedOrigin } = createCorsOriginMatcher();

  const io = new SocketIOServer(httpServer, {
    path: "/api/socket.io",
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin || undefined)) {
          callback(null, true);
          return;
        }
        telemetry.inc("cors.blocked.socket");
        const key = (origin || "unknown").toLowerCase();
        if (!blockedSocketOrigins.has(key)) {
          blockedSocketOrigins.add(key);
          console.warn(`[cors] Blocked socket origin: ${origin || "(none)"}`);
        }
        callback(new Error("Origin not allowed by CORS"));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const bearerToken =
        (typeof socket.handshake.auth?.token === "string" && socket.handshake.auth.token) ||
        (typeof socket.handshake.headers.authorization === "string"
          ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, "")
          : undefined);

      if (bearerToken) {
        const { verifyToken } = await import("./auth-helpers");
        const jwtPayload = await verifyToken(bearerToken);
        if (jwtPayload) {
          const dbUser = await db.getUserById(jwtPayload.userId);
          if (dbUser) {
            socket.data.auth = { userId: jwtPayload.userId, role: dbUser.role ?? "user" };
            next();
            return;
          }
          if (!ENV.isProduction) {
            // Development-only fallback to keep local socket tests working without DB.
            socket.data.auth = { userId: jwtPayload.userId, role: "user" };
            next();
            return;
          }
          telemetry.inc("auth.socket.jwt_user_missing");
          next(new Error("Unauthorized socket connection"));
          return;
        }
      }

      const req = {
        headers: {
          ...socket.handshake.headers,
          authorization: bearerToken ? `Bearer ${bearerToken}` : socket.handshake.headers.authorization,
        },
      } as any;

      const user = await sdk.authenticateRequest(req);
      socket.data.auth = { userId: user.id, role: user.role };
      next();
    } catch (error) {
      telemetry.inc("auth.socket.denied");
      next(new Error("Unauthorized socket connection"));
    }
  });

  const emitJoinFailed = (socket: Socket, message: string, code?: string) => {
    socket.emit("join-failed", { message, code });
    socket.emit("error", { message });
  };

  const emitPreparationForRoom = (roomId: number, prep: PendingPreparation) => {
    io.to(`room-${roomId}`).emit("game-preparation", toPreparationPayload(prep));
  };

  const clearSeatSelectionFailsafe = (roomId: number) => {
    const timeout = seatSelectionFailsafeTimeouts.get(roomId);
    if (timeout) {
      clearTimeout(timeout);
      seatSelectionFailsafeTimeouts.delete(roomId);
    }
  };

  const scheduleSeatSelectionFailsafe = (roomId: number) => {
    clearSeatSelectionFailsafe(roomId);
    const timeout = setTimeout(() => {
      void withRoomMutation(roomId, async () => {
        const gameState = await realtimeStore.getGameState(roomId);
        const prepRaw = await realtimeStore.getPreparation(roomId);
        const prep = prepRaw as PendingPreparation | undefined;
        if (!gameState || !prep || prep.phase !== "seat_selection") {
          return;
        }
        if (prep.seatChoices.length >= gameState.players.length) {
          return;
        }

        const usedSeats = new Set(prep.seatChoices.map((s) => s.seatPosition));
        const freeSeats = shuffleArray(
          Array.from({ length: gameState.players.length }, (_, i) => i).filter((seat) => !usedSeats.has(seat)),
        );
        const remainingUserIds = prep.seatPickOrderUserIds
          .slice(prep.seatChoices.length)
          .filter((uid) => !prep.seatChoices.some((choice) => choice.userId === uid));

        for (let i = 0; i < remainingUserIds.length && i < freeSeats.length; i++) {
          prep.seatChoices.push({ userId: remainingUserIds[i], seatPosition: freeSeats[i] });
        }
        prep.currentPickerUserId = prep.seatPickOrderUserIds[prep.seatChoices.length] ?? null;

        console.warn(
          `[socket] Seat selection failsafe applied for room ${roomId}: auto-assigned ${remainingUserIds.length} seat(s)`,
        );
        telemetry.inc("preparation.seat_failsafe_applied");

        await tryAutoPickBotSeats(roomId, prep, gameState);
        if (prep.seatChoices.length === gameState.players.length) {
          await finalizePreparation(roomId, gameState, prep);
        } else {
          await realtimeStore.setPreparation(roomId, prep);
          emitPreparationForRoom(roomId, prep);
          scheduleSeatSelectionFailsafe(roomId);
        }
      });
    }, SEAT_SELECTION_FAILSAFE_MS);
    seatSelectionFailsafeTimeouts.set(roomId, timeout);
  };

  const tryAutoPickBotSeats = async (roomId: number, prep: PendingPreparation, gameState: GameState) => {
    while (prep.phase === "seat_selection" && prep.currentPickerUserId !== null && prep.currentPickerUserId < 0) {
      const seatPosition = pickFirstAvailableSeat(gameState.players.length, prep.seatChoices);
      prep.seatChoices.push({ userId: prep.currentPickerUserId, seatPosition });
      const nextUserId = prep.seatPickOrderUserIds[prep.seatChoices.length] ?? null;
      prep.currentPickerUserId = nextUserId;
    }
  };

  const finalizePreparation = async (roomId: number, gameState: GameState, prep: PendingPreparation) => {
    clearSeatSelectionFailsafe(roomId);
    const sortedPlayers = applySeatChoices(gameState.players, prep.seatChoices);
    const { dealerIndex, draws: dealerDraws } = performDealerSelectionForPlayers(sortedPlayers);

    prep.phase = "dealer_selection";
    prep.dealerDraws = dealerDraws;
    prep.currentPickerUserId = null;
    await realtimeStore.setPreparation(roomId, prep);
    emitPreparationForRoom(roomId, prep);

    const startedState = startGame({
      ...gameState,
      players: sortedPlayers,
      dealerIndex,
    });

    await roomManager.updateRoomStatus(roomId, "playing");
    await realtimeStore.setGameState(roomId, startedState);

    setTimeout(() => {
      void (async () => {
        const stillPending = await realtimeStore.getPreparation(roomId);
        if (!stillPending || stillPending.phase !== "dealer_selection") return;
        await realtimeStore.deletePreparation(roomId);
        const currentState = await realtimeStore.getGameState(roomId);
        if (currentState) {
          broadcastFilteredState(io, roomId, currentState);
          checkAndScheduleBotTurn(io, roomId, currentState);
        }
      })();
    }, 5200);
  };

  io.on("connection", (socket: Socket) => {
    const socketAuth = getSocketAuth(socket);
    if (!socketAuth) {
      socket.emit("error", { message: "Unauthorized socket session" });
      socket.disconnect(true);
      return;
    }

    const authenticatedUserId = socketAuth.userId;
    console.log(`[socket] Client connected: ${socket.id}`);
    telemetry.inc("sockets.connected");

    // Reconnect to a game room
    socket.on(
      "reconnect-room",
      async (data: { userId?: number; roomCode?: string; roomId?: number; playerId?: number; username?: string }) => {
      try {
        await withUserMutation(authenticatedUserId, async () => {
          if (isRateLimited(socket.id, "reconnect-room", 10, 10_000)) {
            socket.emit("error", { message: "Too many reconnect attempts" });
            return;
          }

          const userId = authenticatedUserId;
          const requestedRoomId = parsePositiveInt(data.roomId);
          const requestedPlayerId = parsePositiveInt(data.playerId);
          const requestedRoomCode = normalizeRoomCode(data.roomCode);

          console.log(
            `[socket] reconnect-room request userId=${userId} socketId=${socket.id} roomCode=${requestedRoomCode ?? "-"} roomId=${requestedRoomId ?? "-"} playerId=${requestedPlayerId ?? "-"}`,
          );

          // Track socket → user mapping
          socketUserMapping.set(socket.id, userId);

          // Check if user has an active session mapping.
          let roomId = await realtimeStore.getUserRoom(userId);
          let gameState = roomId ? await getGameStateWithRetry(roomId) : undefined;

          // Recovery fallback 1: roomId + playerId hint from client.
          if ((!roomId || !gameState) && requestedRoomId) {
            const stateByRoomId = await getGameStateWithRetry(requestedRoomId, 3, 120);
            if (stateByRoomId) {
              const playerByUser = stateByRoomId.players.find((p) => p.userId === userId);
              const playerIdMatches = !requestedPlayerId || playerByUser?.id === requestedPlayerId;
              if (playerByUser && playerIdMatches) {
                roomId = requestedRoomId;
                gameState = stateByRoomId;
                await realtimeStore.setUserRoom(userId, requestedRoomId);
                telemetry.inc("rooms.reconnect_mapping_recovered.room_id");
              }
            }
          }

          // Recovery fallback 2: roomCode from client storage.
          if ((!roomId || !gameState) && requestedRoomCode) {
            const fallbackRoom = await getRoomByCodeWithRetry(requestedRoomCode, 3, 120);
            if (fallbackRoom) {
              const fallbackState = await getGameStateWithRetry(fallbackRoom.id, 3, 120);
              const isMember = Boolean(fallbackState?.players.some((p) => p.userId === userId));
              if (fallbackState && isMember) {
                roomId = fallbackRoom.id;
                gameState = fallbackState;
                await realtimeStore.setUserRoom(userId, roomId);
                telemetry.inc("rooms.reconnect_mapping_recovered");
              }
            }
          }

          // Recovery fallback 3: full authoritative scan.
          if (!roomId || !gameState) {
            const authoritative = await getAuthoritativeUserSession(userId);
            if (authoritative) {
              roomId = authoritative.roomId;
              gameState = authoritative.state;
              if (requestedRoomCode && authoritative.state.roomCode !== requestedRoomCode) {
                telemetry.inc("rooms.reconnect_hint_mismatch");
                console.warn(
                  `[socket] reconnect-room hint mismatch userId=${userId}: requestedCode=${requestedRoomCode}, authoritativeCode=${authoritative.state.roomCode}`,
                );
              }
            } else if (!gameState) {
              // Avoid keeping a stale roomId hint from old mappings when no
              // authoritative membership can be recovered anymore.
              roomId = undefined;
            }
          }

          if (!roomId) {
            socket.emit("error", { message: "No active session found" });
            console.warn(`[socket] reconnect-room rejected userId=${userId}: no active session`);
            return;
          }

          // Check if game still exists
          gameState = gameState ?? (await getGameStateWithRetry(roomId));
          if (!gameState) {
            const roomStillExists = await roomManager.getRoomById(roomId).catch(() => null);
            if (!roomStillExists) {
              await clearUserRoomMappingIfMatches(userId, roomId);
              socket.emit("error", { message: "Game no longer exists" });
            } else {
              socket.emit("error", { message: "Session temporarily unavailable. Please retry." });
            }
            return;
          }
          const playerInState = gameState.players.find((p) => p.userId === userId);
          if (!playerInState) {
            await clearUserRoomMappingIfMatches(userId, roomId);
            socket.emit("error", { message: "Player not found in game" });
            return;
          }

          // Cancel disconnect timeout
          const timeout = disconnectTimeouts.get(userId);
          if (timeout) {
            clearTimeout(timeout);
            disconnectTimeouts.delete(userId);
            console.log(`[socket] Cancelled disconnect timeout for user ${userId}`);
          }

          // Rejoin socket room (single tracked room per socket)
          attachSocketToTrackedRoom(socket, roomId);
          evictDuplicateUserSocketsInRoom(io, roomId, userId, socket.id);
          cancelRoomCleanup(roomId);
          await realtimeStore.setUserRoom(userId, roomId);

          // If preparation is pending, send preparation data to reconnected player
          const prepData = await realtimeStore.getPreparation(roomId);
          if (prepData) {
            socket.emit("game-preparation", toPreparationPayload(prepData as PendingPreparation));
            console.log(`[socket] Sent pending preparation data to reconnected user ${userId}`);
          }

          // Send filtered game state to reconnected player
          socket.emit("game-state-update", filterStateForPlayer(gameState, userId));
          socket.emit("room-joined", {
            roomId,
            roomCode: gameState.roomCode,
            maxPlayers: gameState.maxPlayers ?? 5,
          });
          replayGameFxEventsForSocket(socket, roomId);
          replayBlackbirdEventsForSocket(socket, roomId);

          // Send chat history
          try {
            const chatHistory = await db.getRoomChatMessages(roomId);
            socket.emit("chat:history", chatHistory);
            socket.emit("chat-history", chatHistory);
          } catch (e) {
            console.error("[socket] Error sending chat history on reconnect:", e);
          }

          console.log(`[socket] User ${userId} reconnected to room ${roomId}`);
          telemetry.inc("rooms.reconnect_success");

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
        });
      } catch (error) {
        console.error("[socket] Error reconnecting:", error);
        telemetry.inc("errors.reconnect_room");
        socket.emit("error", { message: "Failed to reconnect" });
      }
    });

    // Create a new game room
    socket.on("create-room", async (data: { userId?: number; username: string; maxPlayers?: number; isPrivate?: boolean }) => {
      try {
        await withUserMutation(authenticatedUserId, async () => {
          if (isRateLimited(socket.id, "create-room", 3, 10_000)) {
            socket.emit("error", { message: "Too many room create attempts" });
            return;
          }

          const userId = authenticatedUserId;
          const safeUsername = sanitizeUsername(data.username);
          if (!safeUsername) {
            socket.emit("error", { message: "Invalid username" });
            return;
          }
          const maxPlayers = typeof data.maxPlayers === "number" ? data.maxPlayers : 5;
          const isPrivate = data.isPrivate === true;
          if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 6) {
            socket.emit("error", { message: "Invalid maxPlayers value" });
            return;
          }

          console.log(
            `[socket] create-room request userId=${userId} socketId=${socket.id} username=${safeUsername} maxPlayers=${maxPlayers} isPrivate=${isPrivate}`,
          );

          const authoritativeSession = await getAuthoritativeUserSession(userId);
          if (authoritativeSession) {
            const existingPlayer = authoritativeSession.state.players.find((player) => player.userId === userId);
            const canReuseExistingHostRoom = Boolean(
              existingPlayer &&
              authoritativeSession.state.hostUserId === userId &&
              authoritativeSession.state.phase === "waiting",
            );

            if (!canReuseExistingHostRoom) {
              socket.emit("error", { message: "User already has an active room session" });
              return;
            }

            socketUserMapping.set(socket.id, userId);
            attachSocketToTrackedRoom(socket, authoritativeSession.roomId);
            evictDuplicateUserSocketsInRoom(io, authoritativeSession.roomId, userId, socket.id);
            cancelRoomCleanup(authoritativeSession.roomId);
            await realtimeStore.setUserRoom(userId, authoritativeSession.roomId);

            socket.emit("room-created", {
              roomId: authoritativeSession.roomId,
              roomCode: authoritativeSession.state.roomCode,
              maxPlayers: authoritativeSession.state.maxPlayers ?? 5,
            });
            socket.emit("game-state-update", filterStateForPlayer(authoritativeSession.state, userId));
            broadcastFilteredState(io, authoritativeSession.roomId, authoritativeSession.state);
            telemetry.inc("rooms.create_idempotent_reused");
            console.log(
              `[socket] create-room idempotent reuse userId=${userId} roomId=${authoritativeSession.roomId} roomCode=${authoritativeSession.state.roomCode}`,
            );
            return;
          }

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
            isPrivate,
          });

          const roomId = newRoom.id;
          const avatarUrl = await getUserAvatarUrl(userId);

          // Erstelle GameState
          const player: Player = {
            id: 1,
            userId,
            username: safeUsername,
            avatarUrl,
            hand: [],
            lossPoints: 0,
            isEliminated: false,
            isReady: false,
          };

          const gameState = createGameState(roomId, roomCode, [player], userId, maxPlayers);
          await realtimeStore.setGameState(roomId, gameState);

          // Join socket room (single tracked room per socket)
          attachSocketToTrackedRoom(socket, roomId);
          evictDuplicateUserSocketsInRoom(io, roomId, userId, socket.id);
          cancelRoomCleanup(roomId);

          // Track user → room mapping
          await realtimeStore.setUserRoom(userId, roomId);

          // Sende Raum-Info und GameState
          socket.emit("room-created", {
            roomId,
            roomCode,
            maxPlayers,
          });

          // Always send a direct state snapshot to the creator socket.
          // This avoids waiting-screen stalls if room broadcast delivery is delayed.
          socket.emit("game-state-update", filterStateForPlayer(gameState, userId));
          broadcastFilteredState(io, roomId, gameState);

          console.log(`[socket] Room created: ${roomCode} (${roomId}) by ${safeUsername} (${userId})`);
          telemetry.inc("rooms.created");
        });
      } catch (error) {
        console.error("[socket] Error creating room:", error);
        telemetry.inc("errors.create_room");
        socket.emit("error", { message: "Failed to create room" });
      }
    });

    // Join a game room
    socket.on("join-room", async (data: { roomCode: string; userId?: number; username: string }) => {
      try {
        await withUserMutation(authenticatedUserId, async () => {
          if (isRateLimited(socket.id, "join-room", 12, 10_000)) {
            emitJoinFailed(socket, "Too many join attempts", "RATE_LIMIT");
            return;
          }

          const userId = authenticatedUserId;
          const roomCode = normalizeRoomCode(data.roomCode);
          const username = sanitizeUsername(data.username);
          if (!roomCode) {
            emitJoinFailed(socket, "Invalid room code", "INVALID_ROOM_CODE");
            return;
          }
          if (!username) {
            emitJoinFailed(socket, "Invalid username", "INVALID_USERNAME");
            return;
          }

          console.log(
            `[socket] join-room request userId=${userId} socketId=${socket.id} roomCode=${roomCode} username=${username}`,
          );

          // Track socket → user mapping
          socketUserMapping.set(socket.id, userId);

          const authoritativeSession = await getAuthoritativeUserSession(userId);

          // Find room
          const room = await getRoomByCodeWithRetry(roomCode, 4, 140);
          if (!room) {
            emitJoinFailed(socket, "Room not found", "ROOM_NOT_FOUND");
            return;
          }

          const roomId = room.id;
          if (authoritativeSession && authoritativeSession.roomId !== roomId) {
            emitJoinFailed(socket, "User already in another active room", "USER_IN_OTHER_ROOM");
            console.warn(
              `[socket] join-room rejected userId=${userId} requestedRoomId=${roomId} existingRoomId=${authoritativeSession.roomId}`,
            );
            return;
          }

          const avatarUrl = await getUserAvatarUrl(userId);
          const gameState = await withRoomMutation(roomId, async () => {
            const pendingTimeout = disconnectTimeouts.get(userId);
            if (pendingTimeout) {
              clearTimeout(pendingTimeout);
              disconnectTimeouts.delete(userId);
              console.log(`[socket] Cancelled disconnect timeout for rejoining user ${userId}`);
            }

            let currentState = await getGameStateWithRetry(roomId, 4, 120);

            if (!currentState) {
              const roomCreatedAtMs = new Date(room.createdAt as unknown as string | number | Date).getTime();
              const roomAgeMs = Number.isFinite(roomCreatedAtMs) ? Date.now() - roomCreatedAtMs : 0;
              const trackedSocketCount = roomSockets.get(roomId)?.size ?? 0;

              // Stale DB rooms can survive process restarts while realtime state is gone.
              // Clean these up once they are clearly old and inactive, then report ROOM_NOT_FOUND.
              if (roomAgeMs > 10_000 && trackedSocketCount === 0) {
                await roomManager.deleteRoom(roomId).catch((cleanupError) => {
                  console.warn(`[socket] Failed stale room cleanup for room ${roomId}:`, cleanupError);
                });
                telemetry.inc("rooms.stale_db_room_cleaned");
                throw new Error("Room not found");
              }

              // Keep transient-store errors distinguishable from invalid room codes.
              throw new Error("Session temporarily unavailable. Please retry.");
            }

            const existingPlayer = currentState.players.find((p) => p.userId === userId);
            if (!existingPlayer) {
              if (currentState.phase !== "waiting") {
                throw new Error("Game already in progress");
              }

              const maxPlayers = currentState.maxPlayers ?? room.maxPlayers ?? 5;
              if (currentState.players.length >= maxPlayers) {
                throw new Error("Room is full");
              }

              const newPlayer: Player = {
                id: getNextPlayerId(currentState.players),
                userId,
                username,
                avatarUrl,
                hand: [],
                lossPoints: 0,
                isEliminated: false,
                isReady: false,
              };

              currentState = {
                ...currentState,
                players: [...currentState.players, newPlayer],
              };
              await realtimeStore.setGameState(roomId, currentState);
              return currentState;
            }

            if ((existingPlayer.username !== username && username) || existingPlayer.avatarUrl !== avatarUrl) {
              currentState = {
                ...currentState,
                players: currentState.players.map(p =>
                  p.userId === userId ? { ...p, username, avatarUrl } : p
                ),
              };
              await realtimeStore.setGameState(roomId, currentState);
              console.log(`[socket] Updated profile for user ${userId}: ${existingPlayer.username} -> ${username}`);
            }

            return currentState;
          });

          // Join socket room (single tracked room per socket)
          attachSocketToTrackedRoom(socket, roomId);
          evictDuplicateUserSocketsInRoom(io, roomId, userId, socket.id);
          cancelRoomCleanup(roomId);

          // Track user → room mapping for reconnect
          await realtimeStore.setUserRoom(userId, roomId);

          // Send chat history
          try {
            const chatHistory = await db.getRoomChatMessages(roomId);
            socket.emit("chat:history", chatHistory);
            socket.emit("chat-history", chatHistory);
          } catch (e) {
            console.error("[socket] Error sending chat history:", e);
          }

          const prepData = await realtimeStore.getPreparation(roomId);
          if (prepData) {
            socket.emit("game-preparation", toPreparationPayload(prepData as PendingPreparation));
          }

          // Broadcast updated state to all players
          broadcastFilteredState(io, roomId, gameState);
          // Always send a direct state snapshot to the joining socket.
          // This avoids waiting-screen stalls if room broadcast delivery is delayed.
          socket.emit("game-state-update", filterStateForPlayer(gameState, userId));
          socket.emit("room-joined", {
            roomId,
            roomCode,
            maxPlayers: gameState.maxPlayers ?? room.maxPlayers ?? 5,
          });
          if (gameState.phase !== "waiting") {
            replayGameFxEventsForSocket(socket, roomId);
            replayBlackbirdEventsForSocket(socket, roomId);
          }

          console.log(`[socket] User ${username} (${userId}) joined room ${roomCode} (${roomId})`);
          telemetry.inc("rooms.joined");
        });
      } catch (error) {
        console.error("[socket] Error joining room:", error);
        telemetry.inc("errors.join_room");
        const message = error instanceof Error ? error.message : "Failed to join room";
        telemetry.inc(`errors.join_room_reason.${toMetricSegment(message)}`);
        emitJoinFailed(socket, message, "JOIN_FAILED");
      }
    });

    // Add bot to room
    socket.on("add-bot", async (data: { roomId: number; userId?: number }) => {
      try {
        if (!ENV.enableBots) {
          socket.emit("error", { message: "Bots are disabled in this environment" });
          return;
        }
        if (isRateLimited(socket.id, "add-bot", 10, 10_000)) {
          socket.emit("error", { message: "Too many bot add attempts" });
          return;
        }

        const { roomId } = data;
        const userId = authenticatedUserId;
        if (!(await isUserMappedToRoom(userId, roomId))) {
          socket.emit("error", { message: "Unauthorized room access" });
          return;
        }
        const { updatedState, botName } = await withRoomMutation(roomId, async () => {
          const gameState = await realtimeStore.getGameState(roomId);
          if (!gameState) {
            throw new Error("Game not found");
          }

          if (gameState.hostUserId !== userId) {
            throw new Error("Only host can add bots");
          }

          if (gameState.phase !== "waiting") {
            throw new Error("Can only add bots in waiting phase");
          }

          const maxPlayers = gameState.maxPlayers ?? 5;
          if (gameState.players.length >= maxPlayers) {
            throw new Error("Room is full");
          }

          const botNumber = gameState.players.filter((p) => p.userId < 0).length + 1;
          const botNames = ["Alf", "Gizmo", "Yoda", "Pumuckl", "Gollum"];
          const botName = botNames[(botNumber - 1) % botNames.length];

          const bot: Player = {
            id: getNextPlayerId(gameState.players),
            userId: -botNumber,
            username: botName,
            hand: [],
            lossPoints: 0,
            isEliminated: false,
            isReady: true,
          };

          const nextState = {
            ...gameState,
            players: [...gameState.players, bot],
          };

          await realtimeStore.setGameState(roomId, nextState);
          return { updatedState: nextState, botName };
        });
        broadcastFilteredState(io, roomId, updatedState);

        console.log(`[socket] Bot ${botName} added to room ${roomId}`);
        telemetry.inc("rooms.bot_added");
      } catch (error) {
        console.error("[socket] Error adding bot:", error);
        telemetry.inc("errors.add_bot");
        socket.emit("error", { message: error instanceof Error ? error.message : "Failed to add bot" });
      }
    });

    // Game action (play card, draw card, etc.)
    socket.on("game-action", async (data: { roomId: number; playerId?: number; action: GameAction }) => {
      try {
        if (isRateLimited(socket.id, "game-action", 80, 10_000)) {
          socket.emit("error", { message: "Too many actions" });
          return;
        }

        const { roomId, action } = data;
        if (!(await isUserMappedToRoom(authenticatedUserId, roomId))) {
          socket.emit("error", { message: "Unauthorized room access" });
          return;
        }
        const result = await withRoomMutation(roomId, async () => {
          const gameState = await realtimeStore.getGameState(roomId);
          if (!gameState) {
            throw new Error("Game not found");
          }

          const player = gameState.players.find((p) => p.userId === authenticatedUserId);
          if (!player) {
            throw new Error("Player not found in game");
          }

          console.log(`[socket] Action from ${player.username}: ${action.type}`);

          if (action.type === "START_GAME") {
            if (gameState.hostUserId !== authenticatedUserId) {
              throw new Error("Only the host can start the game");
            }
            if (gameState.phase !== "waiting") {
              const prepRaw = await realtimeStore.getPreparation(roomId);
              const prep = prepRaw as PendingPreparation | undefined;
              return {
                type: "already_started" as const,
                currentState: gameState,
                preparation: prep ? toPreparationPayload(prep) : null,
              };
            }
            if (gameState.players.length < 2) {
              throw new Error("Need at least 2 players to start");
            }

            // Platzwahl-Bypass: für stabile Multiplayer-Sessions alle Sitze sofort zufällig vergeben.
            const prep = createSeatPreparation(gameState);
            assignRandomSeats(prep, gameState.players.length);
            await finalizePreparation(roomId, gameState, prep);

            return { type: "preparation" as const };
          }

          const newState = processAction(gameState, action, player.id);
          await realtimeStore.setGameState(roomId, newState);
          return { type: "state" as const, previousState: gameState, newState, actorPlayerId: player.id };
        });

        if (result.type === "preparation") {
          return;
        }
        if (result.type === "already_started") {
          if (result.preparation) {
            socket.emit("game-preparation", result.preparation);
          }
          socket.emit("game-state-update", filterStateForPlayer(result.currentState, authenticatedUserId));
          return;
        }

        const { previousState: gameState, newState, actorPlayerId } = result;
        const actorBefore = gameState.players.find((player) => player.id === actorPlayerId);
        const actorAfter = newState.players.find((player) => player.id === actorPlayerId);

        if (action.type === "PLAY_CARD") {
          const prevTop = gameState.discardPile[gameState.discardPile.length - 1];
          const newTop = newState.discardPile[newState.discardPile.length - 1];
          if (newTop && (!prevTop || prevTop.id !== newTop.id)) {
            emitCardPlayFx(io, roomId, {
              card: newTop,
              playerId: actorPlayerId,
              userId: actorAfter?.userId,
              playerName: actorAfter?.username,
              startAt: Date.now() + 150,
            });

            // Keep critical special-card feedback server-authoritative even when
            // optional blackbird events are disabled in the environment.
            if (!ENV.enableBlackbirdEvents) {
              if (newTop.rank === "ass" || newTop.rank === "bube") {
                emitGameFx(io, roomId, {
                  type: "special_card",
                  playerId: actorPlayerId,
                  userId: actorAfter?.userId,
                  playerName: actorAfter?.username,
                  specialRank: newTop.rank,
                  wishSuit: newTop.rank === "bube" ? (newState.currentWishSuit ?? undefined) : undefined,
                  startAt: Date.now() + 260,
                }, 120);
              }
              if (newTop.rank === "7") {
                emitGameFx(io, roomId, {
                  type: "draw_chain",
                  playerId: actorPlayerId,
                  userId: actorAfter?.userId,
                  playerName: actorAfter?.username,
                  drawChainCount: newState.drawChainCount,
                  startAt: Date.now() + 230,
                }, 120);
              }
            }
          }
        }
        if (action.type === "DRAW_CARD") {
          const drawCount = Math.max(1, (actorAfter?.hand.length ?? 0) - (actorBefore?.hand.length ?? 0));
          emitDrawCardFx(io, roomId, {
            playerId: actorPlayerId,
            userId: actorAfter?.userId,
            playerName: actorAfter?.username,
            drawCount,
            startAt: Date.now() + 90,
          });
        }

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
        emitStateTransitionFx(io, roomId, gameState, newState, actorPlayerId);

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
          telemetry.inc("games.ended");
          await roomManager.updateRoomStatus(roomId, "finished");
          
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
              const gameHistoryId = await db.createGameHistory({
                roomId,
                winnerId: winner?.userId ?? 0,
                totalRounds: newState.roundNumber,
                durationSeconds: 0,
              });
              
              // Save participants
              for (const player of newState.players) {
                if (player.userId < 0) continue;
                await db.createGameParticipant({
                  gameHistoryId,
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
        telemetry.inc("errors.game_action");
        socket.emit("error", { message: error.message || "Failed to process action" });
      }
    });

    // Leave room
    socket.on("leave-room", async (data: { roomId: number; playerId: number }) => {
      try {
        await withUserMutation(authenticatedUserId, async () => {
          if (isRateLimited(socket.id, "leave-room", 8, 10_000)) {
            socket.emit("error", { message: "Too many leave attempts" });
            return;
          }

          const { roomId } = data;

          // Resolve playerId from socket mapping
          const socketUserId = socketUserMapping.get(socket.id);
          if (!socketUserId) {
            socket.emit("error", { message: "Unauthorized room access" });
            return;
          }
          if (!(await isUserMappedToRoom(socketUserId, roomId))) {
            const fallbackState = await realtimeStore.getGameState(roomId);
            const existsInRoom = Boolean(fallbackState?.players.some((player) => player.userId === socketUserId));
            if (!existsInRoom) {
              socket.emit("error", { message: "Unauthorized room access" });
              return;
            }
            await realtimeStore.setUserRoom(socketUserId, roomId);
          }

          const gameStateBeforeLeave = await withRoomMutation(roomId, async () => {
            const currentState = await realtimeStore.getGameState(roomId);
            if (!currentState) return null;
            const player = currentState.players.find(p => p.userId === socketUserId);
            if (!player) return { previousState: currentState, newState: currentState, actorPlayerId: undefined as number | undefined };
            const nextState = processAction(currentState, { type: "LEAVE_GAME" }, player.id);
            await realtimeStore.setGameState(roomId, nextState);
            return { previousState: currentState, newState: nextState, actorPlayerId: player.id };
          });
          if (gameStateBeforeLeave) {
            emitStateTransitionFx(
              io,
              roomId,
              gameStateBeforeLeave.previousState,
              gameStateBeforeLeave.newState,
              gameStateBeforeLeave.actorPlayerId,
            );
            broadcastFilteredState(io, roomId, gameStateBeforeLeave.newState);
            if (gameStateBeforeLeave.newState.phase === "game_end") {
              await roomManager.updateRoomStatus(roomId, "finished");
            }
          }

          socket.leave(`room-${roomId}`);

          // Remove socket from tracking
          const sockets = roomSockets.get(roomId);
          if (sockets) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
              roomSockets.delete(roomId);
              scheduleRoomCleanup(roomId);
            }
          }

          // Clean up socket → user mapping
          socketUserMapping.delete(socket.id);

          // Clean up user → room mapping only if user has no other socket in same room
          if (socketUserId) {
            const timeout = disconnectTimeouts.get(socketUserId);
            if (timeout) {
              clearTimeout(timeout);
              disconnectTimeouts.delete(socketUserId);
            }
            if (!isUserConnectedInRoom(roomId, socketUserId)) {
              await clearUserRoomMappingIfMatches(socketUserId, roomId);
            }
          }

          console.log(`[socket] User ${socketUserId} left room ${roomId}`);
        });
      } catch (error) {
        console.error("[socket] Error leaving room:", error);
        telemetry.inc("errors.leave_room");
      }
    });

    socket.on("preparation:choose-seat", async (data: { roomId: number; seatPosition?: number; seatIndex?: number; userId?: number }) => {
      try {
        const { roomId } = data;
        const seatPosition = data.seatPosition ?? data.seatIndex;
        if (!(await isUserMappedToRoom(authenticatedUserId, roomId))) {
          // Recovery fallback: room mapping can be stale after reconnects.
          // If player exists in this room state, restore mapping and continue.
          const fallbackState = await realtimeStore.getGameState(roomId);
          const existsInRoom = !!fallbackState?.players.some((p) => p.userId === authenticatedUserId);
          if (!existsInRoom) {
            socket.emit("error", { message: "Unauthorized room access" });
            return;
          }
          await realtimeStore.setUserRoom(authenticatedUserId, roomId);
        }
        if (!Number.isInteger(seatPosition) || (seatPosition as number) < 0) {
          socket.emit("error", { message: "Invalid seat position" });
          return;
        }
        const normalizedSeatPosition = seatPosition as number;

        await withRoomMutation(roomId, async () => {
          const gameState = await realtimeStore.getGameState(roomId);
          const prepRaw = await realtimeStore.getPreparation(roomId);
          const prep = prepRaw as PendingPreparation | undefined;
          if (!gameState || !prep) {
            throw new Error("No active preparation");
          }
          if (prep.phase !== "seat_selection") {
            throw new Error("Seat selection is already finished");
          }
          if (normalizedSeatPosition >= gameState.players.length) {
            throw new Error("Seat out of range");
          }
          if (prep.seatChoices.some((s) => s.seatPosition === normalizedSeatPosition)) {
            throw new Error("Seat already taken");
          }
          if (prep.seatChoices.some((s) => s.userId === authenticatedUserId)) {
            throw new Error("Seat already chosen");
          }

          // Keep order metadata best-effort in sync, but do not hard-block local seat picks.
          const expectedPicker = prep.seatPickOrderUserIds[prep.seatChoices.length] ?? null;
          if (prep.currentPickerUserId !== expectedPicker) {
            prep.currentPickerUserId = expectedPicker;
          }

          prep.seatChoices.push({ userId: authenticatedUserId, seatPosition: normalizedSeatPosition });
          prep.currentPickerUserId = prep.seatPickOrderUserIds[prep.seatChoices.length] ?? null;
          await tryAutoPickBotSeats(roomId, prep, gameState);

          if (prep.seatChoices.length === gameState.players.length) {
            await finalizePreparation(roomId, gameState, prep);
          } else {
            await realtimeStore.setPreparation(roomId, prep);
            emitPreparationForRoom(roomId, prep);
            scheduleSeatSelectionFailsafe(roomId);
          }
        });
      } catch (error) {
        console.error("[socket] Error choosing seat:", error);
        telemetry.inc("errors.preparation_choose_seat");
        socket.emit("error", { message: error instanceof Error ? error.message : "Failed to choose seat" });
      }
    });

    // Client signals preparation animation is done
    socket.on("preparation-done", async (data: { roomId: number }) => {
      const { roomId } = data;
      if (!(await isUserMappedToRoom(authenticatedUserId, roomId))) {
        socket.emit("error", { message: "Unauthorized room access" });
        return;
      }
      const currentState = await withRoomMutation(roomId, async () => {
        const gameState = await realtimeStore.getGameState(roomId);
        const prepRaw = await realtimeStore.getPreparation(roomId);
        const prep = prepRaw as PendingPreparation | undefined;
        if (prep && prep.phase === "seat_selection" && gameState) {
          // Hard escape hatch for stuck seat-selection sessions:
          // randomize all remaining seats and proceed immediately.
          assignRandomSeats(prep, gameState.players.length);
          await finalizePreparation(roomId, gameState, prep);
        } else if (prep && prep.phase === "dealer_selection") {
          await realtimeStore.deletePreparation(roomId);
        }
        return realtimeStore.getGameState(roomId);
      });
      if (currentState) {
        broadcastFilteredState(io, roomId, currentState);
        checkAndScheduleBotTurn(io, roomId, currentState);
        console.log(`[socket] Preparation done, broadcasting game state for room ${roomId}`);
      }
    });

    // Chat: send message
    socket.on("chat:send", async (data: { roomId: number; userId?: number; username?: string; message: string }) => {
      try {
        if (isRateLimited(socket.id, "chat:send", 20, 10_000)) {
          socket.emit("error", { message: "Too many chat messages" });
          return;
        }

        const { roomId, message } = data;
        if (!(await isUserMappedToRoom(authenticatedUserId, roomId))) {
          socket.emit("error", { message: "Unauthorized room access" });
          return;
        }
        const trimmed = message.trim().slice(0, 200);
        if (!trimmed) return;

        const gameState = await realtimeStore.getGameState(roomId);
        const player = gameState?.players.find((p) => p.userId === authenticatedUserId);
        if (!player) {
          socket.emit("error", { message: "Player not found in game" });
          return;
        }

        // Persist to DB
        await db.saveChatMessage({
          roomId,
          userId: authenticatedUserId,
          username: player.username,
          message: trimmed,
        });

        // Broadcast to all in room
        const chatMsg = {
          id: Date.now(),
          roomId,
          userId: authenticatedUserId,
          username: player.username,
          message: trimmed,
          createdAt: new Date().toISOString(),
        };
        io.to(`room-${roomId}`).emit("chat:message", chatMsg);
        io.to(`room-${roomId}`).emit("chat-message", chatMsg);
        // Also emit to room:${roomId} for backwards compatibility
        io.to(`room:${roomId}`).emit("chat:message", chatMsg);
        io.to(`room:${roomId}`).emit("chat-message", chatMsg);
      } catch (error) {
        console.error("[socket] Error sending chat message:", error);
        telemetry.inc("errors.chat_send");
      }
    });

    // Admin helpers
    const clearRoomRuntimeTimers = (roomId: number) => {
      const botTimeout = botTurnTimeouts.get(roomId);
      if (botTimeout) { clearTimeout(botTimeout); botTurnTimeouts.delete(roomId); }
      const turnTimeout = turnTimeouts.get(roomId);
      if (turnTimeout) { clearTimeout(turnTimeout); turnTimeouts.delete(roomId); }
      const seatTimeout = seatSelectionFailsafeTimeouts.get(roomId);
      if (seatTimeout) { clearTimeout(seatTimeout); seatSelectionFailsafeTimeouts.delete(roomId); }
    };

    const closeSingleRoomState = async (roomId: number) => {
      clearRoomRuntimeTimers(roomId);
      blackbirdHistory.delete(roomId);
      blackbirdRuntime.delete(roomId);
      gameFxHistory.delete(roomId);
      roomFxSequences.delete(roomId);
      roomFxNextStartAt.delete(roomId);

      const sockets = roomSockets.get(roomId);
      if (sockets) {
        for (const sid of sockets) {
          const s = io.sockets.sockets.get(sid);
          if (s) s.leave(`room-${roomId}`);
          socketUserMapping.delete(sid);
        }
      }
      roomSockets.delete(roomId);

      await realtimeStore.deletePreparation(roomId);
      await realtimeStore.deleteGameState(roomId);

      const userMappings = await realtimeStore.getUserMappings();
      for (const [uid, mappedRoomId] of userMappings) {
        if (mappedRoomId === roomId) {
          const pendingDisconnect = disconnectTimeouts.get(uid);
          if (pendingDisconnect) {
            clearTimeout(pendingDisconnect);
            disconnectTimeouts.delete(uid);
          }
          await realtimeStore.deleteUserRoom(uid);
        }
      }

      try {
        await roomManager.deleteRoom(roomId);
      } catch (err) {
        console.warn(`[socket] Failed to delete room ${roomId} via roomManager:`, err);
      }
    };

    // Admin: Close all rooms
    socket.on("admin:close-all-rooms", async (_data: { username?: string }) => {
      const auth = getSocketAuth(socket);
      if (!auth || !(await hasAdminAccess(auth.userId, auth.role))) {
        socket.emit("error", { message: "Keine Berechtigung" });
        return;
      }

      console.log(`[socket] ADMIN userId=${auth.userId} closing all rooms`);
      let closedCount = 0;

      // Notify all players in all rooms
      for (const roomId of await realtimeStore.getAllRoomIds()) {
        io.to(`room-${roomId}`).emit("room-closed", { message: "Raum wurde vom Admin geschlossen" });
        clearRoomRuntimeTimers(roomId);
        closedCount++;
      }

      // Clear all in-memory state
      await realtimeStore.clearAll();
      blackbirdHistory.clear();
      blackbirdRuntime.clear();
      for (const timeout of roomCleanupTimeouts.values()) {
        clearTimeout(timeout);
      }
      roomCleanupTimeouts.clear();

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

    // Admin: Close only empty rooms (no connected sockets)
    socket.on("admin:close-empty-rooms", async (_data: { username?: string }) => {
      const auth = getSocketAuth(socket);
      if (!auth || !(await hasAdminAccess(auth.userId, auth.role))) {
        socket.emit("error", { message: "Keine Berechtigung" });
        return;
      }

      let closedCount = 0;
      const roomIds = await realtimeStore.getAllRoomIds();
      for (const roomId of roomIds) {
        const sockets = roomSockets.get(roomId);
        if (sockets && sockets.size > 0) {
          continue;
        }
        await closeSingleRoomState(roomId);
        closedCount++;
      }

      socket.emit("admin:empty-rooms-closed", { count: closedCount });
      console.log(`[socket] ADMIN: ${closedCount} empty room(s) closed by userId=${auth.userId}`);
    });

    // Disconnect
    socket.on("disconnect", () => {
      void (async () => {
      console.log(`[socket] Client disconnected: ${socket.id}`);
      telemetry.inc("sockets.disconnected");

      // Clean per-socket rate limit counters
      for (const key of eventRateLimits.keys()) {
        if (key.startsWith(`${socket.id}:`)) {
          eventRateLimits.delete(key);
        }
      }

      // Get userId from socket mapping
      const disconnectedUserId = socketUserMapping.get(socket.id);
      let disconnectedRoomId: number | undefined;
      let disconnectedRoomIds: number[] = [];

      // Clean up socket → user mapping
      socketUserMapping.delete(socket.id);

      // Remove socket from all tracked rooms. The first room is used for user timeout handling.
      disconnectedRoomIds = detachSocketFromTrackedRooms(socket);
      if (disconnectedRoomIds.length > 0) {
        disconnectedRoomId = disconnectedRoomIds[0];
      }
      if (disconnectedRoomIds.length > 1) {
        telemetry.inc("rooms.socket_multi_room_cleanup");
        console.warn(
          `[socket] Socket ${socket.id} was tracked in multiple rooms: ${disconnectedRoomIds.join(", ")}`,
        );
      }

      // If we found the user, set a 30-second timeout before removing them
      if (disconnectedUserId && disconnectedRoomId) {
        console.log(`[socket] User ${disconnectedUserId} disconnected from room ${disconnectedRoomId}, starting 30s timeout`);
        
        const roomId = disconnectedRoomId;

        // Check if it's this player's turn → schedule auto-draw
        const gameState = await realtimeStore.getGameState(roomId);
        if (gameState && gameState.phase === "playing") {
          const currentTurnPlayer = gameState.players[gameState.currentPlayerIndex];
          if (ENV.enableAutoDrawForDisconnectedPlayers && currentTurnPlayer && currentTurnPlayer.userId === disconnectedUserId) {
            scheduleDisconnectedPlayerTimeout(io, roomId, gameState, currentTurnPlayer);
          }
        }

        // Also handle if pending preparation and all human players disconnected
        if (await realtimeStore.hasPreparation(roomId)) {
          // Check if any human players are still connected
          const sockets = roomSockets.get(roomId);
          let anyHumanConnected = false;
          if (sockets) {
            for (const sid of sockets) {
              const uid = socketUserMapping.get(sid);
              if (typeof uid === "number" && uid >= 0) {
                anyHumanConnected = true;
                break;
              }
            }
          }
          if (!anyHumanConnected) {
            // No humans connected, resolve preparation immediately
            await realtimeStore.deletePreparation(roomId);
            const currentState = await realtimeStore.getGameState(roomId);
            if (currentState) {
              broadcastFilteredState(io, roomId, currentState);
              checkAndScheduleBotTurn(io, roomId, currentState);
            }
            console.log(`[socket] All humans disconnected during preparation, resolving immediately for room ${roomId}`);
          }
        }

        // If same user still has another connected socket, don't schedule a leave timeout.
        if (isUserConnectedInRoom(roomId, disconnectedUserId)) {
          console.log(`[socket] User ${disconnectedUserId} still connected via another socket in room ${roomId}`);
          return;
        }

        const existingTimeout = disconnectTimeouts.get(disconnectedUserId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          disconnectTimeouts.delete(disconnectedUserId);
        }

        const timeout = setTimeout(() => {
          void (async () => {
          console.log(`[socket] Disconnect timeout expired for user ${disconnectedUserId}`);

          try {
            const result = await withRoomMutation(roomId, async () => {
              if (isUserConnectedInRoom(roomId, disconnectedUserId)) {
                return null;
              }
              const gameState = await realtimeStore.getGameState(roomId);
              if (!gameState) return { removed: false as const };

              const player = gameState.players.find(p => p.userId === disconnectedUserId);
              if (!player) return { removed: false as const };

              const newState = processAction(gameState, { type: "LEAVE_GAME" }, player.id);
              await realtimeStore.setGameState(roomId, newState);
              return { removed: true as const, previousState: gameState, newState, actorPlayerId: player.id };
            });

            if (result && result.removed && result.newState) {
              emitStateTransitionFx(io, roomId, result.previousState, result.newState, result.actorPlayerId);
              broadcastFilteredState(io, roomId, result.newState);
              if (result.newState.phase === "game_end") {
                void roomManager.updateRoomStatus(roomId, "finished");
              }
            }
          } catch (err) {
            console.error(`[socket] Error during disconnect timeout cleanup:`, err);
          } finally {
            await clearUserRoomMappingIfMatches(disconnectedUserId!, roomId);
            disconnectTimeouts.delete(disconnectedUserId!);
          }
          })();
        }, 30000); // 30 seconds

        disconnectTimeouts.set(disconnectedUserId!, timeout as any);
      }

      // Clean up empty rooms
      for (const roomId of disconnectedRoomIds) {
        const sockets = roomSockets.get(roomId);
        if (sockets && sockets.size === 0) {
          console.log(`[socket] No more sockets in room ${roomId}, but keeping gameState for reconnect`);
          scheduleRoomCleanup(roomId);
        }
      }
      })();
    });
  });

  console.log("[socket] Game socket server initialized");
  return io;
}
