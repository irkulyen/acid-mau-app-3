import type { GameFxEvent } from "../shared/socket-contract";
import { getGameFxCueSpec } from "./game-fx-cue-spec";

type PlanInput = Pick<
  GameFxEvent,
  "type" | "playerName" | "eliminatedPlayerName" | "winnerPlayerName" | "drawChainCount" | "specialRank" | "roundNumber"
>;

export type GameFxUiPlan = {
  banner: string;
  bannerDurationMs: number;
  completionMs: number;
  sound: "elimination" | "victory";
};

export function getGameFxUiPlan(event: PlanInput): GameFxUiPlan | null {
  if (event.type === "elimination") {
    const label = event.eliminatedPlayerName || event.playerName || "Spieler";
    return {
      banner: `💀 ${label} ist eliminiert`,
      bannerDurationMs: 2100,
      completionMs: getGameFxCueSpec(event).completionMs,
      sound: "elimination",
    };
  }

  if (event.type === "match_result") {
    const winnerName = event.winnerPlayerName || event.playerName || "Gewinner";
    return {
      banner: `🏆 ${winnerName} gewinnt das Match`,
      bannerDurationMs: 2600,
      completionMs: getGameFxCueSpec(event).completionMs,
      sound: "victory",
    };
  }

  return null;
}

