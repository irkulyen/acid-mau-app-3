import type { GameFxEvent } from "../shared/socket-contract";

export type GameFxCueSpec = {
  completionMs: number;
  impact: 1 | 2 | 3 | 4 | 5;
};

type CueInput = Pick<GameFxEvent, "type" | "specialRank" | "drawChainCount">;

export function getGameFxCueSpec(event: CueInput): GameFxCueSpec {
  switch (event.type) {
    case "special_card": {
      if (event.specialRank === "7") return { completionMs: 620, impact: 5 };
      if (event.specialRank === "ass") return { completionMs: 500, impact: 5 };
      if (event.specialRank === "bube") return { completionMs: 560, impact: 4 };
      if (event.specialRank === "8") return { completionMs: 520, impact: 4 };
      return { completionMs: 420, impact: 3 };
    }
    case "draw_chain": {
      const chain = Math.max(2, event.drawChainCount ?? 2);
      if (chain >= 5) return { completionMs: 620, impact: 5 };
      if (chain >= 4) return { completionMs: 600, impact: 5 };
      if (chain >= 3) return { completionMs: 580, impact: 4 };
      return { completionMs: 560, impact: 3 };
    }
    case "turn_transition":
      return { completionMs: 260, impact: 2 };
    case "elimination":
      return { completionMs: 900, impact: 5 };
    case "round_transition":
      return { completionMs: 650, impact: 4 };
    case "match_result":
      return { completionMs: 900, impact: 5 };
    default:
      return { completionMs: 300, impact: 2 };
  }
}
