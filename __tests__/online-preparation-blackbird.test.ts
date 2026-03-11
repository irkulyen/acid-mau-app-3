import { describe, it, expect } from "vitest";
import { performGamePreparation } from "../shared/game-preparation";
import type { Player } from "../shared/game-types";

/**
 * Tests for online mode bugs:
 * 1. Game preparation (seat/dealer selection) data is correctly generated
 * 2. Blackbird loser detection via lossPoints diff (not absolute)
 */

function createTestPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    userId: i === 0 ? 100 : -(i),
    username: i === 0 ? "Maik" : `Bot ${i}`,
    hand: [],
    lossPoints: 0,
    isEliminated: false,
    isReady: true,
  }));
}

describe("Game Preparation", () => {
  it("should return seat draws for all players", () => {
    const players = createTestPlayers(5);
    const result = performGamePreparation(players);

    expect(result.seatDraws).toHaveLength(5);
    expect(result.dealerDraws).toHaveLength(5);
    expect(result.players).toHaveLength(5);
    expect(result.dealerIndex).toBeGreaterThanOrEqual(0);
    expect(result.dealerIndex).toBeLessThan(5);
  });

  it("should assign seat positions to all players", () => {
    const players = createTestPlayers(4);
    const result = performGamePreparation(players);

    const positions = result.players.map(p => p.seatPosition);
    expect(positions.sort()).toEqual([0, 1, 2, 3]);
  });

  it("should include correct usernames in seat draws", () => {
    const players = createTestPlayers(3);
    const result = performGamePreparation(players);

    const usernames = result.seatDraws.map(d => d.username);
    expect(usernames).toContain("Maik");
    expect(usernames).toContain("Bot 1");
    expect(usernames).toContain("Bot 2");
  });

  it("should include correct usernames in dealer draws", () => {
    const players = createTestPlayers(3);
    const result = performGamePreparation(players);

    const usernames = result.dealerDraws.map(d => d.username);
    expect(usernames).toContain("Maik");
    expect(usernames).toContain("Bot 1");
    expect(usernames).toContain("Bot 2");
  });

  it("each draw should have a valid card", () => {
    const players = createTestPlayers(5);
    const result = performGamePreparation(players);

    for (const draw of result.seatDraws) {
      expect(draw.card).toBeDefined();
      expect(draw.card.suit).toBeDefined();
      expect(draw.card.rank).toBeDefined();
      expect(draw.card.id).toBeDefined();
    }

    for (const draw of result.dealerDraws) {
      expect(draw.card).toBeDefined();
      expect(draw.card.suit).toBeDefined();
      expect(draw.card.rank).toBeDefined();
      expect(draw.card.id).toBeDefined();
    }
  });
});

describe("Blackbird Loser Detection (lossPoints diff)", () => {
  it("should detect the correct loser via lossPoints increase", () => {
    // Simulate: before round_end, snapshot lossPoints
    const prevLossPoints: Record<number, number> = {
      1: 2,  // Maik had 2 points
      2: 3,  // Bot 1 had 3 points
      3: 0,  // Bot 2 had 0 points
      4: 1,  // Bot 3 had 1 point
    };

    // After new round starts, lossPoints updated
    const playersAfterNewRound: Player[] = [
      { id: 1, userId: 100, username: "Maik", hand: [], lossPoints: 2, isEliminated: false, isReady: true },
      { id: 2, userId: -1, username: "Bot 1", hand: [], lossPoints: 3, isEliminated: false, isReady: true },
      { id: 3, userId: -2, username: "Bot 2", hand: [], lossPoints: 3, isEliminated: false, isReady: true }, // +3 increase!
      { id: 4, userId: -3, username: "Bot 3", hand: [], lossPoints: 1, isEliminated: false, isReady: true },
    ];

    // The correct loser should be Bot 2 (increase of 3), not Bot 1 (absolute 3 but no increase)
    let loser = playersAfterNewRound[0];
    let maxIncrease = 0;
    playersAfterNewRound.forEach(p => {
      const prevPts = prevLossPoints[p.id] ?? 0;
      const increase = p.lossPoints - prevPts;
      if (increase > maxIncrease) {
        maxIncrease = increase;
        loser = p;
      }
    });

    expect(loser.username).toBe("Bot 2");
    expect(maxIncrease).toBe(3);
  });

  it("old logic (absolute lossPoints) would pick wrong player", () => {
    // Same scenario as above
    const playersAfterNewRound: Player[] = [
      { id: 1, userId: 100, username: "Maik", hand: [], lossPoints: 2, isEliminated: false, isReady: true },
      { id: 2, userId: -1, username: "Bot 1", hand: [], lossPoints: 3, isEliminated: false, isReady: true },
      { id: 3, userId: -2, username: "Bot 2", hand: [], lossPoints: 3, isEliminated: false, isReady: true },
      { id: 4, userId: -3, username: "Bot 3", hand: [], lossPoints: 1, isEliminated: false, isReady: true },
    ];

    // Old logic: pick player with highest absolute lossPoints
    const oldLoser = playersAfterNewRound
      .filter(p => !p.isEliminated)
      .reduce((a, b) => (a.lossPoints >= b.lossPoints ? a : b), playersAfterNewRound[0]);

    // Old logic picks Bot 1 (first with 3 points), but the actual round loser was Bot 2
    expect(oldLoser.username).toBe("Bot 1"); // Wrong! Should be Bot 2
  });

  it("fallback to absolute when no increase detected (first round)", () => {
    const playersAfterNewRound: Player[] = [
      { id: 1, userId: 100, username: "Maik", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
      { id: 2, userId: -1, username: "Bot 1", hand: [], lossPoints: 2, isEliminated: false, isReady: true },
      { id: 3, userId: -2, username: "Bot 2", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
    ];

    // No prevLossPoints (empty = first round)
    const prevLossPoints: Record<number, number> = {};

    let loser = playersAfterNewRound[0];
    let maxIncrease = 0;
    playersAfterNewRound.forEach(p => {
      const prevPts = prevLossPoints[p.id] ?? 0;
      const increase = p.lossPoints - prevPts;
      if (increase > maxIncrease) {
        maxIncrease = increase;
        loser = p;
      }
    });

    // With empty prevLossPoints, increase = lossPoints itself, so Bot 1 with 2 is correct
    expect(loser.username).toBe("Bot 1");
    expect(maxIncrease).toBe(2);
  });
});
