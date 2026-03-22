import type { Server as SocketIOServer, Socket } from "socket.io";
import { telemetry } from "./telemetry";

type RoomSocketsMap = Map<number, Set<string>>;
type SocketUserMapping = Map<string, number>;

export function createRoomPresenceHelpers(deps: {
  roomSockets: RoomSocketsMap;
  socketUserMapping: SocketUserMapping;
}) {
  const { roomSockets, socketUserMapping } = deps;

  function detachSocketFromTrackedRooms(socket: Socket): number[] {
    const detached: number[] = [];
    for (const [roomId, sockets] of roomSockets.entries()) {
      if (!sockets.delete(socket.id)) continue;
      socket.leave(`room-${roomId}`);
      detached.push(roomId);
      if (sockets.size === 0) {
        roomSockets.delete(roomId);
      }
    }
    return detached;
  }

  function attachSocketToTrackedRoom(socket: Socket, roomId: number) {
    detachSocketFromTrackedRooms(socket);
    socket.join(`room-${roomId}`);
    if (!roomSockets.has(roomId)) {
      roomSockets.set(roomId, new Set());
    }
    roomSockets.get(roomId)!.add(socket.id);
  }

  function isUserConnectedInRoom(roomId: number, userId: number): boolean {
    const sockets = roomSockets.get(roomId);
    if (!sockets) return false;
    for (const socketId of sockets) {
      if (socketUserMapping.get(socketId) === userId) return true;
    }
    return false;
  }

  function evictDuplicateUserSocketsInRoom(
    io: SocketIOServer,
    roomId: number,
    userId: number,
    keepSocketId: string,
  ) {
    const sockets = roomSockets.get(roomId);
    if (!sockets || sockets.size <= 1) return;

    let evicted = 0;
    for (const sid of Array.from(sockets)) {
      if (sid === keepSocketId) continue;
      if (socketUserMapping.get(sid) !== userId) continue;
      const staleSocket = io.sockets.sockets.get(sid);
      staleSocket?.leave(`room-${roomId}`);
      sockets.delete(sid);
      socketUserMapping.delete(sid);
      evicted += 1;
    }

    if (evicted > 0) {
      telemetry.inc("rooms.duplicate_user_socket_evicted", evicted);
      console.warn(
        `[socket] Evicted ${evicted} duplicate socket(s) for user ${userId} in room ${roomId}; keep=${keepSocketId}`,
      );
    }
  }

  return {
    attachSocketToTrackedRoom,
    detachSocketFromTrackedRooms,
    evictDuplicateUserSocketsInRoom,
    isUserConnectedInRoom,
  };
}
