import { describe, it, expect } from "vitest";
import { BOT_PROFILES, getBotProfileById, getBotProfileByName, getBotProfileByUserId } from "../bot-profiles";

describe("Bot profile registry", () => {
  it("contains all required bots with stable IDs", () => {
    const ids = BOT_PROFILES.map((p) => p.botId);
    expect(ids).toEqual([
      "bot_alf",
      "bot_yoda",
      "bot_gollum",
      "bot_gizmo",
      "bot_pumuckel",
    ]);
  });

  it("resolves by id and by common aliases", () => {
    expect(getBotProfileById("bot_alf")?.name).toBe("Alf");
    expect(getBotProfileByName("Yoda")?.botId).toBe("bot_yoda");
    expect(getBotProfileByName("Joda")?.botId).toBe("bot_yoda");
    expect(getBotProfileByName("Pumuckl")?.botId).toBe("bot_pumuckel");
  });

  it("maps negative bot user IDs deterministically", () => {
    expect(getBotProfileByUserId(-1)?.botId).toBe("bot_alf");
    expect(getBotProfileByUserId(-2)?.botId).toBe("bot_yoda");
    expect(getBotProfileByUserId(-3)?.botId).toBe("bot_gollum");
    expect(getBotProfileByUserId(-4)?.botId).toBe("bot_gizmo");
    expect(getBotProfileByUserId(-5)?.botId).toBe("bot_pumuckel");
    // Wrap after 5 bots
    expect(getBotProfileByUserId(-6)?.botId).toBe("bot_alf");
  });
});

