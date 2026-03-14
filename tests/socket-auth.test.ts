import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, Server as HttpServer } from "http";
import express from "express";
import { io as ioClient, Socket } from "socket.io-client";
import { SignJWT } from "jose";
import type { AddressInfo } from "net";
import { setupGameSocket } from "../server/game-socket";

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

describe("Socket authentication", () => {
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

  it("rejects socket connection without auth token", async () => {
    await new Promise<void>((resolve, reject) => {
      const socket: Socket = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        reconnection: false,
      });

      const timer = setTimeout(() => {
        socket.disconnect();
        reject(new Error("Expected connect_error for unauthenticated socket"));
      }, 5000);

      socket.on("connect_error", (error) => {
        clearTimeout(timer);
        try {
          expect(String(error?.message || "")).toMatch(/unauthorized/i);
          socket.disconnect();
          resolve();
        } catch (assertionError) {
          socket.disconnect();
          reject(assertionError);
        }
      });
    });
  });

  it("rejects socket connection with invalid token", async () => {
    await new Promise<void>((resolve, reject) => {
      const socket: Socket = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token: "not-a-valid-token" },
        reconnection: false,
      });

      const timer = setTimeout(() => {
        socket.disconnect();
        reject(new Error("Expected connect_error for invalid token"));
      }, 5000);

      socket.on("connect_error", (error) => {
        clearTimeout(timer);
        try {
          expect(String(error?.message || "")).toMatch(/unauthorized/i);
          socket.disconnect();
          resolve();
        } catch (assertionError) {
          socket.disconnect();
          reject(assertionError);
        }
      });
    });
  });

  it("accepts socket connection with valid token and allows create-room", async () => {
    const token = await createTestToken(101, "valid-socket@test.local");
    await new Promise<void>((resolve, reject) => {
      const socket: Socket = ioClient(API_URL, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token },
        reconnection: false,
      });

      const timer = setTimeout(() => {
        socket.disconnect();
        reject(new Error("Timeout waiting for room-created"));
      }, 7000);

      socket.on("connect", () => {
        socket.emit("create-room", { userId: 101, username: "SecureHost", maxPlayers: 4 });
      });

      socket.on("room-created", (data) => {
        clearTimeout(timer);
        try {
          expect(data.roomCode).toMatch(/^[A-Z0-9]{6}$/);
          socket.disconnect();
          resolve();
        } catch (assertionError) {
          socket.disconnect();
          reject(assertionError);
        }
      });

      socket.on("error", (err) => {
        clearTimeout(timer);
        socket.disconnect();
        reject(new Error(`Unexpected socket error: ${err?.message || err}`));
      });
    });
  });
});
