import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ioClient, Socket } from "socket.io-client";
import { SignJWT } from "jose";
import express from "express";
import { createServer, Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import { setupGameSocket } from "../server/game-socket";
import { realtimeStore } from "../server/realtime-store";

let API_URL = "http://localhost:3000";
const SOCKET_PATH = "/api/socket.io";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-change-in-production");

async function createTestToken(userId: number, email: string) {
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(JWT_SECRET);
}

describe("Multiplayer Room System", () => {
  let socket1: Socket;
  let socket2: Socket;
  let roomCode: string;
  let server: HttpServer;

  beforeAll(async () => {
    const app = express();
    server = createServer(app);
    setupGameSocket(server);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const address = server.address() as AddressInfo;
    API_URL = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (socket1) socket1.disconnect();
    if (socket2) socket2.disconnect();
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it("should create a room", async () => {
    const token = await createTestToken(1, "host@test.local");
    return new Promise<void>((resolve, reject) => {
      socket1 = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token },
      });

      socket1.on("connect", () => {
        socket1.emit("create-room", {
          userId: 1,
          username: "Host",
          maxPlayers: 6,
        });
      });

      socket1.on("room-created", (data) => {
        try {
          expect(data.roomCode).toBeDefined();
          expect(data.roomCode.length).toBe(6);
          expect(data.maxPlayers).toBe(6);
          roomCode = data.roomCode;
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      socket1.on("error", (err) => {
        reject(new Error(`Socket error: ${err.message}`));
      });
    });
  });

  it("should join an existing room", async () => {
    const token = await createTestToken(2, "guest@test.local");
    return new Promise<void>((resolve, reject) => {
      socket2 = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token },
      });

      socket2.on("connect", () => {
        socket2.emit("join-room", {
          roomCode,
          userId: 2,
          username: "Guest",
        });
      });

      socket2.on("game-state-update", (state) => {
        try {
          expect(state.players.length).toBe(2);
          expect(state.players.some((p: any) => p.username === "Host")).toBe(true);
          expect(state.players.some((p: any) => p.username === "Guest")).toBe(true);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      socket2.on("error", (err) => {
        reject(new Error(`Socket error: ${err.message}`));
      });
    });
  });

  it("should keep join idempotent when join-room is emitted twice quickly", async () => {
    const hostToken = await createTestToken(90, "idempotent-host@test.local");
    const userId = 9;
    const token = await createTestToken(userId, "doublejoin@test.local");
    return new Promise<void>((resolve, reject) => {
      const hostSocket = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token: hostToken },
      });
      const socket3 = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token },
      });

      const timeout = setTimeout(() => {
        hostSocket.disconnect();
        socket3.disconnect();
        reject(new Error("Timeout waiting for idempotent join"));
      }, 8000);

      let joinedOnce = false;
      let localRoomCode = "";
      let localRoomId = 0;

      hostSocket.on("connect", () => {
        hostSocket.emit("create-room", { userId: 90, username: "IdempotentHost", maxPlayers: 6 });
      });

      hostSocket.on("room-created", (payload) => {
        localRoomCode = payload.roomCode;
        localRoomId = payload.roomId;
      });

      socket3.on("connect", () => {
        const sendJoin = () => {
          if (!localRoomCode) {
            setTimeout(sendJoin, 50);
            return;
          }
          socket3.emit("join-room", { roomCode: localRoomCode, userId, username: "DoubleJoin" });
          socket3.emit("join-room", { roomCode: localRoomCode, userId, username: "DoubleJoin" });
        };
        sendJoin();
      });

      socket3.on("room-joined", async () => {
        if (joinedOnce) return;
        joinedOnce = true;
        try {
          await new Promise((r) => setTimeout(r, 250));
          const room = await realtimeStore.getUserRoom(userId);
          expect(room).toBe(localRoomId);
          const state = await realtimeStore.getGameState(localRoomId);
          expect(state).toBeDefined();
          const sameUserEntries = state!.players.filter((p) => p.userId === userId);
          expect(sameUserEntries.length).toBe(1);
          clearTimeout(timeout);
          hostSocket.disconnect();
          socket3.disconnect();
          resolve();
        } catch (error) {
          clearTimeout(timeout);
          hostSocket.disconnect();
          socket3.disconnect();
          reject(error);
        }
      });

      socket3.on("error", (err) => {
        clearTimeout(timeout);
        hostSocket.disconnect();
        socket3.disconnect();
        reject(new Error(`Socket error: ${err.message}`));
      });

      hostSocket.on("error", (err) => {
        clearTimeout(timeout);
        hostSocket.disconnect();
        socket3.disconnect();
        reject(new Error(`Host socket error: ${err.message}`));
      });
    });
  });

  it("should reject joining another room while user has an active room session", async () => {
    const guestUserId = 10;
    const guestToken = await createTestToken(guestUserId, "guest-active@test.local");
    const roomAHostToken = await createTestToken(101, "room-a-host@test.local");
    const roomBHostToken = await createTestToken(11, "other-host@test.local");
    return new Promise<void>((resolve, reject) => {
      const roomAHostSocket = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token: roomAHostToken },
        autoConnect: false,
      });
      const guestSocket = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token: guestToken },
        autoConnect: false,
      });
      const hostSocket = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token: roomBHostToken },
        autoConnect: false,
      });

      const cleanup = () => {
        roomAHostSocket.disconnect();
        guestSocket.disconnect();
        hostSocket.disconnect();
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout waiting for cross-room join rejection"));
      }, 10000);

      let firstRoomCode = "";

      roomAHostSocket.on("connect", () => {
        roomAHostSocket.emit("create-room", { userId: 101, username: "RoomAHost", maxPlayers: 4 });
      });

      roomAHostSocket.once("room-created", (payload) => {
        firstRoomCode = payload.roomCode;
        guestSocket.connect();
      });

      guestSocket.on("connect", () => {
        guestSocket.emit("join-room", { roomCode: firstRoomCode, userId: guestUserId, username: "ActiveGuest" });
      });

      guestSocket.once("room-joined", () => {
        hostSocket.connect();
      });

      hostSocket.on("connect", () => {
        hostSocket.emit("create-room", { userId: 11, username: "OtherHost", maxPlayers: 4 });
      });

      hostSocket.once("room-created", (secondRoomPayload) => {
        guestSocket.emit("join-room", {
          roomCode: secondRoomPayload.roomCode,
          userId: guestUserId,
          username: "ActiveGuest",
        });
      });

      guestSocket.on("join-failed", (payload) => {
        if (payload?.code !== "USER_IN_OTHER_ROOM") return;
        try {
          expect(payload.message).toBe("User already in another active room");
          clearTimeout(timeout);
          cleanup();
          resolve();
        } catch (error) {
          clearTimeout(timeout);
          cleanup();
          reject(error);
        }
      });

      guestSocket.on("error", () => {
        // join-failed is asserted above
      });

      hostSocket.on("error", (err) => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error(`Host socket error: ${err.message}`));
      });

      roomAHostSocket.on("error", (err) => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error(`RoomA host socket error: ${err.message}`));
      });

      roomAHostSocket.connect();
    });
  });

  it("should broadcast state to all players", async () => {
    const token = await createTestToken(3, "broadcast@test.local");
    return new Promise<void>((resolve, reject) => {
      const socket3 = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token },
      });

      const timer = setTimeout(() => {
        socket3.disconnect();
        reject(new Error("Timeout waiting for broadcast state"));
      }, 7000);

      socket1.once("game-state-update", (state) => {
        clearTimeout(timer);
        socket3.disconnect();
        try {
          expect(state.players.length).toBeGreaterThanOrEqual(2);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      socket3.on("connect", () => {
        socket3.emit("join-room", {
          roomCode,
          userId: 3,
          username: "BroadcastGuest",
        });
      });

      socket3.on("error", (data) => {
        clearTimeout(timer);
        socket3.disconnect();
        reject(new Error(`Socket error: ${data?.message || "unknown"}`));
      });
    });
  });

  it("should deliver synchronized game-fx events to all room members", async () => {
    let socketError: Error | null = null;
    const waitFor = async (predicate: () => boolean, timeoutMs: number, label: string) => {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        if (socketError) throw socketError;
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      throw new Error(`Timeout: ${label}`);
    };

    const hostToken = await createTestToken(201, "fx-host@test.local");
    const guestToken = await createTestToken(202, "fx-guest@test.local");
    const hostSocket = ioClient(API_URL, {
      path: SOCKET_PATH,
      transports: ["websocket", "polling"],
      auth: { token: hostToken },
      autoConnect: false,
    });
    const guestSocket = ioClient(API_URL, {
      path: SOCKET_PATH,
      transports: ["websocket", "polling"],
      auth: { token: guestToken },
      autoConnect: false,
    });

    const hostFx: any[] = [];
    const guestFx: any[] = [];
    let hostState: any = null;
    let guestState: any = null;
    let localRoomCode = "";

    const cleanup = () => {
      hostSocket.removeAllListeners();
      guestSocket.removeAllListeners();
      hostSocket.disconnect();
      guestSocket.disconnect();
    };

    try {
      hostSocket.on("game-fx", (event) => hostFx.push(event));
      guestSocket.on("game-fx", (event) => guestFx.push(event));
      hostSocket.on("game-state-update", (state) => {
        hostState = state;
      });
      guestSocket.on("game-state-update", (state) => {
        guestState = state;
      });

      hostSocket.on("connect", () => {
        hostSocket.emit("create-room", { userId: 201, username: "FxHost", maxPlayers: 4, isPrivate: true });
      });
      hostSocket.on("room-created", (payload) => {
        localRoomCode = payload.roomCode;
        if (guestSocket.disconnected) guestSocket.connect();
      });
      guestSocket.on("connect", () => {
        if (!localRoomCode) return;
        guestSocket.emit("join-room", { roomCode: localRoomCode, userId: 202, username: "FxGuest" });
      });
      hostSocket.on("error", (err) => {
        socketError = new Error(`Host socket error: ${err.message}`);
      });
      guestSocket.on("error", (err) => {
        socketError = new Error(`Guest socket error: ${err.message}`);
      });

      hostSocket.connect();

      await waitFor(() => Boolean(localRoomCode && hostState && guestState), 8000, "initial fx room state");

      const hostPlayer = hostState.players.find((p: any) => p.userId === 201);
      hostSocket.emit("game-action", {
        roomId: hostState.roomId,
        playerId: hostPlayer.id,
        action: { type: "START_GAME" },
      });

      await waitFor(
        () => hostState?.phase === "playing" && guestState?.phase === "playing",
        8000,
        "fx room playing phase",
      );

      const drawActorUserId = hostState.players[hostState.currentPlayerIndex]?.userId;
      const drawActorSocket = drawActorUserId === 201 ? hostSocket : guestSocket;
      const drawActorState = drawActorUserId === 201 ? hostState : guestState;
      const drawActorPlayer = drawActorState.players.find((p: any) => p.userId === drawActorUserId);
      const drawBaseline = Math.max(
        hostFx.filter((e) => e.type === "draw_card").length,
        guestFx.filter((e) => e.type === "draw_card").length,
      );

      drawActorSocket.emit("game-action", {
        roomId: drawActorState.roomId,
        playerId: drawActorPlayer.id,
        action: { type: "DRAW_CARD" },
      });

      await waitFor(
        () =>
          hostFx.filter((e) => e.type === "draw_card").length > drawBaseline &&
          guestFx.filter((e) => e.type === "draw_card").length > drawBaseline,
        8000,
        "draw_card fx on both sockets",
      );

      const hostDrawFx = hostFx.filter((e) => e.type === "draw_card").at(-1);
      const guestDrawFx = guestFx.filter((e) => e.type === "draw_card").at(-1);
      expect(hostDrawFx.id).toBe(guestDrawFx.id);
      expect(hostDrawFx.sequence).toBe(guestDrawFx.sequence);
      expect(hostDrawFx.roomId).toBe(guestDrawFx.roomId);

      const resolvePlayableActor = () => {
        const actorUserId = hostState.players[hostState.currentPlayerIndex]?.userId;
        if (actorUserId === 201 && (hostState.playableCardIds?.length ?? 0) > 0) {
          const card = hostState.players
            .find((p: any) => p.userId === 201)
            ?.hand?.find((c: any) => hostState.playableCardIds.includes(c.id));
          if (card) return { socket: hostSocket, state: hostState, userId: 201, card };
        }
        if (actorUserId === 202 && (guestState.playableCardIds?.length ?? 0) > 0) {
          const card = guestState.players
            .find((p: any) => p.userId === 202)
            ?.hand?.find((c: any) => guestState.playableCardIds.includes(c.id));
          if (card) return { socket: guestSocket, state: guestState, userId: 202, card };
        }
        return null;
      };

      const playableActor = resolvePlayableActor();
      if (playableActor) {
        const cardPlayBaseline = Math.max(
          hostFx.filter((e) => e.type === "card_play").length,
          guestFx.filter((e) => e.type === "card_play").length,
        );

        const actorPlayer = playableActor.state.players.find((p: any) => p.userId === playableActor.userId);
        const playAction: any = { type: "PLAY_CARD", cardId: playableActor.card.id };
        if (playableActor.card.rank === "bube") {
          // Unter requires explicit wish suit in current ruleset.
          playAction.wishSuit = "eichel";
        }
        playableActor.socket.emit("game-action", {
          roomId: playableActor.state.roomId,
          playerId: actorPlayer.id,
          action: playAction,
        });

        await waitFor(
          () =>
            hostFx.filter((e) => e.type === "card_play").length > cardPlayBaseline &&
            guestFx.filter((e) => e.type === "card_play").length > cardPlayBaseline,
          8000,
          "card_play fx on both sockets",
        );

        const hostCardPlayFx = hostFx.filter((e) => e.type === "card_play").at(-1);
        const guestCardPlayFx = guestFx.filter((e) => e.type === "card_play").at(-1);
        expect(hostCardPlayFx.id).toBe(guestCardPlayFx.id);
        expect(hostCardPlayFx.sequence).toBe(guestCardPlayFx.sequence);
        expect(hostCardPlayFx.roomId).toBe(guestCardPlayFx.roomId);
      }
    } finally {
      cleanup();
    }
  }, 20000);

  it("should prevent joining a non-existent room", async () => {
    const token = await createTestToken(4, "invalid@test.local");
    return new Promise<void>((resolve, reject) => {
      const socket3 = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token },
      });

      socket3.on("connect", () => {
        socket3.emit("join-room", {
          roomCode: "QWERTY",
          userId: 4,
          username: "InvalidUser",
        });
      });

      socket3.on("join-failed", (data) => {
        try {
          expect(data.code).toBe("ROOM_NOT_FOUND");
          expect(data.message).toBe("Room not found");
          socket3.disconnect();
          resolve();
        } catch (err) {
          socket3.disconnect();
          reject(err);
        }
      });

      setTimeout(() => {
        socket3.disconnect();
        reject(new Error("Timeout waiting for error"));
      }, 5000);
    });
  });

  it("should emit join-failed for invalid room code format", async () => {
    const token = await createTestToken(7, "badcode@test.local");
    return new Promise<void>((resolve, reject) => {
      const socket3 = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token },
      });

      const timer = setTimeout(() => {
        socket3.disconnect();
        reject(new Error("Timeout waiting for join-failed"));
      }, 5000);

      socket3.on("connect", () => {
        socket3.emit("join-room", {
          roomCode: "AB12",
          userId: 7,
          username: "InvalidCodeUser",
        });
      });

      socket3.on("join-failed", (data) => {
        clearTimeout(timer);
        try {
          expect(data.code).toBe("INVALID_ROOM_CODE");
          expect(data.message).toBe("Invalid room code");
          socket3.disconnect();
          resolve();
        } catch (err) {
          socket3.disconnect();
          reject(err);
        }
      });

      socket3.on("error", () => {
        // ignore legacy mirrored error event; join-failed is asserted above
      });
    });
  });

  it("should handle disconnect and reconnect", async () => {
    const token = await createTestToken(5, "reconnect@test.local");
    return new Promise<void>((resolve, reject) => {
      const socket3 = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token },
      });

      let userId = 5;
      let reconnectSocket: Socket | null = null;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      const timeout = setTimeout(() => {
        socket3.disconnect();
        reconnectSocket?.disconnect();
        reject(new Error("Timeout waiting for reconnect"));
      }, 10000);

      socket3.on("connect", () => {
        socket3.emit("join-room", {
          roomCode,
          userId,
          username: "Reconnector",
        });
      });

      socket3.once("game-state-update", () => {
        socket3.disconnect();

        reconnectTimer = setTimeout(() => {
          reconnectSocket = ioClient(API_URL, {
            path: SOCKET_PATH,
            transports: ["websocket", "polling"],
            auth: { token },
          });

          reconnectSocket.on("connect", () => {
            reconnectSocket?.emit("reconnect-room", { userId });
          });

          reconnectSocket.once("game-state-update", (reconnectState) => {
            try {
              expect(reconnectState.players.some((p: any) => p.userId === userId)).toBe(true);
              if (reconnectTimer) clearTimeout(reconnectTimer);
              clearTimeout(timeout);
              reconnectSocket?.disconnect();
              resolve();
            } catch (err) {
              if (reconnectTimer) clearTimeout(reconnectTimer);
              clearTimeout(timeout);
              reconnectSocket?.disconnect();
              reject(err);
            }
          });

          reconnectSocket.on("error", (err) => {
            if (reconnectTimer) clearTimeout(reconnectTimer);
            clearTimeout(timeout);
            reconnectSocket?.disconnect();
            reject(new Error(`Reconnect error: ${err.message}`));
          });
        }, 500);
      });

      socket3.on("error", (err) => {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        clearTimeout(timeout);
        socket3.disconnect();
        reject(new Error(`Socket error: ${err.message}`));
      });
    });
  });

  it("should recover reconnect via roomCode when user-room mapping is missing", async () => {
    const userId = 6;
    const token = await createTestToken(userId, "recover-map@test.local");

    return new Promise<void>((resolve, reject) => {
      const socket3 = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token },
      });

      let recovered = false;
      let reconnectStarted = false;
      let reconnectSocket: Socket | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        socket3.removeAllListeners();
        socket3.disconnect();
        if (reconnectSocket) {
          reconnectSocket.removeAllListeners();
          reconnectSocket.disconnect();
          reconnectSocket = null;
        }
      };

      const fail = (error: unknown) => {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      timer = setTimeout(() => {
        fail(new Error("Timeout waiting for reconnect recovery"));
      }, 12000);

      socket3.on("connect", () => {
        socket3.emit("join-room", {
          roomCode,
          userId,
          username: "RecoverByCode",
        });
      });

      socket3.on("game-state-update", async () => {
        if (recovered || reconnectStarted) return;
        reconnectStarted = true;
        try {
          // Simulate lost mapping (e.g. stale Redis/in-memory mapping) before reconnect.
          await realtimeStore.deleteUserRoom(userId);
        } catch (error) {
          fail(error);
          return;
        }

        socket3.disconnect();

        reconnectSocket = ioClient(API_URL, {
          path: SOCKET_PATH,
          transports: ["websocket", "polling"],
          auth: { token },
        });

        reconnectSocket.on("connect", () => {
          reconnectSocket?.emit("reconnect-room", { userId, roomCode, username: "RecoverByCode" });
        });

        reconnectSocket.on("room-joined", (data) => {
          try {
            expect(data.roomCode).toBe(roomCode);
          } catch (error) {
            fail(error);
          }
        });

        reconnectSocket.on("game-state-update", async (reconnectState) => {
          try {
            expect(reconnectState.players.some((p: any) => p.userId === userId)).toBe(true);
            const mappedRoomId = await realtimeStore.getUserRoom(userId);
            expect(typeof mappedRoomId).toBe("number");
            recovered = true;
            cleanup();
            resolve();
          } catch (error) {
            fail(error);
          }
        });

        reconnectSocket.on("error", (err) => {
          fail(new Error(`Reconnect recovery error: ${err.message}`));
        });
      });

      socket3.on("error", (err) => {
        fail(new Error(`Socket error: ${err.message}`));
      });
    });
  });

  it("should recover reconnect via roomId/playerId hints when mapping is missing", async () => {
    const userId = 8;
    const token = await createTestToken(userId, "recover-hints@test.local");

    return new Promise<void>((resolve, reject) => {
      const socket3 = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token },
      });

      let recovered = false;
      let reconnectStarted = false;
      let reconnectSocket: Socket | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let roomIdHint: number | null = null;
      let playerIdHint: number | null = null;

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        socket3.removeAllListeners();
        socket3.disconnect();
        if (reconnectSocket) {
          reconnectSocket.removeAllListeners();
          reconnectSocket.disconnect();
          reconnectSocket = null;
        }
      };

      const fail = (error: unknown) => {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      timer = setTimeout(() => {
        fail(new Error("Timeout waiting for reconnect recovery with hints"));
      }, 12000);

      socket3.on("connect", () => {
        socket3.emit("join-room", {
          roomCode,
          userId,
          username: "RecoverHints",
        });
      });

      socket3.on("game-state-update", async (state) => {
        if (recovered || reconnectStarted) return;
        reconnectStarted = true;
        try {
          roomIdHint = state.roomId;
          playerIdHint = state.players.find((p: any) => p.userId === userId)?.id ?? null;
          if (!roomIdHint || !playerIdHint) {
            fail(new Error("Missing room/player hints from game state"));
            return;
          }
          await realtimeStore.deleteUserRoom(userId);
        } catch (error) {
          fail(error);
          return;
        }

        socket3.disconnect();

        reconnectSocket = ioClient(API_URL, {
          path: SOCKET_PATH,
          transports: ["websocket", "polling"],
          auth: { token },
        });

        reconnectSocket.on("connect", () => {
          reconnectSocket?.emit("reconnect-room", {
            userId,
            roomId: roomIdHint,
            playerId: playerIdHint,
            username: "RecoverHints",
          });
        });

        reconnectSocket.on("game-state-update", async (reconnectState) => {
          try {
            expect(reconnectState.players.some((p: any) => p.userId === userId)).toBe(true);
            const mappedRoomId = await realtimeStore.getUserRoom(userId);
            expect(mappedRoomId).toBe(roomIdHint);
            recovered = true;
            cleanup();
            resolve();
          } catch (error) {
            fail(error);
          }
        });

        reconnectSocket.on("error", (err) => {
          fail(new Error(`Reconnect recovery with hints error: ${err.message}`));
        });
      });

      socket3.on("error", (err) => {
        fail(new Error(`Socket error: ${err.message}`));
      });
    });
  });

  it("should clear stale reconnect sessions when room metadata exists but realtime state is missing", async () => {
    const hostUserId = 220;
    const staleUserId = 221;
    const hostToken = await createTestToken(hostUserId, "stale-host@test.local");
    const staleToken = await createTestToken(staleUserId, "stale-user@test.local");

    return new Promise<void>((resolve, reject) => {
      const hostSocket = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token: hostToken },
      });
      const staleSocket = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token: staleToken },
      });
      let reconnectSocket: Socket | null = null;
      let createdRoomId: number | null = null;
      let createdRoomCode = "";
      let stalePlayerId: number | null = null;
      let finished = false;

      const cleanup = () => {
        hostSocket.removeAllListeners();
        staleSocket.removeAllListeners();
        hostSocket.disconnect();
        staleSocket.disconnect();
        if (reconnectSocket) {
          reconnectSocket.removeAllListeners();
          reconnectSocket.disconnect();
        }
      };

      const finish = (error?: unknown) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        cleanup();
        if (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        } else {
          resolve();
        }
      };

      const timeout = setTimeout(() => {
        finish(new Error("Timeout waiting for stale reconnect cleanup"));
      }, 15000);

      hostSocket.on("connect", () => {
        hostSocket.emit("create-room", {
          userId: hostUserId,
          username: "StaleHost",
          maxPlayers: 4,
          isPrivate: true,
        });
      });

      hostSocket.on("room-created", (payload) => {
        createdRoomId = payload.roomId;
        createdRoomCode = payload.roomCode;
      });

      staleSocket.on("connect", () => {
        const tryJoin = () => {
          if (!createdRoomCode) {
            setTimeout(tryJoin, 40);
            return;
          }
          staleSocket.emit("join-room", {
            roomCode: createdRoomCode,
            userId: staleUserId,
            username: "StaleUser",
          });
        };
        tryJoin();
      });

      staleSocket.on("game-state-update", async (state) => {
        if (!createdRoomId || stalePlayerId) return;
        stalePlayerId = state.players.find((p: any) => p.userId === staleUserId)?.id ?? null;
        if (!stalePlayerId) {
          finish(new Error("Stale user playerId not found"));
          return;
        }

        hostSocket.disconnect();
        staleSocket.disconnect();
        await new Promise((r) => setTimeout(r, 120));

        await realtimeStore.deleteGameState(createdRoomId);
        await realtimeStore.setUserRoom(staleUserId, createdRoomId);

        reconnectSocket = ioClient(API_URL, {
          path: SOCKET_PATH,
          transports: ["websocket", "polling"],
          auth: { token: staleToken },
        });

        reconnectSocket.on("connect", () => {
          reconnectSocket?.emit("reconnect-room", {
            userId: staleUserId,
            roomId: createdRoomId,
            roomCode: createdRoomCode,
            playerId: stalePlayerId,
            username: "StaleUser",
          });
        });

        reconnectSocket.on("error", async (payload: { message?: string }) => {
          try {
            expect(payload?.message).toBe("No active session found");
            const mappedRoomId = await realtimeStore.getUserRoom(staleUserId);
            expect(mappedRoomId).toBeUndefined();
            finish();
          } catch (error) {
            finish(error);
          }
        });
      });

      hostSocket.on("error", (err) => {
        finish(new Error(`Host socket error: ${err.message}`));
      });
      staleSocket.on("error", (err) => {
        // ignore mirrored errors; reconnect assertion handles the expected branch
        if (!stalePlayerId) {
          finish(new Error(`Stale socket error: ${err.message}`));
        }
      });
    });
  });
});
