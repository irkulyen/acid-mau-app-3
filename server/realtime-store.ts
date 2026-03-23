import { createClient, type RedisClientType } from "redis";
import type { GameState } from "../shared/game-types";
import type { SeatDrawResult } from "../shared/game-preparation";
import { ENV } from "./_core/env";

type PreparationData = {
  phase: "seat_selection" | "dealer_selection";
  seatDraws: SeatDrawResult[];
  dealerDraws: SeatDrawResult[];
  seatPickOrderUserIds: number[];
  seatChoices: Array<{ userId: number; seatPosition: number }>;
  currentPickerUserId: number | null;
};

class RealtimeStore {
  private readonly gameStates = new Map<number, GameState>();
  private readonly userRoomMapping = new Map<number, number>();
  private readonly pendingPreparation = new Map<number, PreparationData>();
  private redis: RedisClientType | null = null;
  private redisReady = false;
  private readonly keyPrefix = "acidmau:rt";

  async init() {
    if (!ENV.redisUrl) return;
    try {
      this.redis = createClient({ url: ENV.redisUrl });
      this.redis.on("error", (err) => {
        console.error("[realtime-store] Redis error:", err);
        this.redisReady = false;
      });
      await this.redis.connect();
      this.redisReady = true;
      console.log("[realtime-store] Redis connected");
    } catch (error) {
      this.redis = null;
      this.redisReady = false;
      console.warn("[realtime-store] Redis unavailable, using in-memory only");
    }
  }

  private markRedisUnavailable(operation: string, error: unknown) {
    this.redisReady = false;
    let detail = "";
    if (error instanceof Error) {
      detail = error.message;
    } else if (typeof error === "string") {
      detail = error;
    } else {
      try {
        detail = JSON.stringify(error);
      } catch {
        detail = String(error);
      }
    }
    console.warn(`[realtime-store] Redis ${operation} failed, falling back to in-memory: ${detail}`);
  }

  private keyGameState(roomId: number) {
    return `${this.keyPrefix}:game-state:${roomId}`;
  }

  private keyUserRoom(userId: number) {
    return `${this.keyPrefix}:user-room:${userId}`;
  }

  private keyPreparation(roomId: number) {
    return `${this.keyPrefix}:preparation:${roomId}`;
  }

  private keyRoomIds() {
    return `${this.keyPrefix}:room-ids`;
  }

  private keyUserIds() {
    return `${this.keyPrefix}:user-ids`;
  }

  private keyPreparationRoomIds() {
    return `${this.keyPrefix}:prep-room-ids`;
  }

  private async redisSetJson(key: string, value: unknown) {
    if (!this.redis || !this.redisReady) return;
    try {
      await this.redis.set(key, JSON.stringify(value));
    } catch (error) {
      this.markRedisUnavailable("set", error);
    }
  }

  private async redisGetJson<T>(key: string): Promise<T | null> {
    if (!this.redis || !this.redisReady) return null;
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      this.markRedisUnavailable("get", error);
      return null;
    }
  }

  async getGameState(roomId: number): Promise<GameState | undefined> {
    if (this.redis && this.redisReady) {
      const fromRedis = await this.redisGetJson<GameState>(this.keyGameState(roomId));
      if (fromRedis) {
        this.gameStates.set(roomId, fromRedis);
        return fromRedis;
      }
      const lastKnown = this.gameStates.get(roomId);
      if (lastKnown) {
        // Redis can briefly return null during transient availability gaps.
        // Keep room state continuity by serving last known in-memory snapshot.
        return lastKnown;
      }
      if (!this.redisReady) {
        return this.gameStates.get(roomId);
      }
      return undefined;
    }

    const inMemory = this.gameStates.get(roomId);
    if (inMemory) return inMemory;
    return undefined;
  }

  async setGameState(roomId: number, state: GameState): Promise<void> {
    this.gameStates.set(roomId, state);
    await this.redisSetJson(this.keyGameState(roomId), state);
    if (this.redis && this.redisReady) {
      try {
        await this.redis.sAdd(this.keyRoomIds(), String(roomId));
      } catch (error) {
        this.markRedisUnavailable("sAdd(room-ids)", error);
      }
    }
  }

  async deleteGameState(roomId: number): Promise<void> {
    this.gameStates.delete(roomId);
    if (this.redis && this.redisReady) {
      try {
        await this.redis.del(this.keyGameState(roomId));
        await this.redis.sRem(this.keyRoomIds(), String(roomId));
      } catch (error) {
        this.markRedisUnavailable("delete(game-state)", error);
      }
    }
  }

  async getAllRoomIds(): Promise<number[]> {
    const memoryIds = Array.from(this.gameStates.keys());
    if (!this.redis || !this.redisReady) {
      return memoryIds;
    }
    try {
      const redisIds = await this.redis.sMembers(this.keyRoomIds());
      const merged = new Set<number>(memoryIds);
      for (const id of redisIds) {
        const parsed = Number(id);
        if (Number.isFinite(parsed)) merged.add(parsed);
      }
      return Array.from(merged);
    } catch (error) {
      this.markRedisUnavailable("sMembers(room-ids)", error);
      return memoryIds;
    }
  }

  async setUserRoom(userId: number, roomId: number): Promise<void> {
    this.userRoomMapping.set(userId, roomId);
    await this.redisSetJson(this.keyUserRoom(userId), roomId);
    if (this.redis && this.redisReady) {
      try {
        await this.redis.sAdd(this.keyUserIds(), String(userId));
      } catch (error) {
        this.markRedisUnavailable("sAdd(user-ids)", error);
      }
    }
  }

  async getUserRoom(userId: number): Promise<number | undefined> {
    if (this.redis && this.redisReady) {
      const fromRedis = await this.redisGetJson<number>(this.keyUserRoom(userId));
      if (typeof fromRedis === "number") {
        this.userRoomMapping.set(userId, fromRedis);
        return fromRedis;
      }
      if (!this.redisReady) {
        return this.userRoomMapping.get(userId);
      }
      this.userRoomMapping.delete(userId);
      return undefined;
    }

    const inMemory = this.userRoomMapping.get(userId);
    if (inMemory !== undefined) return inMemory;
    return undefined;
  }

  async deleteUserRoom(userId: number): Promise<void> {
    this.userRoomMapping.delete(userId);
    if (this.redis && this.redisReady) {
      try {
        await this.redis.del(this.keyUserRoom(userId));
        await this.redis.sRem(this.keyUserIds(), String(userId));
      } catch (error) {
        this.markRedisUnavailable("delete(user-room)", error);
      }
    }
  }

  async getUserMappings(): Promise<Array<[number, number]>> {
    const entries = Array.from(this.userRoomMapping.entries());
    if (!this.redis || !this.redisReady) return entries;
    try {
      const userIds = await this.redis.sMembers(this.keyUserIds());
      for (const uid of userIds) {
        const userId = Number(uid);
        if (!Number.isFinite(userId)) continue;
        if (!this.userRoomMapping.has(userId)) {
          const roomId = await this.getUserRoom(userId);
          if (roomId !== undefined) entries.push([userId, roomId]);
        }
      }
      return entries;
    } catch (error) {
      this.markRedisUnavailable("sMembers(user-ids)", error);
      return entries;
    }
  }

  async setPreparation(roomId: number, data: PreparationData): Promise<void> {
    this.pendingPreparation.set(roomId, data);
    await this.redisSetJson(this.keyPreparation(roomId), data);
    if (this.redis && this.redisReady) {
      try {
        await this.redis.sAdd(this.keyPreparationRoomIds(), String(roomId));
      } catch (error) {
        this.markRedisUnavailable("sAdd(prep-room-ids)", error);
      }
    }
  }

  async getPreparation(roomId: number): Promise<PreparationData | undefined> {
    if (this.redis && this.redisReady) {
      const fromRedis = await this.redisGetJson<PreparationData>(this.keyPreparation(roomId));
      if (fromRedis) {
        this.pendingPreparation.set(roomId, fromRedis);
        return fromRedis;
      }
      if (!this.redisReady) {
        return this.pendingPreparation.get(roomId);
      }
      this.pendingPreparation.delete(roomId);
      return undefined;
    }

    const inMemory = this.pendingPreparation.get(roomId);
    if (inMemory) return inMemory;
    return undefined;
  }

  async hasPreparation(roomId: number): Promise<boolean> {
    if (this.pendingPreparation.has(roomId)) return true;
    if (!this.redis || !this.redisReady) return false;
    try {
      const exists = await this.redis.exists(this.keyPreparation(roomId));
      return exists > 0;
    } catch (error) {
      this.markRedisUnavailable("exists(preparation)", error);
      return false;
    }
  }

  async deletePreparation(roomId: number): Promise<void> {
    this.pendingPreparation.delete(roomId);
    if (this.redis && this.redisReady) {
      try {
        await this.redis.del(this.keyPreparation(roomId));
        await this.redis.sRem(this.keyPreparationRoomIds(), String(roomId));
      } catch (error) {
        this.markRedisUnavailable("delete(preparation)", error);
      }
    }
  }

  async clearAll(): Promise<void> {
    this.gameStates.clear();
    this.userRoomMapping.clear();
    this.pendingPreparation.clear();
    if (!this.redis || !this.redisReady) return;

    let roomIds: string[] = [];
    let userIds: string[] = [];
    let prepRoomIds: string[] = [];
    try {
      [roomIds, userIds, prepRoomIds] = await Promise.all([
        this.redis.sMembers(this.keyRoomIds()),
        this.redis.sMembers(this.keyUserIds()),
        this.redis.sMembers(this.keyPreparationRoomIds()),
      ]);
    } catch (error) {
      this.markRedisUnavailable("sMembers(clearAll)", error);
      return;
    }

    const keys: string[] = [];
    for (const roomId of roomIds) keys.push(this.keyGameState(Number(roomId)));
    for (const userId of userIds) keys.push(this.keyUserRoom(Number(userId)));
    for (const roomId of prepRoomIds) keys.push(this.keyPreparation(Number(roomId)));
    keys.push(this.keyRoomIds(), this.keyUserIds(), this.keyPreparationRoomIds());

    if (keys.length > 0) {
      try {
        await this.redis.del(keys);
      } catch (error) {
        this.markRedisUnavailable("del(clearAll)", error);
      }
    }
  }
}

export const realtimeStore = new RealtimeStore();
