import { shouldShowSecondaryGameBanner } from "@/lib/ux-status";
import type { Card, CardSuit } from "@/shared/game-types";

const SUIT_ICON: Record<CardSuit, string> = {
  eichel: "🌰",
  gruen: "🍀",
  rot: "❤️",
  schellen: "🔔",
};

const RANK_LABEL: Record<Card["rank"], string> = {
  "7": "7",
  "8": "8",
  "9": "9",
  "10": "10",
  bube: "B",
  dame: "D",
  konig: "K",
  ass: "A",
};

export function getWishSuitLabel(suit: CardSuit | null): string {
  if (!suit) return "";
  if (suit === "eichel") return "🌰 Eichel oder Unter";
  if (suit === "gruen") return "🍀 Grün oder Unter";
  if (suit === "rot") return "❤️ Rot oder Unter";
  return "🔔 Schellen oder Unter";
}

export function getEffectiveDiscardLabel(card?: Card): string {
  if (!card) return "";
  return `${SUIT_ICON[card.suit]} ${RANK_LABEL[card.rank]}`;
}

export function getSecondaryStatusBannerFlags(params: {
  isCompactHeight: boolean;
  drawChainCount: number;
  hasWishSuit: boolean;
  hasNoPlayableCards: boolean;
  hasActiveFx: boolean;
  clutchBanner: string | null;
  rivalryBanner: string | null;
  momentBanner: string | null;
}) {
  const showSecondaryBanners = shouldShowSecondaryGameBanner({
    isCompactHeight: params.isCompactHeight,
    drawChainCount: params.drawChainCount,
    hasWishSuit: params.hasWishSuit,
    hasNoPlayableCards: params.hasNoPlayableCards,
    hasActiveFx: params.hasActiveFx,
  });
  return {
    showClutchOrRivalryBanner: showSecondaryBanners && Boolean(params.clutchBanner || params.rivalryBanner),
    showMomentStatusBanner: showSecondaryBanners && Boolean(params.momentBanner),
  };
}
