import { getGameFxUiPlan } from "../lib/game-fx-ui-plan";

describe("game-fx ui plan", () => {
  it("builds elimination banner/sound/completion deterministically", () => {
    const plan = getGameFxUiPlan({
      type: "elimination",
      eliminatedPlayerName: "Alice",
      playerName: "Alice",
    });

    expect(plan).not.toBeNull();
    expect(plan?.sound).toBe("elimination");
    expect(plan?.banner).toContain("Alice");
    expect(plan?.bannerDurationMs).toBe(2100);
    expect(plan?.completionMs).toBeGreaterThanOrEqual(900);
  });

  it("builds match result banner/sound/completion deterministically", () => {
    const plan = getGameFxUiPlan({
      type: "match_result",
      winnerPlayerName: "Bob",
      playerName: "Bob",
      roundNumber: 3,
    });

    expect(plan).not.toBeNull();
    expect(plan?.sound).toBe("victory");
    expect(plan?.banner).toContain("Bob");
    expect(plan?.bannerDurationMs).toBe(2600);
    expect(plan?.completionMs).toBeGreaterThanOrEqual(900);
  });

  it("returns null for non-endmoment events", () => {
    const plan = getGameFxUiPlan({
      type: "turn_transition",
      playerName: "Player",
    });
    expect(plan).toBeNull();
  });
});

