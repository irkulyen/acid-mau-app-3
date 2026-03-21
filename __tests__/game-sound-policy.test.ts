import {
  computeNextMixState,
  filterScheduledByPriority,
  getGlobalGapMs,
  getHoldPriorityMs,
  isBlockedByCooldown,
  isBlockedByGlobalGap,
  isBlockedByPriorityWindow,
  shouldDropScheduledSound,
  type MixPriorityState,
} from "../hooks/game-sound-policy";

describe("game sound policy", () => {
  it("uses stricter global gaps for low-priority cues", () => {
    expect(getGlobalGapMs(2)).toBe(95);
    expect(getGlobalGapMs(3)).toBe(75);
    expect(getGlobalGapMs(4)).toBe(60);
  });

  it("applies priority-window suppression for lower-priority sounds", () => {
    const activeMix: MixPriorityState = { priority: 4, until: 2_000 };
    expect(isBlockedByPriorityWindow(1_500, 2, activeMix)).toBe(true);
    expect(isBlockedByPriorityWindow(1_500, 4, activeMix)).toBe(false);
    expect(isBlockedByPriorityWindow(2_100, 2, activeMix)).toBe(false);
  });

  it("applies cooldown and global-gap checks deterministically", () => {
    expect(isBlockedByCooldown(1_000, 960, 80)).toBe(true);
    expect(isBlockedByCooldown(1_100, 960, 80)).toBe(false);

    expect(isBlockedByGlobalGap(1_000, 2, 930, false)).toBe(true);
    expect(isBlockedByGlobalGap(1_000, 4, 930, false)).toBe(false);
    expect(isBlockedByGlobalGap(1_000, 2, 930, true)).toBe(false);
  });

  it("computes next mix window without lowering active priority", () => {
    const activeMix: MixPriorityState = { priority: 4, until: 1_500 };
    const next = computeNextMixState(1_000, 3, activeMix);
    expect(next.priority).toBe(4);
    expect(next.until).toBe(1_500);

    const escalate = computeNextMixState(1_000, 5, activeMix, 420);
    expect(escalate.priority).toBe(5);
    expect(escalate.until).toBe(1_500);
  });

  it("drops delayed low-priority tails on high-impact cues", () => {
    expect(shouldDropScheduledSound(2, 4)).toBe(true);
    expect(shouldDropScheduledSound(3, 5)).toBe(true);
    expect(shouldDropScheduledSound(4, 4)).toBe(false);
    expect(shouldDropScheduledSound(2, 3)).toBe(false);

    const filtered = filterScheduledByPriority(
      [
        { priority: 2 as const, id: "a" },
        { priority: 4 as const, id: "b" },
        { priority: 3 as const, id: "c" },
      ],
      4,
    );
    expect(filtered.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("keeps documented default hold windows", () => {
    expect(getHoldPriorityMs(2)).toBe(120);
    expect(getHoldPriorityMs(3)).toBe(200);
    expect(getHoldPriorityMs(4)).toBe(280);
    expect(getHoldPriorityMs(5, 360)).toBe(360);
  });
});

