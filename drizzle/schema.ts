import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. Nullable for email/password users. */
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  /** Hashed password for email/password authentication. Null for OAuth users. */
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Player profiles with game statistics
export const playerProfiles = mysqlTable("player_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  avatarUrl: text("avatarUrl"),
  isPremium: int("isPremium").default(0).notNull(),
  premiumExpiresAt: timestamp("premiumExpiresAt"),
  totalGamesPlayed: int("totalGamesPlayed").default(0).notNull(),
  totalGamesWon: int("totalGamesWon").default(0).notNull(),
  currentWinStreak: int("currentWinStreak").default(0).notNull(),
  longestWinStreak: int("longestWinStreak").default(0).notNull(),
  totalLossPoints: int("totalLossPoints").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlayerProfile = typeof playerProfiles.$inferSelect;
export type InsertPlayerProfile = typeof playerProfiles.$inferInsert;

// Game rooms for multiplayer lobbies
export const gameRooms = mysqlTable("game_rooms", {
  id: int("id").autoincrement().primaryKey(),
  roomCode: varchar("roomCode", { length: 8 }).notNull().unique(),
  hostUserId: int("hostUserId").notNull(),
  status: mysqlEnum("status", ["waiting", "playing", "finished"]).default("waiting").notNull(),
  isPrivate: int("isPrivate").default(0).notNull(),
  maxPlayers: int("maxPlayers").default(4).notNull(),
  currentPlayers: int("currentPlayers").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  startedAt: timestamp("startedAt"),
  finishedAt: timestamp("finishedAt"),
});

export type GameRoom = typeof gameRooms.$inferSelect;
export type InsertGameRoom = typeof gameRooms.$inferInsert;

// Game history for completed games
export const gameHistory = mysqlTable("game_history", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  winnerId: int("winnerId").notNull(),
  totalRounds: int("totalRounds").notNull(),
  durationSeconds: int("durationSeconds").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GameHistory = typeof gameHistory.$inferSelect;
export type InsertGameHistory = typeof gameHistory.$inferInsert;

// Player participation in games
export const gameParticipants = mysqlTable("game_participants", {
  id: int("id").autoincrement().primaryKey(),
  gameHistoryId: int("gameHistoryId").notNull(),
  userId: int("userId").notNull(),
  finalPosition: int("finalPosition").notNull(),
  totalLossPoints: int("totalLossPoints").notNull(),
  cardsPlayed: int("cardsPlayed").notNull(),
});

export type GameParticipant = typeof gameParticipants.$inferSelect;
export type InsertGameParticipant = typeof gameParticipants.$inferInsert;

// Purchased cosmetics (card backs, themes)
export const purchasedCosmetics = mysqlTable("purchased_cosmetics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  cosmeticType: mysqlEnum("cosmeticType", ["card_back", "table_theme"]).notNull(),
  cosmeticId: varchar("cosmeticId", { length: 50 }).notNull(),
  purchasedAt: timestamp("purchasedAt").defaultNow().notNull(),
});

export type PurchasedCosmetic = typeof purchasedCosmetics.$inferSelect;
export type InsertPurchasedCosmetic = typeof purchasedCosmetics.$inferInsert;

// Friends list
export const friendships = mysqlTable("friendships", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  friendId: int("friendId").notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "blocked"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Friendship = typeof friendships.$inferSelect;
export type InsertFriendship = typeof friendships.$inferInsert;

// In-game chat messages
export const gameChatMessages = mysqlTable("game_chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  username: varchar("username", { length: 50 }).notNull(),
  message: varchar("message", { length: 200 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GameChatMessage = typeof gameChatMessages.$inferSelect;
export type InsertGameChatMessage = typeof gameChatMessages.$inferInsert;
