import { getBlackbirdMotionProfile } from "../components/game/blackbird-motion-profile";

describe("blackbird motion profile", () => {
  it("keeps winner moments clearly stronger than round_start", () => {
    const winner = getBlackbirdMotionProfile("winner", 4);
    const roundStart = getBlackbirdMotionProfile("round_start", 4);

    expect(winner.quickEvent).toBe(false);
    expect(roundStart.quickEvent).toBe(true);
    expect(winner.flashPeak).toBeGreaterThan(roundStart.flashPeak);
    expect(winner.shakeAmplitude).toBeGreaterThan(roundStart.shakeAmplitude);
    expect(winner.trailCount).toBeGreaterThan(roundStart.trailCount);
  });

  it("keeps draw-chain fast but escalated", () => {
    const base = getBlackbirdMotionProfile("draw_chain", 2);
    const heavy = getBlackbirdMotionProfile("draw_chain", 5);

    expect(base.quickEvent).toBe(true);
    expect(heavy.quickEvent).toBe(true);
    expect(heavy.flashPeak).toBeGreaterThan(base.flashPeak);
    expect(heavy.shakeAmplitude).toBeGreaterThanOrEqual(base.shakeAmplitude);
    expect(heavy.trailCount).toBeGreaterThanOrEqual(base.trailCount);
  });

  it("uses distinct quick profiles for direction shift vs invalid", () => {
    const direction = getBlackbirdMotionProfile("direction_shift", 3);
    const invalid = getBlackbirdMotionProfile("invalid", 1);

    expect(direction.quickEvent).toBe(true);
    expect(invalid.quickEvent).toBe(true);
    expect(direction.flightPattern).toBe("precision_curve");
    expect(invalid.flightPattern).toBe("shake_reject");
    expect(direction.wingBeatMs).toBeLessThan(invalid.wingBeatMs);
  });

  it("boosts legendary winner profile without changing event semantics", () => {
    const normal = getBlackbirdMotionProfile("winner", 3);
    const legendary = getBlackbirdMotionProfile("winner", 3, "legendary");

    expect(legendary.quickEvent).toBe(false);
    expect(legendary.flashPeak).toBeGreaterThan(normal.flashPeak);
    expect(legendary.glowCycles).toBeGreaterThanOrEqual(normal.glowCycles);
    expect(legendary.spriteCycles).toBeGreaterThanOrEqual(normal.spriteCycles);
  });
});
