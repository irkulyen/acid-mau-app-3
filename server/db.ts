import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2/promise";
import {
  InsertUser,
  users,
  playerProfiles,
  gameRooms,
  gameHistory,
  gameParticipants,
  purchasedCosmetics,
  friendships,
  gameChatMessages,
  InsertPlayerProfile,
  InsertGameRoom,
  InsertGameHistory,
  InsertGameParticipant,
  InsertPurchasedCosmetic,
  InsertFriendship,
  InsertGameChatMessage,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;
let _databaseName: string | null = null;
let _usersAuthSchemaEnsurePromise: Promise<void> | null = null;

const DEV_TEST_USER = {
  id: 1,
  openId: null,
  name: "testuser",
  email: "test@test.com",
  passwordHash: "$2b$10$b6GYmtGzeYphOpdzPoO5L.W7Y7uPaw17Vrt10CtGmUnh45XECAu1.",
  loginMethod: "email",
  role: "user" as const,
  createdAt: new Date("2026-02-01T14:08:31.000Z"),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function getDevTestUserByEmail(email: string) {
  if (process.env.NODE_ENV !== "development") return null;
  return email === DEV_TEST_USER.email ? { ...DEV_TEST_USER } : null;
}

function getDevTestUserById(id: number) {
  if (process.env.NODE_ENV !== "development") return null;
  return id === DEV_TEST_USER.id ? { ...DEV_TEST_USER } : null;
}

function normalizeErrorMessage(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    return `${error.message} ${normalizeErrorMessage(cause)}`.trim();
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function ensureUsersAuthSchema(pool: Pool, databaseName: string): Promise<void> {
  const [rows] = await pool.query(
    `
      SELECT COLUMN_NAME, IS_NULLABLE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME IN ('openId', 'passwordHash')
    `,
    [databaseName],
  );

  const columns = new Map<string, string>();
  for (const row of rows as Array<{ COLUMN_NAME: string; IS_NULLABLE: string }>) {
    columns.set(row.COLUMN_NAME, row.IS_NULLABLE);
  }

  const statements: Array<{ reason: string; sql: string }> = [];
  if (!columns.has("passwordHash")) {
    statements.push({
      reason: "missing users.passwordHash",
      sql: "ALTER TABLE `users` ADD COLUMN `passwordHash` varchar(255) NULL",
    });
  }

  const openIdNullable = columns.get("openId");
  if (openIdNullable === "NO") {
    statements.push({
      reason: "users.openId is not nullable",
      sql: "ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64) NULL",
    });
  }

  if (statements.length === 0) {
    return;
  }

  console.warn(
    `[Database] users auth schema drift detected in "${databaseName}". Applying ${statements.length} fix(es)...`,
  );

  for (const stmt of statements) {
    await pool.query(stmt.sql);
    console.warn(`[Database] Applied auth schema fix: ${stmt.reason}`);
  }
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const databaseUrl = new URL(process.env.DATABASE_URL);
      const normalizedHost = databaseUrl.hostname.replace(/^\[(.*)\]$/, "$1");
      _pool = createPool({
        host: normalizedHost,
        port: databaseUrl.port ? Number(databaseUrl.port) : 3306,
        user: decodeURIComponent(databaseUrl.username),
        password: decodeURIComponent(databaseUrl.password),
        database: databaseUrl.pathname.replace(/^\//, ""),
        waitForConnections: true,
        connectionLimit: 10,
      });
      _db = drizzle(_pool) as unknown as ReturnType<typeof drizzle>;
      _databaseName = databaseUrl.pathname.replace(/^\//, "");
      if (_databaseName && !_usersAuthSchemaEnsurePromise) {
        _usersAuthSchemaEnsurePromise = ensureUsersAuthSchema(_pool, _databaseName).catch((error) => {
          console.warn(
            "[Database] Could not auto-heal users auth schema. Run `pnpm db:push` on the backend host.",
            error,
          );
        });
      }
      if (_usersAuthSchemaEnsurePromise) {
        await _usersAuthSchemaEnsurePromise;
      }
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _pool = null;
      _databaseName = null;
      _usersAuthSchemaEnsurePromise = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// Player Profile Functions
// ============================================================================

export async function getPlayerProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(playerProfiles).where(eq(playerProfiles.userId, userId)).limit(1);
  return result[0] || null;
}

export async function getPlayerProfileByUsername(username: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(playerProfiles).where(eq(playerProfiles.username, username)).limit(1);
  return result[0] || null;
}

export async function createPlayerProfile(data: InsertPlayerProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(playerProfiles).values(data);
  const inserted = await getPlayerProfile(data.userId);
  return inserted?.id || 0;
}

export async function updatePlayerProfile(userId: number, data: Partial<InsertPlayerProfile>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(playerProfiles).set(data).where(eq(playerProfiles.userId, userId));
}

export async function updatePlayerStats(userId: number, won: boolean, lossPoints: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const profile = await getPlayerProfile(userId);
  if (!profile) return;

  const updates: Partial<InsertPlayerProfile> = {
    totalGamesPlayed: profile.totalGamesPlayed + 1,
    totalLossPoints: profile.totalLossPoints + lossPoints,
  };

  if (won) {
    updates.totalGamesWon = profile.totalGamesWon + 1;
    updates.currentWinStreak = profile.currentWinStreak + 1;
    if (updates.currentWinStreak > profile.longestWinStreak) {
      updates.longestWinStreak = updates.currentWinStreak;
    }
  } else {
    updates.currentWinStreak = 0;
  }

  await updatePlayerProfile(userId, updates);
}

export async function getTopPlayers(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(playerProfiles).orderBy(desc(playerProfiles.totalGamesWon)).limit(limit);
}

// ============================================================================
// Game Room Functions
// ============================================================================

export async function createGameRoom(data: InsertGameRoom) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(gameRooms).values(data);
  const inserted = await getGameRoomByCode(data.roomCode);
  return inserted?.id || 0;
}

export async function getGameRoom(roomId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(gameRooms).where(eq(gameRooms.id, roomId)).limit(1);
  return result[0] || null;
}

export async function getGameRoomByCode(roomCode: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(gameRooms).where(eq(gameRooms.roomCode, roomCode)).limit(1);
  return result[0] || null;
}

export async function updateGameRoom(roomId: number, data: Partial<InsertGameRoom>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(gameRooms).set(data).where(eq(gameRooms.id, roomId));
}

export async function deleteGameRoom(roomId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(gameRooms).where(eq(gameRooms.id, roomId));
}

export async function getAvailablePublicRooms() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(gameRooms)
    .where(and(eq(gameRooms.status, "waiting"), eq(gameRooms.isPrivate, 0)))
    .orderBy(desc(gameRooms.createdAt));
}

export async function getWaitingRooms() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(gameRooms)
    .where(eq(gameRooms.status, "waiting"))
    .orderBy(desc(gameRooms.createdAt));
}

// ============================================================================
// Game History Functions
// ============================================================================

export async function createGameHistory(data: InsertGameHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(gameHistory).values(data);
  return Number((result as any)?.[0]?.insertId ?? 0);
}

export async function createGameParticipant(data: InsertGameParticipant) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(gameParticipants).values(data);
  return Number((result as any)?.[0]?.insertId ?? 0);
}

export async function getPlayerGameHistory(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(gameParticipants)
    .where(eq(gameParticipants.userId, userId))
    .orderBy(desc(gameParticipants.id))
    .limit(limit);
}

// ============================================================================
// Cosmetics Functions
// ============================================================================

export async function purchaseCosmetic(data: InsertPurchasedCosmetic) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(purchasedCosmetics).values(data);
  return 0; // Return 0 as we don't have a unique identifier to query
}

export async function getUserCosmetics(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(purchasedCosmetics).where(eq(purchasedCosmetics.userId, userId));
}

export async function hasCosmetic(userId: number, cosmeticId: string) {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select()
    .from(purchasedCosmetics)
    .where(and(eq(purchasedCosmetics.userId, userId), eq(purchasedCosmetics.cosmeticId, cosmeticId)))
    .limit(1);

  return result.length > 0;
}

// ============================================================================
// Friends Functions
// ============================================================================

export async function createFriendship(data: InsertFriendship) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(friendships).values(data);
  return 0; // Return 0 as we don't have a unique identifier to query
}

export async function getUserFriends(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(friendships)
    .where(and(eq(friendships.userId, userId), eq(friendships.status, "accepted")));
}

export async function getFriendshipStatus(userId: number, friendId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(friendships)
    .where(and(eq(friendships.userId, userId), eq(friendships.friendId, friendId)))
    .limit(1);

  return result[0] || null;
}

export async function updateFriendshipStatus(
  userId: number,
  friendId: number,
  status: "pending" | "accepted" | "blocked"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(friendships)
    .set({ status })
    .where(and(eq(friendships.userId, userId), eq(friendships.friendId, friendId)));
}

// ===== Email/Password Authentication Functions =====

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return getDevTestUserByEmail(email);

  try {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.warn("[Database] getUserByEmail failed, using dev fallback if available:", error);
    return getDevTestUserByEmail(email);
  }
}

/**
 * Get user by ID
 */
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return getDevTestUserById(id);

  try {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.warn("[Database] getUserById failed, using dev fallback if available:", error);
    return getDevTestUserById(id);
  }
}

/**
 * Create a new user with email/password
 */
export async function createUser(data: {
  email: string;
  passwordHash: string;
  name: string;
  loginMethod: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const result = await db.insert(users).values({
      openId: null,
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name,
      loginMethod: data.loginMethod,
      role: "user",
    });

    return Number(result[0].insertId);
  } catch (error) {
    const message = normalizeErrorMessage(error);
    const likelyAuthSchemaDrift =
      message.includes("Failed query: insert into `users`") &&
      (message.includes("`passwordHash`") || message.includes("`openId`"));
    if (likelyAuthSchemaDrift) {
      throw new Error(
        "Datenbankschema fuer E-Mail-Login ist veraltet. Fuehre auf dem Backend-Host `pnpm db:push` aus und starte den Server neu.",
      );
    }
    throw error;
  }
}

/**
 * Update user's last signed in timestamp
 */
export async function updateUserLastSignedIn(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
  } catch (error) {
    if (process.env.NODE_ENV === "development" && userId === DEV_TEST_USER.id) {
      console.warn("[Database] updateUserLastSignedIn failed for dev test user:", error);
      return;
    }
    throw error;
  }
}

// ─── Chat Messages ────────────────────────────────────────────────────────────

export async function saveChatMessage(data: InsertGameChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(gameChatMessages).values(data);
  return result[0].insertId;
}

export async function getRoomChatMessages(roomId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(gameChatMessages)
    .where(eq(gameChatMessages.roomId, roomId))
    .orderBy(gameChatMessages.createdAt)
    .limit(limit);
}

export async function deleteRoomChatMessages(roomId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(gameChatMessages).where(eq(gameChatMessages.roomId, roomId));
}
