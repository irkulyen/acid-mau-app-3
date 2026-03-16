import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import { io as ioClient, type Socket } from "socket.io-client";
import { SignJWT } from "jose";
import type { BlackbirdStateEvent, GameState } from "../shared/game-types";

let API_URL = "http://127.0.0.1:3000";
const SOCKET_PATH = "/api/socket.io";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-change-in-production");
let setupGameSocketFn: ((httpServer: HttpServer) => void) | undefined;
let realtimeStoreRef: { getGameState: (roomId: number) => Promise<GameState | undefined>; setGameState: (roomId: number, state: GameState) => Promise<void> } | undefined;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForEvent<T>(
  socket: Socket,
  event: string,
  timeoutMs = 5000,
  predicate: (payload: T) => boolean = () => true,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for "${event}"`));
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

async function createToken(userId: number, email: string) {
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(JWT_SECRET);
}

async function connectAuthed(userId: number, username: string) {
  const token = await createToken(userId, `${username}@test.local`);
  const socket = ioClient(API_URL, {
    path: SOCKET_PATH,
    transports: ["websocket", "polling"],
    auth: { token },
    reconnection: false,
  });
  await waitForEvent(socket, "connect");
  return socket;
}

async function waitForRoomState(roomId: number, timeoutMs = 5000): Promise<GameState> {
  if (!realtimeStoreRef) {
    throw new Error("realtime store not initialized");
  }
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await realtimeStoreRef.getGameState(roomId);
    if (state) return state;
    await wait(60);
  }
  throw new Error("Room state timeout");
}

describe("Blackbird multiplayer sync", () => {
  let server: HttpServer;

  beforeAll(async () => {
    process.env.ENABLE_BLACKBIRD_EVENTS = "true";
    process.env.ENABLE_BOTS = process.env.ENABLE_BOTS || "false";
    const { setupGameSocket } = await import("../server/game-socket");
    const { realtimeStore } = await import("../server/realtime-store");
    setupGameSocketFn = setupGameSocket;
    realtimeStoreRef = realtimeStore;

    const app = express();
    server = createServer(app);
    setupGameSocketFn(server);
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const address = server.address() as AddressInfo;
    API_URL = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("broadcasts draw_chain blackbird events to all players in the room", async () => {
    const host = await connectAuthed(21001, "HostBrand");
    const guest = await connectAuthed(21002, "GuestBrand");
    try {
      host.emit("create-room", { userId: 21001, username: "HostBrand", maxPlayers: 5, isPrivate: true });
      const created = await waitForEvent<{ roomId: number; roomCode: string }>(host, "room-created");

      guest.emit("join-room", { roomCode: created.roomCode, userId: 21002, username: "GuestBrand" });
      await waitForEvent(guest, "room-joined", 5000, (payload: any) => payload.roomId === created.roomId);

      const baseState = await waitForRoomState(created.roomId);
      const hostPlayer = baseState.players.find((p) => p.userId === 21001);
      const guestPlayer = baseState.players.find((p) => p.userId === 21002);
      expect(hostPlayer).toBeTruthy();
      expect(guestPlayer).toBeTruthy();

      const forcedState: GameState = {
        ...baseState,
        phase: "playing",
        currentPlayerIndex: baseState.players.findIndex((p) => p.userId === 21001),
        drawChainCount: 5,
        currentWishSuit: null,
        skipNextPlayer: false,
        hasRoundStarted: true,
        openingFreePlay: false,
        players: baseState.players.map((player) => {
          if (player.userId === 21001) {
            return {
              ...player,
              hand: [
                { id: "rot-7", suit: "rot", rank: "7" },
                { id: "eichel-9", suit: "eichel", rank: "9" },
              ],
            };
          }
          return {
            ...player,
            hand: [{ id: "rot-9", suit: "rot", rank: "9" }],
          };
        }),
        deck: [
          { id: "eichel-8", suit: "eichel", rank: "8" },
          { id: "gruen-9", suit: "gruen", rank: "9" },
        ],
        discardPile: [{ id: "eichel-7", suit: "eichel", rank: "7" }],
      };
      await realtimeStoreRef!.setGameState(created.roomId, forcedState);

      const hostBlackbirdPromise = waitForEvent<BlackbirdStateEvent>(
        host,
        "blackbird-event",
        5000,
        (event) => event.type === "draw_chain",
      );
      const guestBlackbirdPromise = waitForEvent<BlackbirdStateEvent>(
        guest,
        "blackbird-event",
        5000,
        (event) => event.type === "draw_chain",
      );

      host.emit("game-action", {
        roomId: created.roomId,
        playerId: hostPlayer!.id,
        action: { type: "PLAY_CARD", cardId: "rot-7" },
      });

      const [hostEvent, guestEvent] = await Promise.all([hostBlackbirdPromise, guestBlackbirdPromise]);
      expect(hostEvent.id).toBeTruthy();
      expect(guestEvent.id).toBe(hostEvent.id);
      expect(hostEvent.type).toBe("draw_chain");
      expect(guestEvent.type).toBe("draw_chain");
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  });

  it("does not emit blackbird event for a normal card action", async () => {
    const host = await connectAuthed(22001, "HostNormal");
    const guest = await connectAuthed(22002, "GuestNormal");
    try {
      host.emit("create-room", { userId: 22001, username: "HostNormal", maxPlayers: 5, isPrivate: true });
      const created = await waitForEvent<{ roomId: number; roomCode: string }>(host, "room-created");

      guest.emit("join-room", { roomCode: created.roomCode, userId: 22002, username: "GuestNormal" });
      await waitForEvent(guest, "room-joined", 5000, (payload: any) => payload.roomId === created.roomId);

      const baseState = await waitForRoomState(created.roomId);
      const hostPlayer = baseState.players.find((p) => p.userId === 22001);
      expect(hostPlayer).toBeTruthy();

      const forcedState: GameState = {
        ...baseState,
        phase: "playing",
        currentPlayerIndex: baseState.players.findIndex((p) => p.userId === 22001),
        drawChainCount: 0,
        currentWishSuit: null,
        skipNextPlayer: false,
        hasRoundStarted: true,
        openingFreePlay: false,
        players: baseState.players.map((player) => {
          if (player.userId === 22001) {
            return {
              ...player,
              hand: [
                { id: "rot-9", suit: "rot", rank: "9" },
                { id: "eichel-8", suit: "eichel", rank: "8" },
              ],
            };
          }
          return {
            ...player,
            hand: [{ id: "gruen-9", suit: "gruen", rank: "9" }],
          };
        }),
        deck: [{ id: "eichel-7", suit: "eichel", rank: "7" }],
        discardPile: [{ id: "rot-7", suit: "rot", rank: "7" }],
      };
      await realtimeStoreRef!.setGameState(created.roomId, forcedState);

      const seenEvents: BlackbirdStateEvent[] = [];
      const onEvent = (event: BlackbirdStateEvent) => seenEvents.push(event);
      host.on("blackbird-event", onEvent);
      guest.on("blackbird-event", onEvent);

      host.emit("game-action", {
        roomId: created.roomId,
        playerId: hostPlayer!.id,
        action: { type: "PLAY_CARD", cardId: "rot-9" },
      });

      await wait(900);
      host.off("blackbird-event", onEvent);
      guest.off("blackbird-event", onEvent);

      expect(seenEvents.length).toBe(0);
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  });

  it("broadcasts round_start to all players when a new round starts", async () => {
    const host = await connectAuthed(23001, "HostRound");
    const guest = await connectAuthed(23002, "GuestRound");
    try {
      host.emit("create-room", { userId: 23001, username: "HostRound", maxPlayers: 5, isPrivate: true });
      const created = await waitForEvent<{ roomId: number; roomCode: string }>(host, "room-created");

      guest.emit("join-room", { roomCode: created.roomCode, userId: 23002, username: "GuestRound" });
      await waitForEvent(guest, "room-joined", 5000, (payload: any) => payload.roomId === created.roomId);

      const baseState = await waitForRoomState(created.roomId);
      const hostPlayer = baseState.players.find((p) => p.userId === 23001);
      expect(hostPlayer).toBeTruthy();

      const forcedState: GameState = {
        ...baseState,
        phase: "round_end",
        roundNumber: 3,
        hasRoundStarted: true,
        players: baseState.players.map((player) => ({
          ...player,
          isReady: true,
        })),
      };
      await realtimeStoreRef!.setGameState(created.roomId, forcedState);

      const hostRoundStart = waitForEvent<BlackbirdStateEvent>(
        host,
        "blackbird-event",
        5000,
        (event) => event.type === "round_start",
      );
      const guestRoundStart = waitForEvent<BlackbirdStateEvent>(
        guest,
        "blackbird-event",
        5000,
        (event) => event.type === "round_start",
      );

      host.emit("game-action", {
        roomId: created.roomId,
        playerId: hostPlayer!.id,
        action: { type: "NEXT_ROUND" },
      });

      const [hostEvent, guestEvent] = await Promise.all([hostRoundStart, guestRoundStart]);
      expect(hostEvent.id).toBeTruthy();
      expect(guestEvent.id).toBe(hostEvent.id);
      expect(hostEvent.type).toBe("round_start");
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  });

  it("broadcasts elimination sequences to all players without collisions", async () => {
    const host = await connectAuthed(24001, "HostElim");
    const guest = await connectAuthed(24002, "GuestElim");
    const third = await connectAuthed(24003, "ThirdElim");
    try {
      host.emit("create-room", { userId: 24001, username: "HostElim", maxPlayers: 5, isPrivate: true });
      const created = await waitForEvent<{ roomId: number; roomCode: string }>(host, "room-created");

      guest.emit("join-room", { roomCode: created.roomCode, userId: 24002, username: "GuestElim" });
      await waitForEvent(guest, "room-joined", 5000, (payload: any) => payload.roomId === created.roomId);
      third.emit("join-room", { roomCode: created.roomCode, userId: 24003, username: "ThirdElim" });
      await waitForEvent(third, "room-joined", 5000, (payload: any) => payload.roomId === created.roomId);

      const baseState = await waitForRoomState(created.roomId);
      const hostPlayer = baseState.players.find((p) => p.userId === 24001);
      const guestPlayer = baseState.players.find((p) => p.userId === 24002);
      expect(hostPlayer).toBeTruthy();
      expect(guestPlayer).toBeTruthy();

      const forcedState: GameState = {
        ...baseState,
        phase: "playing",
        currentPlayerIndex: baseState.players.findIndex((p) => p.userId === 24001),
        drawChainCount: 0,
        currentWishSuit: null,
        skipNextPlayer: false,
        hasRoundStarted: true,
        openingFreePlay: false,
        players: baseState.players.map((player) => {
          if (player.userId === 24001) {
            return {
              ...player,
              hand: [{ id: "rot-9", suit: "rot", rank: "9" }],
              lossPoints: 0,
              isEliminated: false,
            };
          }
          if (player.userId === 24002) {
            return {
              ...player,
              hand: [{ id: "gruen-9", suit: "gruen", rank: "9" }],
              lossPoints: 6,
              isEliminated: false,
            };
          }
          return {
            ...player,
            hand: [],
            lossPoints: 0,
            isEliminated: false,
          };
        }),
        deck: [{ id: "eichel-7", suit: "eichel", rank: "7" }],
        discardPile: [{ id: "rot-7", suit: "rot", rank: "7" }],
      };
      await realtimeStoreRef!.setGameState(created.roomId, forcedState);

      const hostElim = waitForEvent<BlackbirdStateEvent>(
        host,
        "blackbird-event",
        7000,
        (event) => event.type === "elimination",
      );
      const guestElim = waitForEvent<BlackbirdStateEvent>(
        guest,
        "blackbird-event",
        7000,
        (event) => event.type === "elimination",
      );

      host.emit("game-action", {
        roomId: created.roomId,
        playerId: hostPlayer!.id,
        action: { type: "PLAY_CARD", cardId: "rot-9" },
      });

      const [hostEvent, guestEvent] = await Promise.all([hostElim, guestElim]);
      expect(hostEvent.id).toBeTruthy();
      expect(guestEvent.id).toBe(hostEvent.id);
      expect(hostEvent.type).toBe("elimination");
      expect(hostEvent.sequenceTotal).toBeGreaterThanOrEqual(2);
      expect(hostEvent.sequenceId).toBeTruthy();
      expect(guestEvent.sequenceId).toBe(hostEvent.sequenceId);
    } finally {
      host.disconnect();
      guest.disconnect();
      third.disconnect();
    }
  });
});
