import * as db from "./db";
import { ENV } from "./_core/env";

/**
 * In-Memory Room Manager
 * Fallback wenn DB nicht antwortet
 * Verhindert Race Conditions und doppelte Räume
 */

interface RoomRecord {
  id: number;
  roomCode: string;
  hostUserId: number;
  maxPlayers: number;
  status: "waiting" | "playing" | "finished";
  createdAt: Date;
}

// In-Memory room storage (fallback)
const inMemoryRooms = new Map<string, RoomRecord>();
let nextRoomId = 1;

function shouldUseInMemoryFallback() {
  return !ENV.isProduction;
}

/**
 * Generiere einen eindeutigen Room-Code (6 Zeichen, alphanumerisch)
 */
export function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Erstelle einen neuen Raum
 * Versucht DB zuerst, fällt auf In-Memory zurück
 */
export async function createRoom(data: {
  roomCode: string;
  hostUserId: number;
  maxPlayers?: number;
  isPrivate?: boolean;
}): Promise<RoomRecord> {
  const maxPlayers = data.maxPlayers || 5;
  const isPrivate = data.isPrivate === true;

  // Versuche DB zuerst
  try {
    const dbRoom = await db.getGameRoomByCode(data.roomCode);
    if (dbRoom) {
      return {
        id: dbRoom.id,
        roomCode: dbRoom.roomCode,
        hostUserId: dbRoom.hostUserId,
        maxPlayers: dbRoom.maxPlayers || 5,
        status: (dbRoom.status as any) || "waiting",
        createdAt: dbRoom.createdAt || new Date(),
      };
    }

    // Erstelle in DB
    const roomId = await db.createGameRoom({
      roomCode: data.roomCode,
      hostUserId: data.hostUserId,
      maxPlayers,
      status: "waiting",
      isPrivate: isPrivate ? 1 : 0,
    });

    const room: RoomRecord = {
      id: roomId,
      roomCode: data.roomCode,
      hostUserId: data.hostUserId,
      maxPlayers,
      status: "waiting",
      createdAt: new Date(),
    };

    inMemoryRooms.set(data.roomCode, room);
    console.log(`[room-manager] Room created in DB: ${data.roomCode} (${roomId})`);
    return room;
  } catch (dbError) {
    if (!shouldUseInMemoryFallback()) {
      throw dbError;
    }
    console.warn(`[room-manager] DB create failed, using in-memory: ${dbError}`);

    // Fallback: In-Memory
    const room: RoomRecord = {
      id: nextRoomId++,
      roomCode: data.roomCode,
      hostUserId: data.hostUserId,
      maxPlayers,
      status: "waiting",
      createdAt: new Date(),
    };

    inMemoryRooms.set(data.roomCode, room);
    console.log(`[room-manager] Room created in-memory: ${data.roomCode} (${room.id})`);
    return room;
  }
}

/**
 * Hole einen Raum nach Code
 * Mit Timeout und Fallback
 */
export async function getRoomByCode(roomCode: string): Promise<RoomRecord | null> {
  // Prüfe zuerst In-Memory (schnell)
  const inMemory = inMemoryRooms.get(roomCode);
  if (inMemory) {
    return inMemory;
  }

  // Versuche DB mit Timeout (3 Sekunden)
  try {
    const dbRoom = await Promise.race([
      db.getGameRoomByCode(roomCode),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("DB query timeout")), 3000)
      ),
    ]);

    if (dbRoom) {
      const room: RoomRecord = {
        id: dbRoom.id,
        roomCode: dbRoom.roomCode,
        hostUserId: dbRoom.hostUserId,
        maxPlayers: dbRoom.maxPlayers || 5,
        status: (dbRoom.status as any) || "waiting",
        createdAt: dbRoom.createdAt || new Date(),
      };

      // Cache in In-Memory
      inMemoryRooms.set(roomCode, room);
      return room;
    }

    return null;
  } catch (error) {
    if (!shouldUseInMemoryFallback()) {
      throw error;
    }
    console.warn(`[room-manager] DB query failed for ${roomCode}, checking in-memory only: ${error}`);
    // Fallback: In-Memory ist schon oben geprüft
    return null;
  }
}

/**
 * Hole einen Raum nach ID
 */
export async function getRoomById(roomId: number): Promise<RoomRecord | null> {
  // Prüfe In-Memory
  for (const room of inMemoryRooms.values()) {
    if (room.id === roomId) {
      return room;
    }
  }

  // Versuche DB mit Timeout
  try {
    const dbRoom = await Promise.race([
      db.getGameRoom(roomId),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("DB query timeout")), 3000)
      ),
    ]);

    if (dbRoom) {
      const room: RoomRecord = {
        id: dbRoom.id,
        roomCode: dbRoom.roomCode,
        hostUserId: dbRoom.hostUserId,
        maxPlayers: dbRoom.maxPlayers || 5,
        status: (dbRoom.status as any) || "waiting",
        createdAt: dbRoom.createdAt || new Date(),
      };

      inMemoryRooms.set(dbRoom.roomCode, room);
      return room;
    }

    return null;
  } catch (error) {
    if (!shouldUseInMemoryFallback()) {
      throw error;
    }
    console.warn(`[room-manager] DB query failed for room ${roomId}: ${error}`);
    return null;
  }
}

/**
 * Aktualisiere Raum-Status
 */
export async function updateRoomStatus(
  roomId: number,
  status: "waiting" | "playing" | "finished"
): Promise<void> {
  // Update In-Memory
  for (const room of inMemoryRooms.values()) {
    if (room.id === roomId) {
      room.status = status;
      break;
    }
  }

  // Versuche DB zu aktualisieren (non-blocking)
  try {
    await Promise.race([
      db.updateGameRoom(roomId, { status }),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("DB update timeout")), 3000)
      ),
    ]);
    console.log(`[room-manager] Room ${roomId} status updated to ${status}`);
  } catch (error) {
    if (!shouldUseInMemoryFallback()) {
      throw error;
    }
    console.warn(`[room-manager] DB update failed for room ${roomId}: ${error}`);
  }
}

export async function updateRoomSnapshot(
  roomId: number,
  data: { status: "waiting" | "playing" | "finished"; currentPlayers: number; maxPlayers: number }
): Promise<void> {
  for (const room of inMemoryRooms.values()) {
    if (room.id === roomId) {
      room.status = data.status;
      room.maxPlayers = data.maxPlayers;
      break;
    }
  }

  try {
    await Promise.race([
      db.updateGameRoom(roomId, {
        status: data.status,
        currentPlayers: data.currentPlayers,
        maxPlayers: data.maxPlayers,
      }),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("DB update timeout")), 3000)
      ),
    ]);
  } catch (error) {
    if (!shouldUseInMemoryFallback()) {
      throw error;
    }
    console.warn(`[room-manager] DB snapshot update failed for room ${roomId}: ${error}`);
  }
}

/**
 * Lösche einen Raum
 */
export async function deleteRoom(roomId: number): Promise<void> {
  // Entferne aus In-Memory
  for (const [code, room] of inMemoryRooms.entries()) {
    if (room.id === roomId) {
      inMemoryRooms.delete(code);
      break;
    }
  }

  // Versuche aus DB zu löschen (non-blocking)
  try {
    await Promise.race([
      db.deleteGameRoom(roomId),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("DB delete timeout")), 3000)
      ),
    ]);
    console.log(`[room-manager] Room ${roomId} deleted`);
  } catch (error) {
    if (!shouldUseInMemoryFallback()) {
      throw error;
    }
    console.warn(`[room-manager] DB delete failed for room ${roomId}: ${error}`);
  }
}

/**
 * Hole alle öffentlichen Räume
 */
export async function getPublicRooms(): Promise<RoomRecord[]> {
  // Versuche DB zuerst
  try {
    const dbRooms = await Promise.race([
      db.getAvailablePublicRooms(),
      new Promise<any[]>((_, reject) =>
        setTimeout(() => reject(new Error("DB query timeout")), 3000)
      ),
    ]);

    return dbRooms.map((r) => ({
      id: r.id,
      roomCode: r.roomCode,
      hostUserId: r.hostUserId,
      maxPlayers: r.maxPlayers || 5,
      status: (r.status as any) || "waiting",
      createdAt: r.createdAt || new Date(),
    }));
  } catch (error) {
    if (!shouldUseInMemoryFallback()) {
      throw error;
    }
    console.warn(`[room-manager] DB query failed for public rooms: ${error}`);
    // Fallback: In-Memory Räume die "waiting" sind
    return Array.from(inMemoryRooms.values()).filter((r) => r.status === "waiting");
  }
}

/**
 * Debugge: Zeige alle In-Memory Räume
 */
export function debugRooms(): void {
  console.log(`[room-manager] In-Memory Rooms: ${inMemoryRooms.size}`);
  for (const [code, room] of inMemoryRooms.entries()) {
    console.log(`  ${code}: id=${room.id}, status=${room.status}, players=${room.maxPlayers}`);
  }
}
