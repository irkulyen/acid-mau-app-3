const isEnabled = (value: string | undefined) => value === "1" || value === "true";
const toPositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};
const toIntSet = (value: string | undefined): Set<number> => {
  const parsed = (value || "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return new Set(parsed);
};

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  publicBaseUrl:
    process.env.PUBLIC_BASE_URL ??
    process.env.SERVER_PUBLIC_BASE_URL ??
    process.env.EXTERNAL_API_BASE_URL ??
    process.env.EXPO_PUBLIC_API_URL ??
    "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  enableBots: isEnabled(process.env.ENABLE_BOTS),
  enableBlackbirdEvents: isEnabled(process.env.ENABLE_BLACKBIRD_EVENTS),
  enableAutoDrawForDisconnectedPlayers: isEnabled(process.env.ENABLE_AUTO_DRAW_FOR_DISCONNECTED_PLAYERS),
  enableAutoReadyOnRoundEnd: isEnabled(process.env.ENABLE_AUTO_READY_ON_ROUND_END),
  enableAutoNextRound: isEnabled(process.env.ENABLE_AUTO_NEXT_ROUND),
  enforceExplicitRuleset: isEnabled(process.env.ENFORCE_EXPLICIT_RULESET),
  rulesetId: process.env.RULESET_ID ?? "",
  enforceSingleSocketInstance:
    process.env.ENFORCE_SINGLE_SOCKET_INSTANCE === undefined
      ? process.env.NODE_ENV === "production"
      : isEnabled(process.env.ENFORCE_SINGLE_SOCKET_INSTANCE),
  singleSocketLockTtlSec: toPositiveInt(process.env.SINGLE_SOCKET_LOCK_TTL_SEC, 45),
  telemetryToken: process.env.TELEMETRY_TOKEN ?? "",
  roomReconcileIntervalMs: toPositiveInt(process.env.ROOM_RECONCILE_INTERVAL_MS, 60_000),
  adminUserIds: toIntSet(process.env.ADMIN_USER_IDS),
  serverBuildId:
    process.env.SERVER_BUILD_ID ??
    process.env.GIT_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    "dev",
};
