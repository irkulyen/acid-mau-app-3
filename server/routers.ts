import { z } from "zod";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { COOKIE_NAME } from "../shared/const.js";
import * as db from "./db";
import * as roomManager from "./room-manager";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { storagePut } from "./storage";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { realtimeStore } from "./realtime-store";

const DATA_IMAGE_REGEX = /^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i;

function isValidAvatarUrl(value: string): boolean {
  if (DATA_IMAGE_REGEX.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const avatarUrlInputSchema = z
  .string()
  .trim()
  .refine((value) => isValidAvatarUrl(value), {
    message: "avatarUrl must be an http(s) URL or data:image/*;base64",
  })
  .nullish();

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    register: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(6),
          username: z.string().min(3).max(50),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { hashPassword, createToken } = await import("./auth-helpers");
        
        // Check if email already exists
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          throw new Error("E-Mail bereits registriert");
        }
        
        // Hash password
        const passwordHash = await hashPassword(input.password);
        
        // Create user
        const userId = await db.createUser({
          email: input.email,
          passwordHash,
          name: input.username,
          loginMethod: "email",
        });
        
        // Create token
        const token = await createToken(userId, input.email);
        
        // Set cookie (same as login)
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        
        return { token, userId };
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { verifyPassword, createToken } = await import("./auth-helpers");
        const forwardedFor = ctx.req.headers["x-forwarded-for"];
        const clientIp =
          (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(",")[0]?.trim() ||
          ctx.req.socket.remoteAddress ||
          null;
        if (process.env.NODE_ENV !== "production") {
          console.log("[auth.login] Request received", {
            email: input.email,
            ip: clientIp,
            origin: ctx.req.headers.origin ?? null,
            userAgent: ctx.req.headers["user-agent"] ?? null,
          });
        }
        
        // Find user by email
        const user = await db.getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[auth.login] Invalid credentials (user not found/password missing)", {
              email: input.email,
              ip: clientIp,
            });
          }
          throw new Error("Ungültige Anmeldedaten");
        }
        
        // Verify password
        const isValid = await verifyPassword(input.password, user.passwordHash);
        if (!isValid) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[auth.login] Invalid credentials (password mismatch)", {
              email: input.email,
              ip: clientIp,
            });
          }
          throw new Error("Ungültige Anmeldedaten");
        }
        
        // Update last signed in
        await db.updateUserLastSignedIn(user.id);
        
        // Create token
        const token = await createToken(user.id, user.email!);
        
        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        if (process.env.NODE_ENV !== "production") {
          console.log("[auth.login] Success", { userId: user.id, email: input.email, ip: clientIp });
        }
        
        return { token, userId: user.id };
      }),
  }),

  // Player Profile Routes
  profile: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      return db.getPlayerProfile(ctx.user.id);
    }),
    create: protectedProcedure
      .input(
        z.object({
          username: z.string().min(3).max(50),
          avatarUrl: avatarUrlInputSchema,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getPlayerProfile(ctx.user.id);
        if (existing) throw new Error("Profile already exists");
        const usernameTaken = await db.getPlayerProfileByUsername(input.username);
        if (usernameTaken) throw new Error("Username already taken");
        const profileId = await db.createPlayerProfile({
          userId: ctx.user.id,
          username: input.username,
          avatarUrl: input.avatarUrl,
        });
        return { profileId };
      }),
    update: protectedProcedure
      .input(
        z.object({
          username: z.string().min(3).max(50).optional(),
          avatarUrl: avatarUrlInputSchema,
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.username) {
          const usernameTaken = await db.getPlayerProfileByUsername(input.username);
          if (usernameTaken && usernameTaken.userId !== ctx.user.id) {
            throw new Error("Username already taken");
          }
        }
        await db.updatePlayerProfile(ctx.user.id, input);
        return { success: true };
      }),
    uploadAvatar: protectedProcedure
      .input(
        z.object({
          base64: z.string().min(1),
          mimeType: z.string().min(3),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const allowed = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
        const normalizedMime = input.mimeType.toLowerCase();
        if (!allowed.has(normalizedMime)) {
          throw new Error("Unsupported image type");
        }

        const rawBase64 = input.base64.includes(",") ? input.base64.split(",").pop() || "" : input.base64;
        const binary = Buffer.from(rawBase64, "base64");
        if (!binary.length) {
          throw new Error("Invalid image payload");
        }

        const maxBytes = 2 * 1024 * 1024;
        if (binary.length > maxBytes) {
          throw new Error("Image too large (max 2MB)");
        }

        const ext = normalizedMime === "image/png" ? "png" : normalizedMime === "image/webp" ? "webp" : "jpg";
        const key = `avatars/u-${ctx.user.id}-${Date.now()}.${ext}`;

        let resolvedAvatarUrl: string;
        try {
          const uploaded = await storagePut(key, binary, normalizedMime);
          resolvedAvatarUrl = uploaded.url;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const missingStorageCredentials = message.includes(
            "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
          );
          if (!missingStorageCredentials) {
            throw error;
          }

          // Local/dev fallback without storage proxy: persist file on local disk and serve via /uploads.
          const fileName = `u-${ctx.user.id}-${Date.now()}.${ext}`;
          const uploadDir = path.join(process.cwd(), "uploads", "avatars");
          await mkdir(uploadDir, { recursive: true });
          await writeFile(path.join(uploadDir, fileName), binary);

          const forwardedProtoHeader = ctx.req.headers["x-forwarded-proto"];
          const forwardedHostHeader = ctx.req.headers["x-forwarded-host"];
          const proto =
            (Array.isArray(forwardedProtoHeader) ? forwardedProtoHeader[0] : forwardedProtoHeader)?.split(",")[0]?.trim() ||
            ctx.req.protocol ||
            "https";
          const host =
            (Array.isArray(forwardedHostHeader) ? forwardedHostHeader[0] : forwardedHostHeader)?.split(",")[0]?.trim() ||
            ctx.req.get("host");
          if (!host) {
            throw new Error("Avatar-Fallback fehlgeschlagen: Host nicht ermittelbar.");
          }

          resolvedAvatarUrl = `${proto}://${host}/uploads/avatars/${fileName}`;
        }

        const existingProfile = await db.getPlayerProfile(ctx.user.id);
        if (existingProfile) {
          await db.updatePlayerProfile(ctx.user.id, { avatarUrl: resolvedAvatarUrl });
        } else {
          const fallbackUsername = (ctx.user.name || ctx.user.email || `user-${ctx.user.id}`).slice(0, 50);
          await db.createPlayerProfile({
            userId: ctx.user.id,
            username: fallbackUsername,
            avatarUrl: resolvedAvatarUrl,
          });
        }
        return { avatarUrl: resolvedAvatarUrl };
      }),
    leaderboard: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(10) }))
      .query(async ({ input }) => {
        return db.getTopPlayers(input.limit);
      }),
    byUsername: publicProcedure.input(z.object({ username: z.string() })).query(async ({ input }) => {
      return db.getPlayerProfileByUsername(input.username);
    }),
  }),

  // Game Room Routes
  rooms: router({
    create: protectedProcedure
      .input(
        z.object({
          isPrivate: z.boolean().default(false),
          maxPlayers: z.number().min(2).max(6).default(4),
        })
      )
      .mutation(async ({ ctx, input }) => {
        let roomCode = "";
        let attempts = 0;
        do {
          roomCode = roomManager.generateRoomCode();
          attempts++;
        } while (attempts < 10 && (await db.getGameRoomByCode(roomCode)));
        if (!roomCode || (await db.getGameRoomByCode(roomCode))) {
          throw new Error("Failed to generate room code");
        }
        const roomId = await db.createGameRoom({
          roomCode,
          hostUserId: ctx.user.id,
          isPrivate: input.isPrivate ? 1 : 0,
          maxPlayers: input.maxPlayers,
          currentPlayers: 1,
          status: "waiting",
        });
        return { roomId, roomCode };
      }),
    byCode: protectedProcedure.input(z.object({ roomCode: z.string() })).query(async ({ input }) => {
      return db.getGameRoomByCode(input.roomCode);
    }),
    available: protectedProcedure.query(async () => {
      const rooms = await db.getAvailablePublicRooms();
      const result = [] as typeof rooms;

      for (const room of rooms) {
        const state = await realtimeStore.getGameState(room.id);
        if (!state) {
          // Stale DB room without active realtime session: hide from listing.
          continue;
        }

        if (state.phase !== "waiting") {
          continue;
        }

        const currentPlayers = state.players.length;
        const maxPlayers = state.maxPlayers ?? room.maxPlayers;
        if (currentPlayers >= maxPlayers) continue;
        result.push({ ...room, currentPlayers, maxPlayers, status: "waiting" });
      }

      return result;
    }),
    join: protectedProcedure
      .input(z.object({ roomCode: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const room = await db.getGameRoomByCode(input.roomCode);
        if (!room) throw new Error("Room not found");
        if (room.status !== "waiting") throw new Error("Room is not accepting players");
        if (room.currentPlayers >= room.maxPlayers) throw new Error("Room is full");
        await db.updateGameRoom(room.id, { currentPlayers: room.currentPlayers + 1 });
        return { success: true, room };
      }),
    start: protectedProcedure
      .input(z.object({ roomId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const room = await db.getGameRoom(input.roomId);
        if (!room) throw new Error("Room not found");
        if (room.hostUserId !== ctx.user.id) throw new Error("Only the host can start the game");
        if (room.currentPlayers < 2) throw new Error("Need at least 2 players to start");
        await db.updateGameRoom(input.roomId, { status: "playing", startedAt: new Date() });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ roomId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const room = await db.getGameRoom(input.roomId);
        if (!room) throw new Error("Room not found");
        if (room.hostUserId !== ctx.user.id) throw new Error("Only the host can delete the room");
        if (room.status !== "waiting") throw new Error("Can only delete rooms that are waiting");
        await db.deleteGameRoom(input.roomId);
        return { success: true };
      }),
  }),

  // Game History Routes
  history: router({
    mine: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
      .query(async ({ ctx, input }) => {
        return db.getPlayerGameHistory(ctx.user.id, input.limit);
      }),
  }),

  // Cosmetics Routes
  cosmetics: router({
    mine: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserCosmetics(ctx.user.id);
    }),
    purchase: protectedProcedure
      .input(
        z.object({
          cosmeticType: z.enum(["card_back", "table_theme"]),
          cosmeticId: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const hasIt = await db.hasCosmetic(ctx.user.id, input.cosmeticId);
        if (hasIt) throw new Error("You already own this cosmetic");
        await db.purchaseCosmetic({
          userId: ctx.user.id,
          cosmeticType: input.cosmeticType,
          cosmeticId: input.cosmeticId,
        });
        return { success: true };
      }),
  }),

  // Premium Routes
  premium: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const profile = await db.getPlayerProfile(ctx.user.id);
      if (!profile) return { isPremium: false };
      const isPremium =
        profile.isPremium === 1 && profile.premiumExpiresAt && profile.premiumExpiresAt > new Date();
      return { isPremium, expiresAt: profile.premiumExpiresAt };
    }),
    activate: protectedProcedure
      .input(z.object({ durationMonths: z.number().min(1).max(12).default(1) }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getPlayerProfile(ctx.user.id);
        if (!profile) throw new Error("Profile not found");
        const now = new Date();
        const expiresAt = new Date(now.getTime() + input.durationMonths * 30 * 24 * 60 * 60 * 1000);
        await db.updatePlayerProfile(ctx.user.id, { isPremium: 1, premiumExpiresAt: expiresAt });
        return { success: true, expiresAt };
      }),
  }),
});

export type AppRouter = typeof appRouter;
