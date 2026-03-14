#!/usr/bin/env node
import { io } from "socket.io-client";
import { SignJWT } from "jose";

const API_URL = process.env.SOAK_API_URL || "http://127.0.0.1:3000";
const SOCKET_PATH = process.env.SOAK_SOCKET_PATH || "/api/socket.io";
const CLIENTS = Math.max(2, Number(process.env.SOAK_CLIENTS || 6));
const DURATION_MS = Math.max(3_000, Number(process.env.SOAK_DURATION_MS || 30_000));
const STEP_DELAY_MS = Math.max(20, Number(process.env.SOAK_STEP_DELAY_MS || 120));
const CONNECT_TIMEOUT_MS = Math.max(2_000, Number(process.env.SOAK_CONNECT_TIMEOUT_MS || 12_000));
const JOIN_RETRY_MAX = Math.max(1, Number(process.env.SOAK_JOIN_RETRY_MAX || 6));
const JWT_SECRET_VALUE = (process.env.SOAK_JWT_SECRET || process.env.JWT_SECRET || "").trim();
const JWT_SECRET = JWT_SECRET_VALUE ? new TextEncoder().encode(JWT_SECRET_VALUE) : null;
const USER_ID_BASE = Number(
  process.env.SOAK_USER_ID_BASE || (20_000 + Math.floor((Date.now() % 8_000_000) / 1_000)),
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStateOptional(socket, timeoutMs) {
  try {
    await waitForEvent(socket, "game-state-update", timeoutMs);
  } catch {
    // Older server versions may not emit an immediate state snapshot after room-created/room-joined.
  }
}

async function createToken(userId) {
  if (!JWT_SECRET) {
    throw new Error("Missing SOAK_JWT_SECRET/JWT_SECRET for authenticated socket soak test");
  }
  return new SignJWT({ userId, email: `soak+${userId}@test.local` })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(JWT_SECRET);
}

function waitForEvent(socket, event, timeoutMs, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for "${event}"`));
    }, timeoutMs);

    const handler = (...args) => {
      try {
        if (!predicate(...args)) return;
        cleanup();
        resolve(args);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    const onError = (payload) => {
      cleanup();
      const msg = typeof payload?.message === "string" ? payload.message : `Socket error while waiting for "${event}"`;
      reject(new Error(msg));
    };

    const onConnectError = (err) => {
      cleanup();
      const msg = err instanceof Error ? err.message : `Socket connect_error while waiting for "${event}"`;
      reject(new Error(msg));
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off(event, handler);
      socket.off("error", onError);
      socket.off("connect_error", onConnectError);
    };

    socket.on(event, handler);
    socket.on("error", onError);
    socket.on("connect_error", onConnectError);
  });
}

async function createClient(userId) {
  const token = await createToken(userId);
  const socket = io(API_URL, {
    path: SOCKET_PATH,
    transports: ["websocket", "polling"],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: CONNECT_TIMEOUT_MS,
  });
  await waitForEvent(socket, "connect", CONNECT_TIMEOUT_MS);
  return socket;
}

async function createRoom(hostSocket, hostUserId) {
  hostSocket.emit("create-room", { username: `U${hostUserId}`, maxPlayers: 6, isPrivate: true });
  const [payload] = await waitForEvent(hostSocket, "room-created", CONNECT_TIMEOUT_MS);
  await waitForStateOptional(hostSocket, Math.min(2500, CONNECT_TIMEOUT_MS));
  return payload;
}

async function joinRoom(clientSocket, roomCode, userId) {
  let attempt = 0;
  let lastError = null;

  while (attempt < JOIN_RETRY_MAX) {
    attempt += 1;
    try {
      clientSocket.emit("join-room", { roomCode, username: `U${userId}` });
      await waitForEvent(clientSocket, "room-joined", CONNECT_TIMEOUT_MS);
      await waitForStateOptional(clientSocket, Math.min(2500, CONNECT_TIMEOUT_MS));
      return;
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const retryable =
        /room not found|failed to join|timeout|game session unavailable/i.test(msg);
      if (!retryable || attempt >= JOIN_RETRY_MAX) {
        throw error;
      }
      await sleep(Math.min(1200, 150 * attempt));
    }
  }

  throw lastError || new Error("join failed");
}

async function reconnectRoom(clientSocket, userId, roomCode) {
  clientSocket.disconnect();
  await sleep(120);
  clientSocket.connect();
  await waitForEvent(clientSocket, "connect", CONNECT_TIMEOUT_MS);
  clientSocket.emit("reconnect-room", { userId, roomCode, username: `U${userId}` });
  await waitForEvent(clientSocket, "room-joined", CONNECT_TIMEOUT_MS);
}

async function main() {
  const members = [];
  const errors = [];
  let joinFailures = 0;
  const hostUserId = USER_ID_BASE;

  const hostSocket = await createClient(hostUserId);
  members.push({ userId: hostUserId, socket: hostSocket });

  const room = await createRoom(hostSocket, hostUserId);
  const roomCode = room.roomCode;
  const roomId = room.roomId;

  for (let i = 1; i < CLIENTS; i++) {
    const userId = hostUserId + i;
    const socket = await createClient(userId);
    try {
      await joinRoom(socket, roomCode, userId);
      members.push({ userId, socket });
    } catch (error) {
      joinFailures += 1;
      errors.push({
        userId,
        message: error instanceof Error ? error.message : "join failed",
        at: Date.now(),
      });
      socket.disconnect();
    }
  }

  const start = Date.now();
  let chatAttempts = 0;
  let chatSent = 0;
  let reconnects = 0;
  let reconnectFailures = 0;

  for (const member of members) {
    member.socket.on("error", (payload) => {
      const msg = typeof payload?.message === "string" ? payload.message : "unknown socket error";
      errors.push({ userId: member.userId, message: msg, at: Date.now() });
    });
  }

  while (Date.now() - start < DURATION_MS) {
    const idx = Math.floor(Math.random() * members.length);
    const member = members[idx];
    const socket = member.socket;
    if (!socket.connected) continue;

    if (Math.random() < 0.22) {
      try {
        await reconnectRoom(socket, member.userId, roomCode);
        reconnects += 1;
      } catch (error) {
        reconnectFailures += 1;
        errors.push({
          userId: member.userId,
          message: error instanceof Error ? error.message : "reconnect failed",
          at: Date.now(),
        });
      }
    } else {
      chatAttempts += 1;
      socket.emit("chat:send", { roomId, message: `soak-${member.userId}-${Date.now()}` });
      chatSent += 1;
    }
    await sleep(STEP_DELAY_MS);
  }

  for (const member of members) {
    member.socket.disconnect();
  }

  const summary = {
    ok: errors.length === 0 && reconnectFailures === 0,
    apiUrl: API_URL,
    socketPath: SOCKET_PATH,
    userIdBase: USER_ID_BASE,
    clients: CLIENTS,
    durationMs: DURATION_MS,
    roomId,
    roomCode,
    chatAttempts,
    chatSent,
    reconnects,
    reconnectFailures,
    joinFailures,
    errorsTotal: errors.length,
    errorsSample: errors.slice(0, 10),
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
