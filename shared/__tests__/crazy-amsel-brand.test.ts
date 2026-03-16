import { describe, expect, it } from "vitest";
import {
  CRAZY_AMSEL_ALLOWED_MULTIPLAYER_EVENTS,
  CRAZY_AMSEL_MOMENT_MATRIX,
  getCrazyAmselPhraseCandidates,
  isCrazyAmselMultiplayerEvent,
} from "../crazy-amsel-brand";

describe("Crazy Amsel brand matrix", () => {
  it("allows only curated multiplayer brand moments", () => {
    expect(isCrazyAmselMultiplayerEvent("round_start")).toBe(true);
    expect(isCrazyAmselMultiplayerEvent("winner")).toBe(true);
    expect(isCrazyAmselMultiplayerEvent("loser")).toBe(true);
    expect(isCrazyAmselMultiplayerEvent("elimination")).toBe(true);
    expect(isCrazyAmselMultiplayerEvent("draw_chain")).toBe(true);
    expect(isCrazyAmselMultiplayerEvent("chaos")).toBe(true);
    expect(isCrazyAmselMultiplayerEvent("mvp")).toBe(true);
    expect(isCrazyAmselMultiplayerEvent("guide")).toBe(true);
  });

  it("excludes normal card-action markers from multiplayer brand moments", () => {
    expect(CRAZY_AMSEL_ALLOWED_MULTIPLAYER_EVENTS.has("ass")).toBe(false);
    expect(CRAZY_AMSEL_ALLOWED_MULTIPLAYER_EVENTS.has("unter")).toBe(false);
    expect(CRAZY_AMSEL_ALLOWED_MULTIPLAYER_EVENTS.has("seven_played")).toBe(false);
  });

  it("defines stable event metadata for brand usage", () => {
    expect(CRAZY_AMSEL_MOMENT_MATRIX.elimination.pose).toBe("talon_lift");
    expect(CRAZY_AMSEL_MOMENT_MATRIX.draw_chain.role).toBe("chaos_amplifier");
    expect(CRAZY_AMSEL_MOMENT_MATRIX.round_start.multiplayerAllowed).toBe(true);
    expect(CRAZY_AMSEL_MOMENT_MATRIX.round_start.emitOnNormalCardAction).toBe(false);
  });

  it("returns short phrase candidates in the defined tone", () => {
    const candidates = getCrazyAmselPhraseCandidates("elimination", { playerName: "Maik" });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((text) => text.toLowerCase().includes("raus"))).toBe(true);
    expect(candidates.every((text) => text.length <= 48)).toBe(true);
  });
});
