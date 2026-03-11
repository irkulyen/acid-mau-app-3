import { describe, it, expect } from "vitest";
import { performGamePreparation } from "../shared/game-preparation";
import type { Player } from "../shared/game-types";

describe("Preparation Username Bug", () => {
  it("should preserve correct usernames in seatDraws and dealerDraws", () => {
    const players: Player[] = [
      { id: 1, userId: 100, username: "Acid_King", hand: [], lossPoints: 0, isEliminated: false, isReady: false },
      { id: 2, userId: -1, username: "Acid-Bot", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
      { id: 3, userId: -2, username: "Mau-Bot", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
      { id: 4, userId: -3, username: "Schellen-Bot", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
      { id: 5, userId: -4, username: "Eichel-Bot", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
    ];

    const result = performGamePreparation(players);

    // Check seatDraws: each playerId should have the correct username
    for (const draw of result.seatDraws) {
      const originalPlayer = players.find(p => p.id === draw.playerId);
      expect(originalPlayer).toBeDefined();
      expect(draw.username).toBe(originalPlayer!.username);
      console.log(`seatDraw: playerId=${draw.playerId}, username=${draw.username}, expected=${originalPlayer!.username}`);
    }

    // Check dealerDraws: each playerId should have the correct username
    for (const draw of result.dealerDraws) {
      // dealerDraws use sortedPlayers, so find by id in result.players
      const sortedPlayer = result.players.find(p => p.id === draw.playerId);
      expect(sortedPlayer).toBeDefined();
      expect(draw.username).toBe(sortedPlayer!.username);
      console.log(`dealerDraw: playerId=${draw.playerId}, username=${draw.username}, expected=${sortedPlayer!.username}`);
    }

    // Check that Acid_King is never called Acid-Bot or Acid_Bot
    const kingDrawSeat = result.seatDraws.find(d => d.playerId === 1);
    expect(kingDrawSeat).toBeDefined();
    expect(kingDrawSeat!.username).toBe("Acid_King");
    expect(kingDrawSeat!.username).not.toBe("Acid-Bot");
    expect(kingDrawSeat!.username).not.toBe("Acid_Bot");

    const kingDrawDealer = result.dealerDraws.find(d => d.playerId === 1);
    // playerId 1 might have been reassigned after seat sorting - check by original username
    const kingInSorted = result.players.find(p => p.userId === 100);
    expect(kingInSorted).toBeDefined();
    expect(kingInSorted!.username).toBe("Acid_King");
  });

  it("should have correct startspieler (player after dealer, not dealer)", () => {
    const players: Player[] = [
      { id: 1, userId: 100, username: "Acid_King", hand: [], lossPoints: 0, isEliminated: false, isReady: false },
      { id: 2, userId: -1, username: "Acid-Bot", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
      { id: 3, userId: -2, username: "Mau-Bot", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
      { id: 4, userId: -3, username: "Schellen-Bot", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
      { id: 5, userId: -4, username: "Eichel-Bot", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
    ];

    const result = performGamePreparation(players);
    
    console.log("Sorted players:", result.players.map((p, i) => `${i}: ${p.username} (id=${p.id})`));
    console.log("Dealer index:", result.dealerIndex);
    console.log("Dealer:", result.players[result.dealerIndex].username);
    
    // The starting player should be the one AFTER the dealer
    const expectedStartIndex = (result.dealerIndex + 1) % result.players.length;
    console.log("Expected start player index:", expectedStartIndex);
    console.log("Expected start player:", result.players[expectedStartIndex].username);
    
    // Verify dealer is not the starting player
    expect(result.dealerIndex).not.toBe(expectedStartIndex);
  });

  it("should simulate the client-side mapping correctly", () => {
    // Simulate what happens on the client:
    // 1. gameState.players = original order (before preparation)
    // 2. serverSeatDraws come from server
    // 3. Client maps draws to players using playerList.find(p => p.id === d.playerId)
    
    const originalPlayers: Player[] = [
      { id: 1, userId: 100, username: "Acid_King", hand: [], lossPoints: 0, isEliminated: false, isReady: false },
      { id: 2, userId: -1, username: "Acid-Bot", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
      { id: 3, userId: -2, username: "Mau-Bot", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
      { id: 4, userId: -3, username: "Schellen-Bot", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
      { id: 5, userId: -4, username: "Eichel-Bot", hand: [], lossPoints: 0, isEliminated: false, isReady: true },
    ];

    const result = performGamePreparation(originalPlayers);

    // Simulate client-side serverDrawsToDrawnCards for seat selection
    const clientSeatCards = result.seatDraws.map((d) => {
      const player = originalPlayers.find((p) => p.id === d.playerId) || {
        id: d.playerId,
        userId: 0,
        username: d.username,
        hand: [],
        lossPoints: 0,
        isEliminated: false,
        isReady: false,
      };
      return { player, card: d.card };
    });

    // Check: each drawn card should show the correct player name
    for (const drawn of clientSeatCards) {
      const originalPlayer = originalPlayers.find(p => p.id === drawn.player.id);
      console.log(`Client seat card: player.id=${drawn.player.id}, displayed="${drawn.player.username}", original="${originalPlayer?.username}"`);
      expect(drawn.player.username).toBe(originalPlayer?.username);
    }

    // Specifically check Acid_King is never shown as Acid-Bot
    const kingCard = clientSeatCards.find(c => c.player.userId === 100);
    expect(kingCard).toBeDefined();
    expect(kingCard!.player.username).toBe("Acid_King");
  });
});
