export type BotProfile = {
  botId: string;
  name: string;
  imagePath: number;
  fallbackInitial: string;
  aliases: string[];
};

const BOT_PROFILES: BotProfile[] = [
  {
    botId: "bot_alf",
    name: "Alf",
    imagePath: require("../assets/bots/alf.png"),
    fallbackInitial: "A",
    aliases: ["alf", "botalf"],
  },
  {
    botId: "bot_yoda",
    name: "Joda",
    imagePath: require("../assets/bots/yoda.png"),
    fallbackInitial: "Y",
    aliases: ["yoda", "joda", "botyoda", "botjoda"],
  },
  {
    botId: "bot_gollum",
    name: "Gollum",
    imagePath: require("../assets/bots/gollum.png"),
    fallbackInitial: "G",
    aliases: ["gollum", "botgollum"],
  },
  {
    botId: "bot_gizmo",
    name: "Gizmo",
    imagePath: require("../assets/bots/gizmo.png"),
    fallbackInitial: "G",
    aliases: ["gizmo", "botgizmo"],
  },
  {
    botId: "bot_pumuckel",
    name: "Pumuckel",
    imagePath: require("../assets/bots/pumuckel.png"),
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

export function getBotProfileByName(name: string): BotProfile | undefined {
  const key = normalizeBotKey(name);
  if (!key) return undefined;

  for (const profile of BOT_PROFILES) {
    if (profile.aliases.some((alias) => normalizeBotKey(alias) === key)) {
      return profile;
    }
  }

  // Token fallback (e.g. "Bot Gizmo")
  const tokens = (name || "").split(/\s+/).map(normalizeBotKey).filter(Boolean);
  for (const token of tokens) {
    for (const profile of BOT_PROFILES) {
      if (profile.aliases.some((alias) => normalizeBotKey(alias) === token)) {
        return profile;
      }
    }
  }

  return undefined;
}

export { BOT_PROFILES };
