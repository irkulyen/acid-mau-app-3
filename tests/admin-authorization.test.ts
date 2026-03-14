import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import { io as ioClient, Socket } from "socket.io-client";
import { SignJWT } from "jose";
import { setupGameSocket } from "../server/game-socket";
import * as db from "../server/db";
import { realtimeStore } from "../server/realtime-store";

let API_URL = "http://127.0.0.1:3000";
const SOCKET_PATH = "/api/socket.io";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-change-in-production");

async function createTestToken(userId: number, email: string) {
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(JWT_SECRET);
}

describe("Admin socket authorization", () => {
  let server: HttpServer;

  beforeAll(async () => {
    vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
      if (id === 9001) {
        return {
          id: 9001,
          openId: "admin-openid",
          name: "Admin User",
          email: "admin@test.local",
          passwordHash: null,
          loginMethod: "email",
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as any;
      }
      return {
        id,
        openId: `user-${id}`,
        name: "Regular User",
        email: `user-${id}@test.local`,
        passwordHash: null,
        loginMethod: "email",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as any;
    });

    const app = express();
    server = createServer(app);
    setupGameSocket(server);
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const address = server.address() as AddressInfo;
    API_URL = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("denies admin command for normal user even with spoofed username", async () => {
    const token = await createTestToken(9002, "regular@test.local");
    await new Promise<void>((resolve, reject) => {
      const socket: Socket = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token },
        reconnection: false,
      });

      const timer = setTimeout(() => {
        socket.disconnect();
        reject(new Error("Timeout waiting for permission error"));
      }, 7000);

      socket.on("connect", () => {
        socket.emit("admin:close-empty-rooms", { username: "admin" });
      });

      socket.on("error", (data) => {
        clearTimeout(timer);
        try {
          expect(data.message).toBe("Keine Berechtigung");
          socket.disconnect();
          resolve();
        } catch (error) {
          socket.disconnect();
          reject(error);
        }
      });
    });
  });

  it("allows admin command for server-authorized admin user", async () => {
    const token = await createTestToken(9001, "admin@test.local");
    await new Promise<void>((resolve, reject) => {
      const socket: Socket = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token },
        reconnection: false,
      });

      const timer = setTimeout(() => {
        socket.disconnect();
        reject(new Error("Timeout waiting for admin result"));
      }, 7000);

      socket.on("connect", () => {
        socket.emit("admin:close-empty-rooms", { username: "admin" });
      });

      socket.on("admin:empty-rooms-closed", (payload) => {
        clearTimeout(timer);
        try {
          expect(typeof payload.count).toBe("number");
          socket.disconnect();
          resolve();
        } catch (error) {
          socket.disconnect();
          reject(error);
        }
      });

      socket.on("error", (data) => {
        clearTimeout(timer);
        socket.disconnect();
        reject(new Error(`Unexpected error for admin user: ${data.message}`));
      });
    });
  });

  it("closes empty rooms and removes runtime state", async () => {
    const userToken = await createTestToken(9003, "cleanup-user@test.local");
    const adminToken = await createTestToken(9001, "admin@test.local");

    const roomId = await new Promise<number>((resolve, reject) => {
      const socket: Socket = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token: userToken },
        reconnection: false,
      });

      const timer = setTimeout(() => {
        socket.disconnect();
        reject(new Error("Timeout waiting for room-created"));
      }, 7000);

      socket.on("connect", () => {
        socket.emit("create-room", { username: "CleanupUser", maxPlayers: 5 });
      });

      socket.on("room-created", (payload) => {
        clearTimeout(timer);
        socket.disconnect();
        resolve(payload.roomId);
      });

      socket.on("error", (data) => {
        clearTimeout(timer);
        socket.disconnect();
        reject(new Error(`Unexpected user error: ${data.message}`));
      });
    });

    // Give disconnect handler time to mark room as empty.
    await new Promise((resolve) => setTimeout(resolve, 120));

    await new Promise<void>((resolve, reject) => {
      const socket: Socket = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token: adminToken },
        reconnection: false,
      });

      const timer = setTimeout(() => {
        socket.disconnect();
        reject(new Error("Timeout waiting for admin cleanup result"));
      }, 7000);

      socket.on("connect", () => {
        socket.emit("admin:close-empty-rooms", {});
      });

      socket.on("admin:empty-rooms-closed", async (payload) => {
        clearTimeout(timer);
        try {
          expect(payload.count).toBeGreaterThanOrEqual(1);
          const state = await realtimeStore.getGameState(roomId);
          expect(state).toBeUndefined();
          socket.disconnect();
          resolve();
        } catch (error) {
          socket.disconnect();
          reject(error);
        }
      });

      socket.on("error", (data) => {
        clearTimeout(timer);
        socket.disconnect();
        reject(new Error(`Unexpected admin error: ${data.message}`));
      });
    });
  });
});
