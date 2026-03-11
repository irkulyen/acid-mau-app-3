import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ioClient, Socket } from "socket.io-client";

const API_URL = "http://localhost:3000";
const SOCKET_PATH = "/api/socket.io";

describe("Multiplayer Room System", () => {
  let socket1: Socket;
  let socket2: Socket;
  let roomCode: string;

  beforeAll(() => {
    return new Promise<void>((resolve) => setTimeout(() => resolve(), 2000));
  });

  afterAll(() => {
    if (socket1) socket1.disconnect();
    if (socket2) socket2.disconnect();
  });

  it("should create a room", async () => {
    return new Promise<void>((resolve, reject) => {
      socket1 = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
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
    return new Promise<void>((resolve, reject) => {
      socket2 = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
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
    return new Promise<void>((resolve, reject) => {
      const socket3 = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
      });

      socket3.on("connect", () => {
        socket3.emit("join-room", {
          roomCode: "INVALID",
          userId: 4,
          username: "InvalidUser",
        });
      });

      socket3.on("error", (data) => {
        try {
          expect(data.message).toContain("not found");
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

  it("should handle disconnect and reconnect", async () => {
    return new Promise<void>((resolve, reject) => {
      const socket3 = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
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
});
