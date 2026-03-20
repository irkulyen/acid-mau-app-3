import { describe, it, expect } from "vitest";
import { processAction } from "../game-engine";
import type { GameState, Card } from "../game-types";

function makeCard(suit: Card["suit"], rank: Card["rank"]): Card {
  return { suit, rank, id: `${suit}-${rank}` };
}

function makePlayer(id: number, userId: number, hand: Card[]) {
  return {
    id,
    userId,
    username: `Player${id}`,
    hand,
    lossPoints: 0,
    isEliminated: false,
    isReady: false,
  };
}

function makeState(players: ReturnType<typeof makePlayer>[], discardPile: Card[]): GameState {
  return {
    roomId: 1,
    roomCode: "TEST",
    phase: "playing",
    players,
    currentPlayerIndex: 0,
    dealerIndex: 0,
    deck: [makeCard("eichel", "9"), makeCard("gruen", "9"), makeCard("rot", "9")],
    discardPile,
    direction: "clockwise",
    currentWishSuit: null,
    drawChainCount: 0,
    skipNextPlayer: false,
    roundNumber: 1,
    hostUserId: 1,
    hasRoundStarted: true,
    openingFreePlay: false,
    maxPlayers: players.length,
  };
}

describe("Ass Bug bei 2 Spielern", () => {
  it("Spieler A legt Ass → B setzt aus → A ist wieder dran → kein Freeze", () => {
    const eichelAss = makeCard("eichel", "ass");
    const eichelKonig = makeCard("eichel", "konig");
    const gruenKonig = makeCard("gruen", "konig");

    const state = makeState(
      [
        makePlayer(1, 100, [eichelAss, eichelKonig]), // A ist dran
        makePlayer(2, 200, [gruenKonig]),               // B
      ],
      [makeCard("eichel", "7")]
    );

    // A legt Ass
    const afterAss = processAction(state, { type: "PLAY_CARD", cardId: "eichel-ass" }, 1);
    console.log("Phase nach Ass:", afterAss.phase);
    console.log("currentPlayerIndex:", afterAss.currentPlayerIndex);
    console.log("skipNextPlayer:", afterAss.skipNextPlayer);

    // A sollte wieder dran sein (Index 0)
    expect(afterAss.phase).toBe("playing");
    expect(afterAss.currentPlayerIndex).toBe(0); // A bleibt dran
    expect(afterAss.skipNextPlayer).toBe(false);

    // A legt König
    const afterKonig = processAction(afterAss, { type: "PLAY_CARD", cardId: "eichel-konig" }, 1);
    console.log("Phase nach König:", afterKonig.phase);
    console.log("currentPlayerIndex:", afterKonig.currentPlayerIndex);

    // A hat 0 Karten → Runde endet, B ist Verlierer
    expect(afterKonig.phase).toBe("round_end");
  });

  it("Spieler A legt Ass als letzte Karte → Runde endet sofort", () => {
    const eichelAss = makeCard("eichel", "ass");
    const gruenKonig = makeCard("gruen", "konig");

    const state = makeState(
      [
        makePlayer(1, 100, [eichelAss]), // A hat nur Ass
        makePlayer(2, 200, [gruenKonig]), // B
      ],
      [makeCard("eichel", "7")]
    );

    // A legt Ass als letzte Karte
    const afterAss = processAction(state, { type: "PLAY_CARD", cardId: "eichel-ass" }, 1);
    console.log("Phase nach Ass (letzte Karte):", afterAss.phase);
    console.log("currentPlayerIndex:", afterAss.currentPlayerIndex);

    // A hat 0 Karten → isRoundOver → round_end
    expect(afterAss.phase).toBe("round_end");
  });

  it("Spieler B legt Ass → A setzt aus → B ist wieder dran → kein Freeze", () => {
    const gruenAss = makeCard("gruen", "ass");
    const eichelKonig = makeCard("eichel", "konig");
    const gruenKonig = makeCard("gruen", "konig");

    const state = makeState(
      [
        makePlayer(1, 100, [eichelKonig]),           // A (Index 0)
        makePlayer(2, 200, [gruenAss, gruenKonig]),    // B (Index 1)
      ],
      [makeCard("gruen", "7")]
    );

    // Erst A ziehen lassen damit B dran ist
    const afterADraw = processAction(state, { type: "DRAW_CARD" }, 1);
    console.log("Nach A zieht – currentPlayerIndex:", afterADraw.currentPlayerIndex);
    expect(afterADraw.currentPlayerIndex).toBe(1); // B ist dran

    // B legt Ass
    const afterBass = processAction(afterADraw, { type: "PLAY_CARD", cardId: "gruen-ass" }, 2);
    console.log("Phase nach B legt Ass:", afterBass.phase);
    console.log("currentPlayerIndex:", afterBass.currentPlayerIndex);
    console.log("skipNextPlayer:", afterBass.skipNextPlayer);

    // B sollte wieder dran sein (Index 1)
    expect(afterBass.phase).toBe("playing");
    expect(afterBass.currentPlayerIndex).toBe(1); // B bleibt dran
  });
});
