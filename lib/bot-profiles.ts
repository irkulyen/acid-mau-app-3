import { getApiBaseUrl } from "@/constants/oauth";
import {
  BOT_PROFILES as SHARED_BOT_PROFILES,
  getBotProfileById as getSharedBotProfileById,
  getBotProfileByName as getSharedBotProfileByName,
  getBotProfileByUserId as getSharedBotProfileByUserId,
  type BotProfile as SharedBotProfile,
} from "@/shared/bot-profiles";

export type BotProfile = SharedBotProfile & {
  imagePath?: number;
};

const LOCAL_BOT_IMAGES: Record<string, number> = {
  bot_alf: require("../assets/bots/alf.png"),
  bot_yoda: require("../assets/bots/yoda.png"),
  bot_gollum: require("../assets/bots/gollum.png"),
  bot_gizmo: require("../assets/bots/gizmo.png"),
  bot_pumuckel: require("../assets/bots/pumuckel.png"),
};

function withLocalImage(profile: SharedBotProfile | undefined): BotProfile | undefined {
  if (!profile) return undefined;
  return {
    ...profile,
    imagePath: LOCAL_BOT_IMAGES[profile.botId],
  };
}

function resolveBotAvatarUrl(profile: SharedBotProfile | undefined): string | undefined {
  if (!profile) return undefined;
  try {
    const baseUrl = getApiBaseUrl();
    return `${baseUrl}/assets/bots/${profile.avatarFile}`;
  } catch {
    return undefined;
  }
}

export function getBotProfileById(botId: string | null | undefined): BotProfile | undefined {
  return withLocalImage(getSharedBotProfileById(botId));
}

export function getBotProfileByName(name: string | null | undefined): BotProfile | undefined {
  return withLocalImage(getSharedBotProfileByName(name));
}

export function getBotProfileByUserId(userId: number): BotProfile | undefined {
  return withLocalImage(getSharedBotProfileByUserId(userId));
}

export function getBotAvatarSource(params: {
  botId?: string | null;
  botName?: string | null;
  userId?: number | null;
  avatarUrl?: string | null;
  preferLocalFallback?: boolean;
}): { uri: string } | number | undefined {
  const remote = (params.avatarUrl || "").trim();
  if (remote) {
    return { uri: remote };
  }
  const profile =
    getSharedBotProfileById(params.botId) ??
    getSharedBotProfileByName(params.botName) ??
    (typeof params.userId === "number" ? getSharedBotProfileByUserId(params.userId) : undefined);
  const serverUrl = resolveBotAvatarUrl(profile);
  if (serverUrl) {
    return { uri: serverUrl };
  }
  if (!params.preferLocalFallback) return undefined;
  return profile ? LOCAL_BOT_IMAGES[profile.botId] : undefined;
}

export const BOT_PROFILES: BotProfile[] = SHARED_BOT_PROFILES.map((profile) => ({
  ...profile,
  imagePath: LOCAL_BOT_IMAGES[profile.botId],
}));

