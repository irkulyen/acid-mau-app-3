import * as roomManager from "./room-manager";
import { realtimeStore } from "./realtime-store";
import type { GameState } from "../shared/game-types";

export const STATE_AUTHORITY = {
  roomState: "room-manager",
  presenceState: "game-socket",
  gameState: "realtime-store",
} as const;

export async function createRoomMetadata(input: {
  hostUserId: number;
  maxPlayers: number;
  isPrivate: boolean;
  maxAttempts?: number;
}): Promise<{ roomId: number; roomCode: string; maxPlayers: number }> {
  const maxAttempts = Math.max(1, input.maxAttempts ?? 10);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const roomCode = roomManager.generateRoomCode();
    const existing = await roomManager.getRoomByCode(roomCode);
    if (existing) continue;

    const created = await roomManager.createRoom({
      roomCode,
      hostUserId: input.hostUserId,
      maxPlayers: input.maxPlayers,
      isPrivate: input.isPrivate,
    });

    // Guard against rare race where another host won the same roomCode.
    if (created.hostUserId !== input.hostUserId) {
      continue;
    }

    return {
      roomId: created.id,
      roomCode: created.roomCode,
      maxPlayers: created.maxPlayers,
    };
  }

  throw new Error("Failed to generate unique room code");
}

/**
 * Small first unification step:
 * Ensure room deletion clears metadata + realtime state together.
 */
export async function deleteRoomAcrossAuthorities(roomId: number): Promise<{
  removedUserMappings: number;
}> {
  await realtimeStore.deletePreparation(roomId);
  await realtimeStore.deleteGameState(roomId);

  let removedUserMappings = 0;
  for (const [userId, mappedRoomId] of await realtimeStore.getUserMappings()) {
    if (mappedRoomId !== roomId) continue;
    await realtimeStore.deleteUserRoom(userId);
    removedUserMappings += 1;
  }

  await roomManager.deleteRoom(roomId);
  return { removedUserMappings };
}

export async function syncRoomMetadataFromGameState(roomId: number, state: GameState): Promise<void> {
  const status: "waiting" | "playing" | "finished" =
    state.phase === "waiting" ? "waiting" : state.phase === "game_end" ? "finished" : "playing";

  await roomManager.updateRoomSnapshot(roomId, {
    status,
    currentPlayers: state.players.length,
    maxPlayers: state.maxPlayers ?? 5,
  });
}

export async function ensureUserRoomMappingByMembership(
  userId: number,
  roomId: number,
  state?: GameState,
): Promise<boolean> {
  const authoritativeState = state ?? (await realtimeStore.getGameState(roomId));
  const isMember = Boolean(authoritativeState?.players.some((player) => player.userId === userId));

  if (!isMember) {
    const mappedRoomId = await realtimeStore.getUserRoom(userId);
    if (mappedRoomId === roomId) {
      await realtimeStore.deleteUserRoom(userId);
    }
    return false;
  }

  await realtimeStore.setUserRoom(userId, roomId);
  return true;
}
