export type BotProfile = {
  botId: string;
  name: string;
  avatarFile: string;
  fallbackInitial: string;
  aliases: string[];
};

export const BOT_PROFILES: BotProfile[] = [
  {
    botId: "bot_alf",
    name: "Alf",
    avatarFile: "alf.png",
    fallbackInitial: "A",
    aliases: ["alf", "botalf"],
  },
  {
    botId: "bot_yoda",
    name: "Yoda",
    avatarFile: "yoda.png",
    fallbackInitial: "Y",
    aliases: ["yoda", "joda", "botyoda", "botjoda"],
  },
  {
    botId: "bot_gollum",
    name: "Gollum",
    avatarFile: "gollum.png",
    fallbackInitial: "G",
    aliases: ["gollum", "botgollum"],
  },
  {
    botId: "bot_gizmo",
    name: "Gizmo",
    avatarFile: "gizmo.png",
    fallbackInitial: "G",
    aliases: ["gizmo", "botgizmo"],
  },
  {
    botId: "bot_pumuckel",
    name: "Pumuckel",
    avatarFile: "pumuckel.png",
    fallbackInitial: "P",
    aliases: ["pumuckel", "pumuckl", "botpumuckel", "botpumuckl"],
  },
];

function normalizeBotKey(raw: string): string {
  return (raw || "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

export function getBotProfileById(botId: string | null | undefined): BotProfile | undefined {
  if (!botId) return undefined;
  const normalized = normalizeBotKey(botId);
  return BOT_PROFILES.find((profile) => normalizeBotKey(profile.botId) === normalized);
}

export function getBotProfileByName(name: string | null | undefined): BotProfile | undefined {
  const key = normalizeBotKey(name || "");
  if (!key) return undefined;

  for (const profile of BOT_PROFILES) {
    if (
      normalizeBotKey(profile.name) === key ||
      profile.aliases.some((alias) => normalizeBotKey(alias) === key)
    ) {
      return profile;
    }
  }

  const tokens = (name || "").split(/\s+/).map(normalizeBotKey).filter(Boolean);
  for (const token of tokens) {
    for (const profile of BOT_PROFILES) {
      if (
        normalizeBotKey(profile.name) === token ||
        profile.aliases.some((alias) => normalizeBotKey(alias) === token)
      ) {
        return profile;
      }
    }
  }
  return undefined;
}

export function getBotProfileByUserId(userId: number): BotProfile | undefined {
  if (!Number.isInteger(userId) || userId >= 0) return undefined;
  const slot = Math.abs(userId) - 1;
  return BOT_PROFILES[slot % BOT_PROFILES.length];
}

