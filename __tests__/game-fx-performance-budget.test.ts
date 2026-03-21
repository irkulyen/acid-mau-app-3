import {
  GAME_FX_PERF_BUDGET,
  getQueueLagMs,
  getStartDriftMs,
  shouldWarnQueueDepth,
  shouldWarnQueueLag,
  shouldWarnStartDrift,
} from "../lib/game-fx-performance-budget";

describe("game-fx performance budget", () => {
  it("measures queue lag only when startAt is in the past", () => {
    const now = 10_000;
    expect(getQueueLagMs({ startAt: now + 200 }, now)).toBe(0);
    expect(getQueueLagMs({ startAt: now - 300 }, now)).toBe(300);
  });

  it("measures start drift only when event starts late", () => {
    const now = 20_000;
    expect(getStartDriftMs({ startAt: now + 100 }, now)).toBe(0);
    expect(getStartDriftMs({ startAt: now - 420 }, now)).toBe(420);
  });

  it("warns only above configured thresholds", () => {
    expect(shouldWarnQueueDepth(GAME_FX_PERF_BUDGET.maxQueueDepth)).toBe(false);
    expect(shouldWarnQueueDepth(GAME_FX_PERF_BUDGET.maxQueueDepth + 1)).toBe(true);

    expect(shouldWarnQueueLag(GAME_FX_PERF_BUDGET.maxQueueLagMs)).toBe(false);
    expect(shouldWarnQueueLag(GAME_FX_PERF_BUDGET.maxQueueLagMs + 1)).toBe(true);

    expect(shouldWarnStartDrift(GAME_FX_PERF_BUDGET.maxStartDriftMs)).toBe(false);
    expect(shouldWarnStartDrift(GAME_FX_PERF_BUDGET.maxStartDriftMs + 1)).toBe(true);
  });
});

