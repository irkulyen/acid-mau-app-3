#!/usr/bin/env node
import { io } from "socket.io-client";

const API_BASE_URL = process.env.PHASE1_API_URL || "http://185.215.165.148:3000";
const SOCKET_PATH = process.env.PHASE1_SOCKET_PATH || "/api/socket.io";
const LOGIN_EMAIL = process.env.PHASE1_LOGIN_EMAIL || "maik_scheibe@web.de";
const LOGIN_PASSWORD = process.env.PHASE1_LOGIN_PASSWORD || "test123";
const LOGIN_ATTEMPTS = Math.max(5, Number(process.env.PHASE1_LOGIN_ATTEMPTS || 20));
const SOAK_DURATION_MS = Math.max(30_000, Number(process.env.PHASE1_SOAK_MS || 60_000));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

async function callTrpc(path, json) {
  const startedAt = Date.now();
  const response = await fetch(`${API_BASE_URL}/api/trpc/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json }),
  });
  let body;
  try {
    body = await response.json();
  } catch (error) {
    throw new Error(`${path}: non-JSON response (${response.status})`);
  }
  if (!response.ok || body?.error) {
    const message = body?.error?.json?.message || `${response.status}`;
    throw new Error(`${path}: ${message}`);
  }
  return {
    data: body.result.data.json,
    durationMs: Date.now() - startedAt,
  };
}

async function createUser(prefix) {
  const email = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}@example.com`;
  const username = `${prefix}_${Math.floor(Math.random() * 1000)}`;
  const { data } = await callTrpc("auth.register", {
    email,
    password: "test123",
    username,
  });
  return { userId: data.userId, token: data.token, email, username };
}

function waitSocketEvent(socket, event, timeoutMs = 12_000, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`timeout waiting for ${event}`));
    }, timeoutMs);

    const onEvent = (payload) => {
      try {
        if (!predicate(payload)) return;
        cleanup();
        resolve(payload);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    const onError = (payload) => {
      cleanup();
      reject(new Error(payload?.message || `socket error while waiting for ${event}`));
    };

    const onConnectError = (error) => {
      cleanup();
      reject(new Error(error?.message || `connect_error while waiting for ${event}`));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off(event, onEvent);
      socket.off("error", onError);
      socket.off("connect_error", onConnectError);
    };

    socket.on(event, onEvent);
    socket.on("error", onError);
    socket.on("connect_error", onConnectError);
  });
}

async function connectSocket(token, errorSink) {
  const socket = io(API_BASE_URL, {
    path: SOCKET_PATH,
    transports: ["websocket", "polling"],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 6,
  });
  socket.on("error", (payload) => {
    errorSink.push({
      type: "socket-error",
      message: payload?.message || String(payload),
      at: nowIso(),
    });
  });
  await waitSocketEvent(socket, "connect", 12_000);
  return socket;
}

function chooseWishSuit(hand) {
  const counts = new Map();
  for (const card of hand || []) {
    if (card.rank === "bube") continue;
    counts.set(card.suit, (counts.get(card.suit) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || "schellen";
}

function summarizeState(state) {
  if (!state) return null;
  return {
    roomId: state.roomId,
    roomCode: state.roomCode,
    phase: state.phase,
    roundNumber: state.roundNumber,
    currentPlayerIndex: state.currentPlayerIndex,
    playersCount: state.players?.length ?? 0,
  };
}

function assertNoGhostPlayers(state, label) {
  const ids = (state.players || []).map((p) => p.userId);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label}: ghost players detected (duplicate userId in room state)`);
  }
}

function assertConsensus(statesByUser, label) {
  const states = [...statesByUser.values()].filter(Boolean);
  if (states.length < 2) return;
  const baseline = summarizeState(states[0]);
  for (let i = 1; i < states.length; i++) {
    const current = summarizeState(states[i]);
    const same =
      baseline.roomId === current.roomId &&
      baseline.roomCode === current.roomCode &&
      baseline.phase === current.phase &&
      baseline.roundNumber === current.roundNumber &&
      baseline.currentPlayerIndex === current.currentPlayerIndex &&
      baseline.playersCount === current.playersCount;
    if (!same) {
      throw new Error(
        `${label}: state divergence detected baseline=${JSON.stringify(baseline)} current=${JSON.stringify(current)}`,
      );
    }
  }
}

async function runLoginStability() {
  const durations = [];
  for (let i = 0; i < LOGIN_ATTEMPTS; i++) {
    const { durationMs } = await callTrpc("auth.login", {
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
    });
    durations.push(durationMs);
  }
  const sorted = [...durations].sort((a, b) => a - b);
  const p95Index = Math.max(0, Math.floor(sorted.length * 0.95) - 1);
  return {
    attempts: LOGIN_ATTEMPTS,
    failures: 0,
    p95Ms: sorted[p95Index] ?? 0,
    maxMs: Math.max(...sorted),
  };
}

async function runRoomFlowDeterminism() {
  const errors = [];
  const host = await createUser("phase1_host");
  const guest1 = await createUser("phase1_g1");
  const guest2 = await createUser("phase1_g2");
  const guest3 = await createUser("phase1_g3");
  const wrongCodeUser = await createUser("phase1_wrong");

  const hostSocket = await connectSocket(host.token, errors);
  const guest1Socket = await connectSocket(guest1.token, errors);
  const guest2Socket = await connectSocket(guest2.token, errors);
  const guest3Socket = await connectSocket(guest3.token, errors);
  const wrongSocket = await connectSocket(wrongCodeUser.token, errors);

  const latestStateByUser = new Map();
  const bindState = (socket, uid) => {
    socket.on("game-state-update", (state) => {
      latestStateByUser.set(uid, state);
    });
  };
  bindState(hostSocket, host.userId);
  bindState(guest1Socket, guest1.userId);
  bindState(guest2Socket, guest2.userId);
  bindState(guest3Socket, guest3.userId);

  hostSocket.emit("create-room", { username: host.username, maxPlayers: 5, isPrivate: true });
  const created = await waitSocketEvent(hostSocket, "room-created");

  guest1Socket.emit("join-room", { roomCode: created.roomCode, username: guest1.username });
  guest2Socket.emit("join-room", { roomCode: created.roomCode, username: guest2.username });
  guest2Socket.emit("join-room", { roomCode: created.roomCode, username: guest2.username });
  guest3Socket.emit("join-room", { roomCode: created.roomCode, username: guest3.username });

  await Promise.all([
    waitSocketEvent(guest1Socket, "room-joined"),
    waitSocketEvent(guest2Socket, "room-joined"),
    waitSocketEvent(guest3Socket, "room-joined"),
  ]);

  await sleep(1_100);
  const hostStateAfterJoin = latestStateByUser.get(host.userId);
  if (!hostStateAfterJoin) {
    throw new Error("room flow: missing host state after join");
  }
  assertNoGhostPlayers(hostStateAfterJoin, "after-join");
  assertConsensus(latestStateByUser, "after-join");

  wrongSocket.emit("join-room", { roomCode: "ZZZZZZ", username: wrongCodeUser.username });
  const joinFailed = await waitSocketEvent(wrongSocket, "join-failed");
  if (!/room not found/i.test(joinFailed?.message || "")) {
    throw new Error(`wrong room code should fail deterministically, got: ${JSON.stringify(joinFailed)}`);
  }

  const guest1PlayerId = hostStateAfterJoin.players.find((p) => p.userId === guest1.userId)?.id;
  if (!guest1PlayerId) {
    throw new Error("room flow: guest1 playerId not found");
  }
  guest1Socket.emit("leave-room", { roomId: created.roomId, playerId: guest1PlayerId });
  await sleep(700);
  guest1Socket.emit("join-room", { roomCode: created.roomCode, username: guest1.username });
  await waitSocketEvent(guest1Socket, "room-joined");

  guest2Socket.disconnect();
  await sleep(450);
  const guest2ReconnectSocket = await connectSocket(guest2.token, errors);
  bindState(guest2ReconnectSocket, guest2.userId);
  const guest2PlayerId = hostStateAfterJoin.players.find((p) => p.userId === guest2.userId)?.id;
  guest2ReconnectSocket.emit("reconnect-room", {
    userId: guest2.userId,
    roomCode: created.roomCode,
    roomId: created.roomId,
    playerId: guest2PlayerId,
    username: guest2.username,
  });
  const rejoined = await waitSocketEvent(guest2ReconnectSocket, "room-joined");
  if (rejoined.roomId !== created.roomId) {
    throw new Error(`reconnect room mismatch expected=${created.roomId} got=${rejoined.roomId}`);
  }

  // Host reconnect determinism
  hostSocket.disconnect();
  await sleep(450);
  const hostReconnectSocket = await connectSocket(host.token, errors);
  bindState(hostReconnectSocket, host.userId);
  const hostPlayerId = hostStateAfterJoin.players.find((p) => p.userId === host.userId)?.id;
  hostReconnectSocket.emit("reconnect-room", {
    userId: host.userId,
    roomCode: created.roomCode,
    roomId: created.roomId,
    playerId: hostPlayerId,
    username: host.username,
  });
  const hostRejoined = await waitSocketEvent(hostReconnectSocket, "room-joined");
  if (hostRejoined.roomId !== created.roomId) {
    throw new Error(`host reconnect room mismatch expected=${created.roomId} got=${hostRejoined.roomId}`);
  }

  await sleep(1_200);
  const finalHostState = latestStateByUser.get(host.userId);
  if (!finalHostState) {
    throw new Error("room flow: missing final host state");
  }
  assertNoGhostPlayers(finalHostState, "final-room-flow");
  assertConsensus(latestStateByUser, "final-room-flow");

  hostReconnectSocket.disconnect();
  guest1Socket.disconnect();
  guest2ReconnectSocket.disconnect();
  guest3Socket.disconnect();
  wrongSocket.disconnect();

  const unexpectedErrors = errors.filter((entry) => {
    const message = String(entry?.message || "");
    // Expected during the explicit wrong-room-code negative test.
    if (/^room not found$/i.test(message)) return false;
    return true;
  });

  return {
    roomId: created.roomId,
    roomCode: created.roomCode,
    playersCount: finalHostState.players.length,
    uniquePlayers: new Set(finalHostState.players.map((p) => p.userId)).size,
    socketErrors: errors.length,
    unexpectedSocketErrors: unexpectedErrors.length,
    socketErrorsSample: errors.slice(0, 5),
  };
}

async function runSoak10Rounds() {
  const errors = [];
  const host = await createUser("phase1_soak_host");
  const guest1 = await createUser("phase1_soak_g1");
  const guest2 = await createUser("phase1_soak_g2");
  const guest3 = await createUser("phase1_soak_g3");
  const users = [host, guest1, guest2, guest3];

  const latestState = new Map();
  const lastActionAt = new Map();
  let lastStateAt = Date.now();
  const roundsSeen = new Set();
  let actions = 0;
  let readyActions = 0;
  let nextRoundActions = 0;
  let freezeDetected = false;
  let roomId = 0;

  const sockets = [];
  for (const user of users) {
    const socket = await connectSocket(user.token, errors);
    socket.on("game-state-update", (state) => {
      latestState.set(user.userId, state);
      lastStateAt = Date.now();
      roundsSeen.add(state.roundNumber);
    });
    sockets.push({ user, socket });
  }

  const hostSocket = sockets[0].socket;
  hostSocket.emit("create-room", { username: host.username, maxPlayers: 4, isPrivate: true });
  const created = await waitSocketEvent(hostSocket, "room-created");
  roomId = created.roomId;

  for (let i = 1; i < sockets.length; i++) {
    sockets[i].socket.emit("join-room", { roomCode: created.roomCode, username: sockets[i].user.username });
  }
  await Promise.all(sockets.slice(1).map(({ socket }) => waitSocketEvent(socket, "room-joined")));

  const startDeadline = Date.now() + 10_000;
  while (Date.now() < startDeadline) {
    const state = latestState.get(host.userId);
    if (state?.players?.some((p) => p.userId === host.userId)) break;
    await sleep(120);
  }
  const hostState = latestState.get(host.userId);
  if (!hostState) {
    throw new Error("soak: missing host state before START_GAME");
  }
  const hostPlayer = hostState.players.find((p) => p.userId === host.userId);
  if (!hostPlayer) {
    throw new Error("soak: host player missing before START_GAME");
  }
  hostSocket.emit("game-action", {
    roomId,
    playerId: hostPlayer.id,
    action: { type: "START_GAME" },
  });

  const act = ({ user, socket }) => {
    const state = latestState.get(user.userId);
    if (!state || !state.players) return;
    const me = state.players.find((p) => p.userId === user.userId);
    if (!me) return;

    const now = Date.now();
    const prevActionAt = lastActionAt.get(user.userId) || 0;
    if (now - prevActionAt < 260) return;

    if (state.phase === "playing") {
      const current = state.players[state.currentPlayerIndex];
      if (!current || current.userId !== user.userId) return;
      const playable = Array.isArray(state.playableCardIds) ? state.playableCardIds : [];
      let action;
      if (playable.length > 0) {
        const cardId = playable[0];
        const card = (me.hand || []).find((c) => c.id === cardId);
        if (card?.rank === "bube") {
          action = { type: "PLAY_CARD", cardId, wishSuit: chooseWishSuit(me.hand) };
        } else {
          action = { type: "PLAY_CARD", cardId };
        }
      } else {
        action = { type: "DRAW_CARD" };
      }
      socket.emit("game-action", { roomId, playerId: me.id, action });
      actions += 1;
      lastActionAt.set(user.userId, now);
      return;
    }

    if (state.phase === "round_end") {
      if (!me.isEliminated && !me.isReady) {
        socket.emit("game-action", { roomId, playerId: me.id, action: { type: "READY" } });
        readyActions += 1;
        lastActionAt.set(user.userId, now);
        return;
      }
      const alive = state.players.filter((p) => !p.isEliminated);
      const allReady = alive.length > 0 && alive.every((p) => p.isReady);
      if (state.hostUserId === user.userId && allReady) {
        socket.emit("game-action", { roomId, playerId: me.id, action: { type: "NEXT_ROUND" } });
        nextRoundActions += 1;
        lastActionAt.set(user.userId, now);
      }
    }
  };

  const endAt = Date.now() + SOAK_DURATION_MS;
  while (Date.now() < endAt) {
    for (const entry of sockets) {
      act(entry);
    }
    if (Date.now() - lastStateAt > 12_000) {
      freezeDetected = true;
      break;
    }
    await sleep(140);
  }

  const finalState = latestState.get(host.userId) || [...latestState.values()].pop();
  if (!finalState) {
    throw new Error("soak: no final state received");
  }
  assertNoGhostPlayers(finalState, "soak-final");

  for (const { socket } of sockets) {
    socket.disconnect();
  }

  return {
    roomId: created.roomId,
    roomCode: created.roomCode,
    roundsSeen: [...roundsSeen].sort((a, b) => a - b),
    finalRound: finalState.roundNumber,
    finalPhase: finalState.phase,
    freezeDetected,
    actions,
    readyActions,
    nextRoundActions,
    socketErrors: errors.length,
  };
}

async function main() {
  const startedAt = Date.now();
  const report = {
    startedAt: nowIso(),
    apiBaseUrl: API_BASE_URL,
    socketPath: SOCKET_PATH,
    checks: {},
    ok: false,
  };

  report.checks.login = await runLoginStability();
  report.checks.roomFlow = await runRoomFlowDeterminism();
  report.checks.soak = await runSoak10Rounds();

  const loginOk = report.checks.login.failures === 0;
  const roomFlowOk =
    report.checks.roomFlow.playersCount === report.checks.roomFlow.uniquePlayers &&
    report.checks.roomFlow.playersCount >= 4 &&
    report.checks.roomFlow.unexpectedSocketErrors === 0;
  const soakOk =
    report.checks.soak.freezeDetected === false &&
    report.checks.soak.finalRound >= 10 &&
    report.checks.soak.socketErrors === 0;

  report.ok = loginOk && roomFlowOk && soakOk;
  report.durationMs = Date.now() - startedAt;
  report.finishedAt = nowIso();

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        at: nowIso(),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
