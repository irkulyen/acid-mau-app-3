import { describe, expect, it } from "vitest";
import type { Player } from "../game-types";
import { compareCards, getLowestCard } from "../card-comparison";
import {
  applySeatChoices,
  getSeatPickOrderPlayerIds,
  performGamePreparation,
  type SeatDrawResult,
} from "../game-preparation";

function mkPlayer(id: number, userId: number, username: string): Player {
  return {
    id,
    userId,
    username,
    hand: [],
    lossPoints: 0,
    isEliminated: false,
    isReady: false,
  };
}

describe("game preparation", () => {
  it("orders seat pick by card strength (rank first, suit second)", () => {
    const draws: SeatDrawResult[] = [
      { playerId: 1, username: "A", card: { id: "rot-ass", suit: "rot", rank: "ass" } },
      { playerId: 2, username: "B", card: { id: "gruen-ass", suit: "gruen", rank: "ass" } },
      { playerId: 3, username: "C", card: { id: "eichel-10", suit: "eichel", rank: "10" } },
      { playerId: 4, username: "D", card: { id: "schellen-ass", suit: "schellen", rank: "ass" } },
    ];

    // Ass > 10 and among Ass: Gruen > Rot > Schellen.
    const order = getSeatPickOrderPlayerIds(draws);
    expect(order).toEqual([2, 1, 4, 3]);
  });

  it("applies explicit seat choices exactly as selected", () => {
    const players: Player[] = [
      mkPlayer(1, 101, "P1"),
      mkPlayer(2, 102, "P2"),
      mkPlayer(3, 103, "P3"),
    ];

    const sorted = applySeatChoices(players, [
      { userId: 103, seatPosition: 0 },
      { userId: 101, seatPosition: 1 },
      { userId: 102, seatPosition: 2 },
    ]);

    expect(sorted.map((p) => p.userId)).toEqual([103, 101, 102]);
    expect(sorted.map((p) => p.seatPosition)).toEqual([0, 1, 2]);
  });

  it("dealer is always the player with the lowest dealer draw", () => {
    const players: Player[] = [
      mkPlayer(1, 101, "P1"),
      mkPlayer(2, 102, "P2"),
      mkPlayer(3, 103, "P3"),
      mkPlayer(4, 104, "P4"),
    ];

    const prep = performGamePreparation(players);
    const lowest = getLowestCard(prep.dealerDraws.map((d) => d.card));
    expect(lowest).toBeTruthy();

    const dealerCard = prep.dealerDraws[prep.dealerIndex]?.card;
    expect(dealerCard).toBeTruthy();
    expect(compareCards(dealerCard, lowest!)).toBe(0);
  });
});

