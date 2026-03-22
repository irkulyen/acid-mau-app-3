import type { GameState } from "../shared/game-types";
import * as roomManager from "./room-manager";
import { realtimeStore } from "./realtime-store";
import { telemetry } from "./telemetry";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type UserRoomMembership = {
  roomId: number;
  state: GameState;
};

export async function getRoomByCodeWithRetry(roomCode: string, attempts = 3, delayMs = 120) {
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const room = await roomManager.getRoomByCode(roomCode);
      if (room) return room;
    } catch (error) {
      lastError = error;
    }
    if (i < attempts - 1) await sleep(delayMs * (i + 1));
  }
  if (lastError) throw lastError;
  return null;
}

export async function getGameStateWithRetry(roomId: number, attempts = 3, delayMs = 120): Promise<GameState | undefined> {
  for (let i = 0; i < attempts; i++) {
    const state = await realtimeStore.getGameState(roomId);
    if (state) return state;
    if (i < attempts - 1) await sleep(delayMs * (i + 1));
  }
  return undefined;
}

async function getUserRoomMemberships(userId: number): Promise<UserRoomMembership[]> {
  const roomIds = await realtimeStore.getAllRoomIds();
  const memberships: UserRoomMembership[] = [];
  for (const roomId of roomIds) {
    const state = await realtimeStore.getGameState(roomId);
    if (!state) continue;
    if (state.players.some((player) => player.userId === userId)) {
      memberships.push({ roomId, state });
    }
  }
  return memberships;
}

export async function getAuthoritativeUserSession(userId: number): Promise<UserRoomMembership | null> {
  const mappedRoomId = await realtimeStore.getUserRoom(userId);
  if (mappedRoomId) {
    const mappedState = await getGameStateWithRetry(mappedRoomId, 2, 80);
    if (mappedState?.players.some((player) => player.userId === userId)) {
      return { roomId: mappedRoomId, state: mappedState };
    }
    await realtimeStore.deleteUserRoom(userId);
    telemetry.inc("rooms.mapping_stale_cleared");
    console.warn(`[socket] Cleared stale user-room mapping userId=${userId} roomId=${mappedRoomId}`);
  }

  const memberships = await getUserRoomMemberships(userId);
  if (memberships.length === 1) {
    await realtimeStore.setUserRoom(userId, memberships[0].roomId);
    telemetry.inc("rooms.mapping_recovered.scan");
    return memberships[0];
  }
  if (memberships.length > 1) {
    telemetry.inc("rooms.user_multi_membership_detected");
    console.error(
      `[socket] User ${userId} appears in multiple rooms: ${memberships.map((m) => m.roomId).join(", ")}`,
    );
  }
  return null;
}

export async function clearUserRoomMappingIfMatches(userId: number, roomId: number) {
  const mappedRoomId = await realtimeStore.getUserRoom(userId);
  if (mappedRoomId === roomId) {
    await realtimeStore.deleteUserRoom(userId);
  }
}
