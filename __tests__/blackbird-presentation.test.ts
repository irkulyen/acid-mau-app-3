import { resolveBlackbirdPresentation } from "../components/game/blackbird-presentation";

describe("blackbird presentation", () => {
  it("is deterministic for identical payloads", () => {
    const input = {
      eventId: "evt-1",
      eventType: "draw_chain" as const,
      drawChainCount: 4,
      winnerName: undefined,
      loserName: undefined,
      wishSuit: undefined,
      statsText: undefined,
      phraseFromServer: undefined,
    };

    const a = resolveBlackbirdPresentation(input);
    const b = resolveBlackbirdPresentation(input);

    expect(a.eventType).toBe("draw_chain");
    expect(a.phrase).toBe(b.phrase);
    expect(a.seedBase).toBe(b.seedBase);
  });

  it("forces winner/loser event type from payload ownership", () => {
    const winner = resolveBlackbirdPresentation({
      eventId: "evt-win",
      eventType: "round_start",
      winnerName: "Alice",
    });
    expect(winner.eventType).toBe("winner");
    expect(winner.phrase.length).toBeGreaterThan(0);

    const loser = resolveBlackbirdPresentation({
      eventId: "evt-lose",
      eventType: "round_start",
      loserName: "Bob",
    });
    expect(loser.eventType).toBe("loser");
    expect(loser.phrase.length).toBeGreaterThan(0);
  });

  it("preserves fallback to round_start phrase for incomplete special payload", () => {
    const unterWithoutSuit = resolveBlackbirdPresentation({
      eventId: "evt-unter",
      eventType: "unter",
      wishSuit: undefined,
    });
    expect(unterWithoutSuit.eventType).toBe("unter");
    expect(unterWithoutSuit.phrase.length).toBeGreaterThan(0);
  });

  it("honors server-provided phrase override", () => {
    const explicit = resolveBlackbirdPresentation({
      eventId: "evt-phrase",
      eventType: "ass",
      phraseFromServer: "Server says sit tight",
    });
    expect(explicit.phrase).toBe("Server says sit tight");
  });
});

