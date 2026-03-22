import * as roomManager from "./room-manager";
import { realtimeStore } from "./realtime-store";
import { telemetry } from "./telemetry";

type TimeoutHandle = ReturnType<typeof setTimeout>;

type RoomCleanupDeps = {
  roomCleanupTimeouts: Map<number, TimeoutHandle>;
  roomSockets: Map<number, Set<string>>;
  botTurnTimeouts: Map<number, TimeoutHandle>;
  turnTimeouts: Map<number, TimeoutHandle>;
  seatSelectionFailsafeTimeouts: Map<number, TimeoutHandle>;
  blackbirdHistory: Map<number, unknown>;
  blackbirdRuntime: Map<number, unknown>;
  gameFxHistory: Map<number, unknown>;
  roomFxSequences: Map<number, number>;
  roomFxNextStartAt: Map<number, number>;
  disconnectTimeouts: Map<number, NodeJS.Timeout>;
  clearReactionCooldownForRoom: (roomId: number) => void;
};

export function createRoomCleanupHelpers(deps: RoomCleanupDeps) {
  const {
    roomCleanupTimeouts,
    roomSockets,
    botTurnTimeouts,
    turnTimeouts,
    seatSelectionFailsafeTimeouts,
    blackbirdHistory,
    blackbirdRuntime,
    gameFxHistory,
    roomFxSequences,
    roomFxNextStartAt,
    disconnectTimeouts,
    clearReactionCooldownForRoom,
  } = deps;

  function cancelRoomCleanup(roomId: number) {
    const timeout = roomCleanupTimeouts.get(roomId);
    if (timeout) {
      clearTimeout(timeout);
      roomCleanupTimeouts.delete(roomId);
    }
  }

  function scheduleRoomCleanup(roomId: number, delayMs = 30 * 60 * 1000) {
    cancelRoomCleanup(roomId);
    const timeout = setTimeout(() => {
      void (async () => {
        const sockets = roomSockets.get(roomId);
        if (sockets && sockets.size > 0) return;

        const botTimeout = botTurnTimeouts.get(roomId);
        if (botTimeout) {
          clearTimeout(botTimeout);
          botTurnTimeouts.delete(roomId);
        }
        const turnTimeout = turnTimeouts.get(roomId);
        if (turnTimeout) {
          clearTimeout(turnTimeout);
          turnTimeouts.delete(roomId);
        }
        const seatTimeout = seatSelectionFailsafeTimeouts.get(roomId);
        if (seatTimeout) {
          clearTimeout(seatTimeout);
          seatSelectionFailsafeTimeouts.delete(roomId);
        }

        await realtimeStore.deleteGameState(roomId);
        roomSockets.delete(roomId);
        await realtimeStore.deletePreparation(roomId);
        blackbirdHistory.delete(roomId);
        blackbirdRuntime.delete(roomId);
        gameFxHistory.delete(roomId);
        roomFxSequences.delete(roomId);
        roomFxNextStartAt.delete(roomId);
        clearReactionCooldownForRoom(roomId);

        for (const [uid, mappedRoomId] of await realtimeStore.getUserMappings()) {
          if (mappedRoomId === roomId) {
            const disconnectTimeout = disconnectTimeouts.get(uid);
            if (disconnectTimeout) {
              clearTimeout(disconnectTimeout);
              disconnectTimeouts.delete(uid);
            }
            await realtimeStore.deleteUserRoom(uid);
          }
        }
        roomCleanupTimeouts.delete(roomId);
        void roomManager.deleteRoom(roomId);
        console.log(`[socket] Cleaned up inactive room ${roomId}`);
        telemetry.inc("rooms.cleaned_up");
      })();
    }, delayMs);

    roomCleanupTimeouts.set(roomId, timeout);
  }

  function handleSocketLeaveRoomTracking(roomId: number, socketId: string) {
    const sockets = roomSockets.get(roomId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      roomSockets.delete(roomId);
      scheduleRoomCleanup(roomId);
    }
  }

  function scheduleCleanupForEmptyTrackedRooms(roomIds: number[]) {
    for (const roomId of roomIds) {
      const sockets = roomSockets.get(roomId);
      if (sockets && sockets.size === 0) {
        console.log(`[socket] No more sockets in room ${roomId}, but keeping gameState for reconnect`);
        scheduleRoomCleanup(roomId);
      }
    }
  }

  return {
    cancelRoomCleanup,
    scheduleRoomCleanup,
    handleSocketLeaveRoomTracking,
    scheduleCleanupForEmptyTrackedRooms,
  };
}
