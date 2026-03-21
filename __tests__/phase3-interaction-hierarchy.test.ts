import { getBlackbirdMotionProfile } from "../components/game/blackbird-motion-profile";
import { getGameFxCueSpec } from "../lib/game-fx-cue-spec";

describe("phase3 interaction hierarchy", () => {
  it("keeps standard turn transitions below special events", () => {
    const standard = getGameFxCueSpec({ type: "turn_transition" });
    const special = getGameFxCueSpec({ type: "special_card", specialRank: "7" });
    const chain = getGameFxCueSpec({ type: "draw_chain", drawChainCount: 4 });

    expect(special.impact).toBeGreaterThan(standard.impact);
    expect(chain.impact).toBeGreaterThanOrEqual(special.impact);
    expect(chain.completionMs).toBeGreaterThan(standard.completionMs);
  });

  it("keeps elimination and victory at top impact tier", () => {
    const elimination = getGameFxCueSpec({ type: "elimination" });
    const victory = getGameFxCueSpec({ type: "match_result" });

    expect(elimination.impact).toBe(5);
    expect(victory.impact).toBe(5);
    expect(elimination.completionMs).toBeGreaterThanOrEqual(900);
    expect(victory.completionMs).toBeGreaterThanOrEqual(900);
  });

  it("keeps blackbird winner cinematic while ass/unter stay snappy", () => {
    const winner = getBlackbirdMotionProfile("winner", 4);
    const ass = getBlackbirdMotionProfile("ass", 4);
    const unter = getBlackbirdMotionProfile("unter", 4);

    expect(winner.quickEvent).toBe(false);
    expect(ass.quickEvent).toBe(true);
    expect(unter.quickEvent).toBe(true);
    expect(winner.speechDurationMs).toBeGreaterThan(ass.speechDurationMs);
    expect(winner.flashPeak).toBeGreaterThan(unter.flashPeak);
  });
});
