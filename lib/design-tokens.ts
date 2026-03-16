import { useMemo } from "react";
import { useColors } from "@/hooks/use-colors";

export type CoreDesignTokens = {
  PRIMARY_TABLE: string;
  SECONDARY_NEON: string;
  SURFACE_1: string;
  SURFACE_2: string;
  TEXT_MAIN: string;
  TEXT_MUTED: string;
  TEXT_INVERSE: string;
  STATE_SUCCESS: string;
  STATE_WARNING: string;
  STATE_DANGER: string;
};

export const FALLBACK_CORE_TOKENS: CoreDesignTokens = {
  PRIMARY_TABLE: "#0B3D2E",
  SECONDARY_NEON: "#3ED47A",
  SURFACE_1: "#1A1F25",
  SURFACE_2: "#1E2630",
  TEXT_MAIN: "#F3F7FB",
  TEXT_MUTED: "#AFC0CF",
  TEXT_INVERSE: "#0B1117",
  STATE_SUCCESS: "#32CD32",
  STATE_WARNING: "#FFB347",
  STATE_DANGER: "#FF6B6B",
};

export const GAME_UI_TOKENS = {
  BLACK: "#000000",
  PURE_WHITE: "#FFFFFF",
  TABLE_DARK: "#072E22",
  TABLE_LIGHT: "#14533C",
  FIELD_MARK: "#DDEBDF",
  TURN_CHIP_GLOW: "#66D092",
  MINI_CARD_BG: "#1A3A5C",
  MINI_CARD_BORDER: "#2A5A8C",
  MINI_CARD_INNER_BG: "#1E4A7A",
  MINI_CARD_INNER_BORDER: "#3A6A9C",
  MINI_CARD_TEXT: "#E2EAF1",
  PLAYER_AVATAR_TEXT: "#E8E8E8",
  PLAYER_ACTIVE_GLOW: "#66D092",
  WARNING_GLOW: "#FFD200",
  CLUTCH_TEXT: "#FFD89A",
  RIVALRY_TEXT: "#FFB3B3",
  HUD_TEXT_LIGHT: "#D9FBE7",
  CHAT_SURFACE_BORDER: "#334155",
  CHAT_CLOSE_TEXT: "#9BA1A6",
  CHAT_PLACEHOLDER: "#687076",
  CHAT_DIM_TEXT: "#666666",
  CHAT_WHITE: "#FFFFFF",
  STATE_DISABLED: "#666666",
  SUIT_EICHEL: "#8B4513",
  SUIT_GRUEN: "#228B22",
  SUIT_ROT: "#DC143C",
  SUIT_SCHELLEN: "#DAA520",
} as const;

export const PLAYING_CARD_TOKENS = {
  SUIT_EICHEL: "#6F4A1D",
  SUIT_GRUEN: "#2E7D32",
  SUIT_ROT: "#B71C1C",
  SUIT_SCHELLEN: "#9C6B14",
  CARD_FACE_BG: "#F5F2E8",
  CARD_SHADOW: "#000000",
  CARD_BACK_BG: "#1E2022",
  CARD_BACK_BORDER: "#334155",
} as const;

export const PREPARATION_TOKENS = {
  SUIT_EICHEL: "#8B4513",
  SUIT_GRUEN: "#228B22",
  SUIT_ROT: "#DC143C",
  SUIT_SCHELLEN: "#DAA520",
  HIGHLIGHT_SEAT: "#FFD700",
  HIGHLIGHT_DEALER: "#00FF88",
  TEXT_WHITE: "#FFFFFF",
  TEXT_MUTED: "#9BA1A6",
  CARD_BACK_BG: "#1A3A5C",
  CARD_BACK_BORDER: "#2A5A8C",
  CARD_BACK_INNER_BORDER: "#3A6A9C",
  CARD_BACK_INNER_BG: "#1E4A7A",
  CARD_BACK_TEXT: "#4A8ABC",
  CARD_FRONT_BG: "#FFFEF5",
  CARD_FRONT_BORDER: "#D4D0C0",
  CARD_SHADOW: "#000000",
  TEXT_SOFT: "#CCCCCC",
  TEXT_LIGHT: "#ECEDEE",
  TEXT_MAIN: "#E8E8E8",
  TEXT_SUB: "#B6BDC6",
} as const;

export const FX_TOKENS = {
  WISH_TEXT_SELECTED: "#D8FFE8",
  WISH_TEXT_DEFAULT: "#E6EDF3",
  DRAW_CHAIN_SHADOW: "#FF0000",
  DRAW_CHAIN_FLASH: "#FFFFFF",
} as const;

export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const normalized =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => `${c}${c}`)
          .join("")
      : clean;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

export function useCoreDesignTokens(): CoreDesignTokens {
  const colors = useColors() as Record<string, string>;
  return useMemo(
    () => ({
      PRIMARY_TABLE: colors.primaryTable ?? FALLBACK_CORE_TOKENS.PRIMARY_TABLE,
      SECONDARY_NEON: colors.secondaryNeon ?? FALLBACK_CORE_TOKENS.SECONDARY_NEON,
      SURFACE_1: colors.surface1 ?? FALLBACK_CORE_TOKENS.SURFACE_1,
      SURFACE_2: colors.surface2 ?? FALLBACK_CORE_TOKENS.SURFACE_2,
      TEXT_MAIN: colors.textMain ?? FALLBACK_CORE_TOKENS.TEXT_MAIN,
      TEXT_MUTED: colors.textMuted ?? FALLBACK_CORE_TOKENS.TEXT_MUTED,
      TEXT_INVERSE: colors.textInverse ?? FALLBACK_CORE_TOKENS.TEXT_INVERSE,
      STATE_SUCCESS: colors.stateSuccess ?? FALLBACK_CORE_TOKENS.STATE_SUCCESS,
      STATE_WARNING: colors.stateWarning ?? FALLBACK_CORE_TOKENS.STATE_WARNING,
      STATE_DANGER: colors.stateDanger ?? FALLBACK_CORE_TOKENS.STATE_DANGER,
    }),
    [colors],
  );
}
