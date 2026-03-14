import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import { io as ioClient, type Socket } from "socket.io-client";
import { SignJWT } from "jose";
import { setupGameSocket } from "../server/game-socket";
import { realtimeStore } from "../server/realtime-store";
import type { Card, GameState } from "../shared/game-types";

let API_URL = "http://127.0.0.1:3000";
const SOCKET_PATH = "/api/socket.io";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-change-in-production");

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForState(
  roomId: number,
  timeoutMs = 7000,
  predicate: (state: GameState) => boolean = () => true,
): Promise<GameState> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await realtimeStore.getGameState(roomId);
    if (state && predicate(state)) return state;
    await wait(80);
  }
  throw new Error(`Timeout waiting for room state ${roomId}`);
}

function waitForEvent<T = any>(
  socket: Socket,
  event: string,
  timeoutMs = 7000,
  predicate: (payload: T) => boolean = () => true,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for event "${event}"`));
    }, timeoutMs);

    const onEvent = (payload: T) => {
      try {
        if (!predicate(payload)) return;
        cleanup();
        resolve(payload);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    const onError = (payload: { message?: string }) => {
      cleanup();
      reject(new Error(payload?.message || `Socket error while waiting for "${event}"`));
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off(event, onEvent);
      socket.off("error", onError);
    };

    socket.on(event, onEvent);
    socket.on("error", onError);
  });
}

async function createTestToken(userId: number, email: string) {
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(JWT_SECRET);
}

async function connectAuthed(userId: number, username: string) {
  const token = await createTestToken(userId, `${username}@test.local`);
  const socket = ioClient(API_URL, {
    path: SOCKET_PATH,
    transports: ["websocket", "polling"],
    auth: { token },
    reconnection: false,
  });
  await waitForEvent(socket, "connect");
  return { socket, token };
}

async function createRoom(hostSocket: Socket, userId: number, username: string) {
  hostSocket.emit("create-room", { userId, username, maxPlayers: 5, isPrivate: true });
  const roomCreated = await waitForEvent<{ roomId: number; roomCode: string }>(
    hostSocket,
    "room-created",
    7000,
  );
  const state = await waitForState(
    roomCreated.roomId,
    7000,
    (s) =>
      s.roomId === roomCreated.roomId &&
      s.roomCode === roomCreated.roomCode &&
      s.players.some((p) => p.userId === userId),
  );
  return { ...roomCreated, state };
}

async function joinRoom(socket: Socket, roomCode: string, userId: number, username: string) {
  socket.emit("join-room", { roomCode, userId, username });
  const joined = await waitForEvent<{ roomId: number; roomCode: string }>(
    socket,
    "room-joined",
    7000,
    (p) => p.roomCode === roomCode,
  );
  return waitForState(joined.roomId, 7000, (s) => s.roomCode === roomCode && s.players.some((p) => p.userId === userId));
}

async function reconnectWithHints(
  token: string,
  args: { userId: number; roomId: number; playerId: number; roomCode: string; username: string },
) {
  const socket = ioClient(API_URL, {
    path: SOCKET_PATH,
    transports: ["websocket", "polling"],
    auth: { token },
    reconnection: false,
  });
  await waitForEvent(socket, "connect");
  socket.emit("reconnect-room", args);
  await waitForEvent<{ roomId: number; roomCode: string }>(
    socket,
    "room-joined",
    7000,
    (p) => p.roomId === args.roomId && p.roomCode === args.roomCode,
  );
  const state = await waitForState(args.roomId, 7000, (s) => s.players.some((p) => p.userId === args.userId));
  return { socket, state };
}

function card(id: string, suit: Card["suit"], rank: Card["rank"]): Card {
  return { id, suit, rank };
}

function forcePlayingState(base: GameState, overrides?: Partial<GameState>): GameState {
  const deckCard = card("deck-schellen-7", "schellen", "7");
  const discard = card("discard-rot-9", "rot", "9");
  return {
    ...base,
    phase: "playing",
    hasRoundStarted: true,
    currentWishSuit: null,
    drawChainCount: 0,
    skipNextPlayer: false,
    openingFreePlay: false,
    currentPlayerIndex: 0,
    dealerIndex: 0,
    direction: "clockwise",
    deck: base.deck.length > 0 ? base.deck : [deckCard],
    discardPile: base.discardPile.length > 0 ? base.discardPile : [discard],
    players: base.players.map((p, idx) => ({
      ...p,
      hand: p.hand.length > 0 ? p.hand : [card(`p${p.id}-card-${idx}`, "eichel", "8")],
      isEliminated: false,
      isReady: true,
    })),
    ...overrides,
  };
}

describe("Reconnect resilience (loading-screen regression)", () => {
  let server: HttpServer;

  beforeAll(async () => {
    const app = express();
    server = createServer(app);
    setupGameSocket(server);
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const address = server.address() as AddressInfo;
    API_URL = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("Test 1: normales Spiel ohne Disconnect bleibt synchron", async () => {
    const host = await connectAuthed(11001, "HostA");
    const guest = await connectAuthed(11002, "GuestA");
    try {
      const room = await createRoom(host.socket, 11001, "HostA");
      const guestState = await joinRoom(guest.socket, room.roomCode, 11002, "GuestA");
      const hostUpdated = await waitForState(room.roomId, 7000, (s) => s.players.length === 2);
      expect(guestState.players.length).toBe(2);
      expect(hostUpdated.players.length).toBe(2);
    } finally {
      host.socket.disconnect();
      guest.socket.disconnect();
    }
  }, 20000);

  it("Test 2: WLAN kurz aus -> reconnect-room liefert wieder GameState", async () => {
    const host = await connectAuthed(12001, "HostB");
    const guest = await connectAuthed(12002, "GuestB");
    try {
      const room = await createRoom(host.socket, 12001, "HostB");
      const guestState = await joinRoom(guest.socket, room.roomCode, 12002, "GuestB");
      const guestPlayerId = guestState.players.find((p) => p.userId === 12002)?.id;
      expect(guestPlayerId).toBeTypeOf("number");

      guest.socket.disconnect();
      await wait(400);

      const reconnected = await reconnectWithHints(guest.token, {
        userId: 12002,
        roomId: room.roomId,
        playerId: guestPlayerId as number,
        roomCode: room.roomCode,
        username: "GuestB",
      });
      expect(reconnected.state.players.some((p) => p.userId === 12002)).toBe(true);
      reconnected.socket.disconnect();
    } finally {
      host.socket.disconnect();
      guest.socket.disconnect();
    }
  }, 20000);

  it("Test 3: App-Hintergrund (längerer Disconnect) -> reconnect-room stabil", async () => {
    const host = await connectAuthed(13001, "HostC");
    const guest = await connectAuthed(13002, "GuestC");
    try {
      const room = await createRoom(host.socket, 13001, "HostC");
      const guestState = await joinRoom(guest.socket, room.roomCode, 13002, "GuestC");
      const guestPlayerId = guestState.players.find((p) => p.userId === 13002)?.id;
      expect(guestPlayerId).toBeTypeOf("number");

      guest.socket.disconnect();
      await wait(2200);

      const reconnected = await reconnectWithHints(guest.token, {
        userId: 13002,
        roomId: room.roomId,
        playerId: guestPlayerId as number,
        roomCode: room.roomCode,
        username: "GuestC",
      });
      expect(reconnected.state.roomId).toBe(room.roomId);
      reconnected.socket.disconnect();
    } finally {
      host.socket.disconnect();
      guest.socket.disconnect();
    }
  }, 20000);

  it("Test 4: mehrere Spieler gleichzeitig bleiben im selben Zustand", async () => {
    const host = await connectAuthed(14001, "HostD");
    const p2 = await connectAuthed(14002, "Player2");
    const p3 = await connectAuthed(14003, "Player3");
    const p4 = await connectAuthed(14004, "Player4");
    try {
      const room = await createRoom(host.socket, 14001, "HostD");
      await Promise.all([
        joinRoom(p2.socket, room.roomCode, 14002, "Player2"),
        joinRoom(p3.socket, room.roomCode, 14003, "Player3"),
        joinRoom(p4.socket, room.roomCode, 14004, "Player4"),
      ]);
      const hostState = await waitForState(room.roomId, 7000, (s) => s.players.length === 4);
      expect(hostState.players.length).toBe(4);
    } finally {
      host.socket.disconnect();
      p2.socket.disconnect();
      p3.socket.disconnect();
      p4.socket.disconnect();
    }
  }, 20000);

  it("Test 5: reconnect während BotTurn bleibt stabil", async () => {
    const host = await connectAuthed(15001, "HostE");
    const guest = await connectAuthed(15002, "GuestE");
    try {
      const room = await createRoom(host.socket, 15001, "HostE");
      const guestState = await joinRoom(guest.socket, room.roomCode, 15002, "GuestE");
      const guestPlayerId = guestState.players.find((p) => p.userId === 15002)?.id;
      expect(guestPlayerId).toBeTypeOf("number");

      const current = await realtimeStore.getGameState(room.roomId);
      expect(current).toBeDefined();
      const withBot = current as GameState;
      const botPlayerId = Math.max(...withBot.players.map((p) => p.id)) + 1;
      const withSyntheticBot: GameState = {
        ...withBot,
        players: [
          ...withBot.players,
          {
            id: botPlayerId,
            userId: -15003,
            username: "BotTurn",
            hand: [card("bot-turn-card", "gruen", "8")],
            lossPoints: 0,
            isEliminated: false,
            isReady: true,
          },
        ],
      };
      const botIndex = withSyntheticBot.players.findIndex((p) => p.userId < 0);
      expect(botIndex).toBeGreaterThanOrEqual(0);

      await realtimeStore.setGameState(
        room.roomId,
        forcePlayingState(withSyntheticBot, {
          currentPlayerIndex: botIndex,
        }),
      );
      await realtimeStore.setUserRoom(15002, room.roomId);

      guest.socket.disconnect();
      await wait(500);

      const reconnected = await reconnectWithHints(guest.token, {
        userId: 15002,
        roomId: room.roomId,
        playerId: guestPlayerId as number,
        roomCode: room.roomCode,
        username: "GuestE",
      });
      const currentTurn = reconnected.state.players[reconnected.state.currentPlayerIndex];
      expect(currentTurn?.userId).toBeLessThan(0);
      expect(reconnected.state.players.some((p) => p.userId === 15002)).toBe(true);
      reconnected.socket.disconnect();
    } finally {
      host.socket.disconnect();
      guest.socket.disconnect();
    }
  }, 20000);

  it("Test 6: reconnect während Ziehkette bleibt synchron", async () => {
    const host = await connectAuthed(16001, "HostF");
    const guest = await connectAuthed(16002, "GuestF");
    try {
      const room = await createRoom(host.socket, 16001, "HostF");
      const guestState = await joinRoom(guest.socket, room.roomCode, 16002, "GuestF");
      const guestPlayerId = guestState.players.find((p) => p.userId === 16002)?.id;
      expect(guestPlayerId).toBeTypeOf("number");

      const current = await realtimeStore.getGameState(room.roomId);
      expect(current).toBeDefined();
      const forced = forcePlayingState(current as GameState, {
        drawChainCount: 4,
        discardPile: [card("chain-schellen-7", "schellen", "7")],
      });
      await realtimeStore.setGameState(room.roomId, forced);
      await realtimeStore.setUserRoom(16002, room.roomId);

      guest.socket.disconnect();
      await wait(450);

      const reconnected = await reconnectWithHints(guest.token, {
        userId: 16002,
        roomId: room.roomId,
        playerId: guestPlayerId as number,
        roomCode: room.roomCode,
        username: "GuestF",
      });
      expect(reconnected.state.drawChainCount).toBe(4);
      expect(reconnected.state.players.some((p) => p.userId === 16002)).toBe(true);
      reconnected.socket.disconnect();
    } finally {
      host.socket.disconnect();
      guest.socket.disconnect();
    }
  }, 20000);
});
