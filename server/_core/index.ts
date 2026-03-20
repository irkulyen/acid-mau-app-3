import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import os from "os";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createClient } from "redis";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { setupGameSocket } from "../game-socket";
import * as db from "../db";
import { realtimeStore } from "../realtime-store";
import { telemetry } from "../telemetry";
import { ENV } from "./env";
import { createCorsOriginMatcher } from "./cors";

type SocketLeaderLock = {
  redis: ReturnType<typeof createClient>;
  key: string;
  value: string;
  renewTimer: ReturnType<typeof setInterval>;
};

let socketLeaderLock: SocketLeaderLock | null = null;
const INSTANCE_ID = `${os.hostname()}:${process.pid}`;
let roomReconcileTimer: ReturnType<typeof setInterval> | null = null;
let roomReconcileInFlight = false;

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function releaseSingleSocketLock(): Promise<void> {
  const lock = socketLeaderLock;
  socketLeaderLock = null;
  if (!lock) return;
  clearInterval(lock.renewTimer);
  try {
    const current = await lock.redis.get(lock.key);
    if (current === lock.value) {
      await lock.redis.del(lock.key);
    }
  } catch (error) {
    console.warn("[socket-lock] Failed to release lock cleanly:", error);
  }
  try {
    await lock.redis.quit();
  } catch {
    await lock.redis.disconnect();
  }
}

async function acquireSingleSocketLock(): Promise<void> {
  if (!ENV.enforceSingleSocketInstance) return;
  if (!ENV.redisUrl) {
    throw new Error("ENFORCE_SINGLE_SOCKET_INSTANCE requires REDIS_URL");
  }

  const redis = createClient({ url: ENV.redisUrl });
  await redis.connect();

  const key = "acidmau:socket:leader";
  const value = INSTANCE_ID;
  const ttlSec = Math.max(20, ENV.singleSocketLockTtlSec);
  const acquired = await redis.set(key, value, { NX: true, EX: ttlSec });

  if (acquired !== "OK") {
    const owner = await redis.get(key);
    await redis.quit();
    throw new Error(
      `[socket-lock] Another socket instance is active (${owner || "unknown"}). Refusing startup to prevent split-brain multiplayer.`,
    );
  }

  const renewTimer = setInterval(() => {
    void (async () => {
      try {
        const current = await redis.get(key);
        if (current !== value) {
          throw new Error(`Lost lock ownership to ${current || "unknown"}`);
        }
        await redis.set(key, value, { XX: true, EX: ttlSec });
      } catch (error) {
        console.error("[socket-lock] Lock renewal failed:", error);
      }
    })();
  }, Math.max(5_000, Math.floor((ttlSec * 1000) / 3)));

  socketLeaderLock = { redis, key, value, renewTimer };
  console.log("[socket-lock] Acquired single-instance lock");
}

async function reconcileRoomState(): Promise<void> {
  if (roomReconcileInFlight) return;
  roomReconcileInFlight = true;
  try {
    const waitingRooms = await db.getWaitingRooms();
    for (const room of waitingRooms) {
      const state = await realtimeStore.getGameState(room.id);
      if (!state) {
        await db.deleteGameRoom(room.id).catch(() => undefined);
        telemetry.inc("rooms.reconcile.deleted_stale");
        continue;
      }

      const nextStatus = state.phase === "waiting" ? "waiting" : "playing";
      const nextCurrentPlayers = state.players.length;
      const nextMaxPlayers = state.maxPlayers ?? room.maxPlayers;
      const hasChanges =
        room.status !== nextStatus ||
        room.currentPlayers !== nextCurrentPlayers ||
        room.maxPlayers !== nextMaxPlayers;

      if (hasChanges) {
        await db
          .updateGameRoom(room.id, {
            status: nextStatus,
            currentPlayers: nextCurrentPlayers,
            maxPlayers: nextMaxPlayers,
          })
          .catch(() => undefined);
        telemetry.inc("rooms.reconcile.updated");
      }
    }
  } catch (error) {
    console.error("[reconcile] Failed to reconcile room state:", error);
    telemetry.inc("errors.room_reconcile");
  } finally {
    roomReconcileInFlight = false;
  }
}

function startRoomReconciler() {
  if (roomReconcileTimer) {
    clearInterval(roomReconcileTimer);
    roomReconcileTimer = null;
  }
  const intervalMs = Math.max(15_000, ENV.roomReconcileIntervalMs);
  roomReconcileTimer = setInterval(() => {
    void reconcileRoomState();
  }, intervalMs);
  void reconcileRoomState();
}

async function startServer() {
  if (ENV.enforceExplicitRuleset && !ENV.rulesetId) {
    throw new Error("ENFORCE_EXPLICIT_RULESET is enabled but RULESET_ID is missing");
  }
  if (
    ENV.isProduction &&
    (!ENV.cookieSecret || ENV.cookieSecret === "your-secret-key-change-in-production")
  ) {
    throw new Error("JWT_SECRET must be set to a strong value in production");
  }

  const app = express();
  const server = createServer(app);
  const corsMatcher = createCorsOriginMatcher();
  const { isAllowedOrigin, allowAllOrigins, configuredOrigins } = corsMatcher;

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    res.header("Vary", "Origin");
    const allowedOrigin = origin ? isAllowedOrigin(origin) : true;
    if (origin && allowedOrigin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    if (origin && !allowedOrigin) {
      telemetry.inc("cors.blocked.http");
      console.warn(`[cors] Blocked HTTP origin: ${origin} (${req.method} ${req.path})`);
      res.status(403).json({ error: "Origin not allowed by CORS" });
      return;
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      timestamp: Date.now(),
      buildId: ENV.serverBuildId,
      instanceId: INSTANCE_ID,
      singleSocketLockEnabled: ENV.enforceSingleSocketInstance,
      singleSocketLockHeld: Boolean(socketLeaderLock),
      redisConfigured: Boolean(ENV.redisUrl),
      socketPath: "/api/socket.io",
      corsAllowAllOrigins: allowAllOrigins,
      corsConfiguredOrigins: configuredOrigins,
    });
  });

  app.get("/api/telemetry", (req, res) => {
    const token = ENV.telemetryToken;
    if (token && req.headers.authorization !== `Bearer ${token}`) {
      res.status(401).json({ error: "Unauthorized telemetry access" });
      return;
    }
    res.json({
      buildId: ENV.serverBuildId,
      instanceId: INSTANCE_ID,
      lockHeld: Boolean(socketLeaderLock),
      ...telemetry.snapshot(),
    });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = ENV.isProduction ? preferredPort : await findAvailablePort(preferredPort);

  if (!ENV.isProduction && port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Setup WebSocket server
  await realtimeStore.init();
  await acquireSingleSocketLock();
  telemetry.start();
  startRoomReconciler();
  setupGameSocket(server);

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port} (build=${ENV.serverBuildId})`);
  });
}

const shutdownSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
for (const signal of shutdownSignals) {
  process.on(signal, () => {
    void (async () => {
      if (roomReconcileTimer) {
        clearInterval(roomReconcileTimer);
        roomReconcileTimer = null;
      }
      await releaseSingleSocketLock();
      process.exit(0);
    })();
  });
}

startServer().catch(async (error) => {
  console.error(error);
  if (roomReconcileTimer) {
    clearInterval(roomReconcileTimer);
    roomReconcileTimer = null;
  }
  await releaseSingleSocketLock();
});
