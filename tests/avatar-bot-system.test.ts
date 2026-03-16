import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { io as ioClient, Socket } from "socket.io-client";
import { SignJWT } from "jose";
import express from "express";
import { createServer, Server as HttpServer } from "http";
import type { AddressInfo } from "net";

const SOCKET_PATH = "/api/socket.io";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-change-in-production");

async function createTestToken(userId: number, email: string) {
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(JWT_SECRET);
}

describe("Avatar/Bot multiplayer sync", () => {
  let server: HttpServer;
  let apiUrl = "http://127.0.0.1:3000";
  let socket: Socket;

  beforeAll(async () => {
    process.env.ENABLE_BOTS = "true";
    process.env.PUBLIC_BASE_URL = "https://example-avatar-host.invalid";
    vi.resetModules();
    const { setupGameSocket } = await import("../server/game-socket");

    const app = express();
    server = createServer(app);
    setupGameSocket(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as AddressInfo;
    apiUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (socket) socket.disconnect();
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it("adds bots with stable botId and server-based avatarUrl", async () => {
    const token = await createTestToken(7001, "avatar-host@test.local");

    await new Promise<void>((resolve, reject) => {
      socket = ioClient(apiUrl, {
        path: SOCKET_PATH,
        transports: ["websocket", "polling"],
        auth: { token },
      });

      let roomId: number | null = null;
      let seenBotState = false;
      let gotDisabledError = false;
      const timer = setTimeout(() => {
        socket.disconnect();
        reject(new Error("Timeout waiting for bot avatar state"));
      }, 8000);

      socket.on("connect", () => {
        socket.emit("create-room", { userId: 7001, username: "AvatarHost", maxPlayers: 6 });
      });

      socket.on("room-created", (data) => {
        roomId = data.roomId;
        socket.emit("add-bot", { roomId, userId: 7001 });
      });

      socket.on("error", (data) => {
        if (String(data?.message || "").includes("Bots are disabled")) {
          gotDisabledError = true;
        }
      });

      socket.on("game-state-update", (state) => {
        if (!roomId || state.roomId !== roomId) return;
        const bot = state.players.find((p: any) => p.userId < 0);
        if (!bot) return;
        seenBotState = true;
        try {
          expect(gotDisabledError).toBe(false);
          expect(bot.botId).toMatch(/^bot_/);
          expect(typeof bot.avatarUrl).toBe("string");
          expect(bot.avatarUrl).toContain("/assets/bots/");
          expect(bot.avatarUrl.startsWith("http://") || bot.avatarUrl.startsWith("https://")).toBe(true);
          clearTimeout(timer);
          socket.disconnect();
          resolve();
        } catch (error) {
          clearTimeout(timer);
          socket.disconnect();
          reject(error);
        }
      });

      socket.on("disconnect", () => {
        if (!seenBotState) {
          // Let timeout handle failure details.
        }
      });
    });
  });
});

