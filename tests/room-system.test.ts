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
          maxPlayers: 5,
        });
      });

      socket1.on("room-created", (data) => {
        try {
          expect(data.roomCode).toBeDefined();
          expect(data.roomCode.length).toBe(6);
          expect(data.maxPlayers).toBe(5);
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

  it("should broadcast state to all players", async () => {
    return new Promise<void>((resolve, reject) => {
      socket1.on("game-state-update", (state) => {
        try {
          expect(state.players.length).toBe(2);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  });

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
          roomCode: "ZZZZ",
          userId: 4,
          username: "InvalidUser",
        });
      });

      socket3.on("error", (data) => {
        try {
          expect(["Room not found", "Invalid room code"]).toContain(data.message);
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

      socket3.on("connect", () => {
        socket3.emit("join-room", {
          roomCode,
          userId,
          username: "Reconnector",
        });
      });

      socket3.on("game-state-update", (state) => {
        socket3.disconnect();

        setTimeout(() => {
          const socket3Reconnect = ioClient(API_URL, {
            path: SOCKET_PATH,
            transports: ["websocket", "polling"],
            auth: { token },
          });

          socket3Reconnect.on("connect", () => {
            socket3Reconnect.emit("reconnect-room", { userId });
          });

          socket3Reconnect.on("game-state-update", (reconnectState) => {
            try {
              expect(reconnectState.players.some((p: any) => p.userId === userId)).toBe(true);
              socket3Reconnect.disconnect();
              resolve();
            } catch (err) {
              socket3Reconnect.disconnect();
              reject(err);
            }
          });

          socket3Reconnect.on("error", (err) => {
            socket3Reconnect.disconnect();
            reject(new Error(`Reconnect error: ${err.message}`));
          });

          setTimeout(() => {
            socket3Reconnect.disconnect();
            reject(new Error("Timeout waiting for reconnect"));
          }, 10000);
        }, 500);
      });

      socket3.on("error", (err) => {
        socket3.disconnect();
        reject(new Error(`Socket error: ${err.message}`));
      });

      setTimeout(() => {
        socket3.disconnect();
        reject(new Error("Timeout waiting for initial join"));
      }, 10000);
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
});
