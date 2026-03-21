import { getGameFxCueSpec } from "../lib/game-fx-cue-spec";

describe("game fx cue spec", () => {
  it("assigns stronger impact to special cards than default transitions", () => {
    const special7 = getGameFxCueSpec({ type: "special_card", specialRank: "7" });
    const special8 = getGameFxCueSpec({ type: "special_card", specialRank: "8" });
    const turnTransition = getGameFxCueSpec({ type: "turn_transition" });

    expect(special7.impact).toBeGreaterThan(turnTransition.impact);
    expect(special7.completionMs).toBeGreaterThan(turnTransition.completionMs);
    expect(special8.impact).toBeGreaterThanOrEqual(special7.impact);
    expect(special8.completionMs).toBeGreaterThanOrEqual(special7.completionMs);
  });

  it("escalates draw-chain impact with larger chains", () => {
    const chain2 = getGameFxCueSpec({ type: "draw_chain", drawChainCount: 2 });
    const chain5 = getGameFxCueSpec({ type: "draw_chain", drawChainCount: 5 });

    expect(chain5.impact).toBeGreaterThanOrEqual(chain2.impact);
    expect(chain5.completionMs).toBeGreaterThan(chain2.completionMs);
  });

  it("keeps elimination and match result at top impact tier", () => {
    const elimination = getGameFxCueSpec({ type: "elimination" });
    const matchResult = getGameFxCueSpec({ type: "match_result" });

    expect(elimination.impact).toBe(5);
    expect(matchResult.impact).toBe(5);
    expect(elimination.completionMs).toBeGreaterThanOrEqual(900);
    expect(matchResult.completionMs).toBeGreaterThanOrEqual(900);
  });
});
