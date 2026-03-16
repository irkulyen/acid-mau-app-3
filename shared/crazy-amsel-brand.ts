import type { BlackbirdEventType } from "./game-types";

export type CrazyAmselRole = "commentator" | "chaos_amplifier" | "guide" | "brand_anchor";

export interface CrazyAmselMomentRule {
  eventType: BlackbirdEventType;
  role: CrazyAmselRole;
  trigger: string;
  maxDurationMs: number;
  multiplayerAllowed: boolean;
  emitOnNormalCardAction: boolean;
  pose: string;
}

export const CRAZY_AMSEL_MOMENT_MATRIX: Record<BlackbirdEventType, CrazyAmselMomentRule> = {
  round_start: {
    eventType: "round_start",
    role: "commentator",
    trigger: "start_of_new_round",
    maxDurationMs: 1800,
    multiplayerAllowed: true,
    emitOnNormalCardAction: false,
    pose: "flyby_start",
  },
  winner: {
    eventType: "winner",
    role: "commentator",
    trigger: "player_finishes_round",
    maxDurationMs: 2200,
    multiplayerAllowed: true,
    emitOnNormalCardAction: false,
    pose: "triumph_flap",
  },
  loser: {
    eventType: "loser",
    role: "commentator",
    trigger: "round_loser_resolved",
    maxDurationMs: 2000,
    multiplayerAllowed: true,
    emitOnNormalCardAction: false,
    pose: "dry_stare",
  },
  elimination: {
    eventType: "elimination",
    role: "chaos_amplifier",
    trigger: "player_eliminated",
    maxDurationMs: 2400,
    multiplayerAllowed: true,
    emitOnNormalCardAction: false,
    pose: "talon_lift",
  },
  draw_chain: {
    eventType: "draw_chain",
    role: "chaos_amplifier",
    trigger: "big_draw_chain",
    maxDurationMs: 1700,
    multiplayerAllowed: true,
    emitOnNormalCardAction: false,
    pose: "panic_glide",
  },
  chaos: {
    eventType: "chaos",
    role: "chaos_amplifier",
    trigger: "rare_chaos_moment",
    maxDurationMs: 1800,
    multiplayerAllowed: true,
    emitOnNormalCardAction: false,
    pose: "chaos_burst",
  },
  mvp: {
    eventType: "mvp",
    role: "brand_anchor",
    trigger: "reward_or_meta_moment",
    maxDurationMs: 2100,
    multiplayerAllowed: true,
    emitOnNormalCardAction: false,
    pose: "reward_nod",
  },
  guide: {
    eventType: "guide",
    role: "guide",
    trigger: "tutorial_hint",
    maxDurationMs: 1700,
    multiplayerAllowed: true,
    emitOnNormalCardAction: false,
    pose: "hint_hover",
  },
  ass: {
    eventType: "ass",
    role: "commentator",
    trigger: "legacy_event",
    maxDurationMs: 1200,
    multiplayerAllowed: false,
    emitOnNormalCardAction: false,
    pose: "legacy",
  },
  unter: {
    eventType: "unter",
    role: "commentator",
    trigger: "legacy_event",
    maxDurationMs: 1200,
    multiplayerAllowed: false,
    emitOnNormalCardAction: false,
    pose: "legacy",
  },
  seven_played: {
    eventType: "seven_played",
    role: "commentator",
    trigger: "legacy_event",
    maxDurationMs: 1200,
    multiplayerAllowed: false,
    emitOnNormalCardAction: false,
    pose: "legacy",
  },
};

export const CRAZY_AMSEL_ALLOWED_MULTIPLAYER_EVENTS = new Set<BlackbirdEventType>(
  Object.values(CRAZY_AMSEL_MOMENT_MATRIX)
    .filter((rule) => rule.multiplayerAllowed)
    .map((rule) => rule.eventType),
);

export const CRAZY_AMSEL_PHRASES: Record<BlackbirdEventType, string[]> = {
  round_start: [
    "Na gut. Neue Runde.",
    "Weiter geht's.",
    "Konzentriert euch.",
  ],
  winner: [
    "{player}: sauber.",
    "{player} ist durch.",
    "Sauber gespielt.",
  ],
  loser: [
    "{player}: das war nichts.",
    "Das war wohl nichts.",
    "Tja. Nächste Runde.",
  ],
  elimination: [
    "{player}: raus.",
    "Raus.",
    "{player} ist weg.",
  ],
  draw_chain: [
    "Oh oh.",
    "Das eskaliert.",
    "Das wird teuer (+{drawChainCount}).",
  ],
  chaos: [
    "Chaosmoment.",
    "Okay. Das wird wild.",
    "Das kippt gerade.",
  ],
  mvp: [
    "Highlight: {statsText}",
    "Starker Moment: {statsText}",
    "Meta-Moment: {statsText}",
  ],
  guide: [
    "Kurzer Hinweis: ruhig bleiben.",
    "Hinweis: auf die Top-Karte achten.",
    "Hinweis: spielbare Karten zuerst checken.",
  ],
  ass: ["Pause."],
  unter: ["Neue Farbe."],
  seven_played: ["Sieben gelegt."],
};

const fillTemplate = (template: string, values: Record<string, string | number | undefined>) =>
  template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    return value === undefined || value === null || value === "" ? "..." : String(value);
  });

export function getCrazyAmselPhraseCandidates(
  eventType: BlackbirdEventType,
  ctx: {
    playerName?: string;
    drawChainCount?: number;
    statsText?: string;
    roundNumber?: number;
    wishSuit?: string;
  } = {},
): string[] {
  const templates = CRAZY_AMSEL_PHRASES[eventType] || CRAZY_AMSEL_PHRASES.round_start;
  return templates.map((template) =>
    fillTemplate(template, {
      player: ctx.playerName,
      drawChainCount: ctx.drawChainCount,
      statsText: ctx.statsText,
      roundNumber: ctx.roundNumber,
      wishSuit: ctx.wishSuit,
    }),
  );
}

export function isCrazyAmselMultiplayerEvent(eventType: BlackbirdEventType): boolean {
  return CRAZY_AMSEL_ALLOWED_MULTIPLAYER_EVENTS.has(eventType);
}
