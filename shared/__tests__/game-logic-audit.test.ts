import { describe, expect, it } from "vitest";
import { applyOpeningCardEffects, processAction } from "../game-engine";
import type { Card, GameState, Player } from "../game-types";

function card(suit: Card["suit"], rank: Card["rank"], id?: string): Card {
  return { suit, rank, id: id ?? `${suit}-${rank}` };
}

function player(id: number, hand: Card[], options?: Partial<Player>): Player {
  return {
    id,
    userId: id,
    username: `P${id}`,
    hand,
    lossPoints: 0,
    isEliminated: false,
    isReady: false,
    ...options,
  };
}

function state(overrides?: Partial<GameState>): GameState {
  const basePlayers = [player(1, []), player(2, [])];
  return {
    roomId: 1,
    roomCode: "TEST",
    phase: "playing",
    players: basePlayers,
    currentPlayerIndex: 0,
    dealerIndex: 0,
    direction: "clockwise",
    deck: [],
    discardPile: [card("eichel", "9", "eichel-9-top")],
    currentWishSuit: null,
    drawChainCount: 0,
    skipNextPlayer: false,
    roundNumber: 1,
    hostUserId: 1,
    hasRoundStarted: true,
    openingFreePlay: false,
    maxPlayers: 6,
    ...overrides,
  };
}

function allCardIds(gameState: GameState): string[] {
  return [
    ...gameState.deck.map((c) => c.id),
    ...gameState.discardPile.map((c) => c.id),
    ...gameState.players.flatMap((p) => p.hand.map((c) => c.id)),
  ];
}

describe("Game logic audit - phase 2 hardening", () => {
  it("opening card Ass skips the first player immediately", () => {
    const gameState = state({
      players: [player(1, [card("eichel", "7")]), player(2, [card("gruen", "7")]), player(3, [card("rot", "7")])],
      currentPlayerIndex: 1,
      skipNextPlayer: false,
    });

    applyOpeningCardEffects(gameState, card("eichel", "ass", "eichel-ass-opening"));

    expect(gameState.currentPlayerIndex).toBe(2);
    expect(gameState.skipNextPlayer).toBe(false);
  });

  it("opening-card effects initialize 7, Unter and Schellen-8 correctly", () => {
    const sevenState = state();
    applyOpeningCardEffects(sevenState, card("rot", "7", "rot-7-opening"));
    expect(sevenState.drawChainCount).toBe(2);

    const unterState = state({ currentWishSuit: "eichel" });
    applyOpeningCardEffects(unterState, card("gruen", "bube", "gruen-bube-opening"));
    expect(unterState.currentWishSuit).toBeNull();
    expect(unterState.openingFreePlay).toBe(true);

    const eightState = state({ direction: "clockwise", openingFreePlay: false });
    applyOpeningCardEffects(eightState, card("schellen", "8", "schellen-8"));
    expect(eightState.direction).toBe("counterclockwise");
    expect(eightState.openingFreePlay).toBe(true);
  });

  it("7-chain escalates and resets when target player draws", () => {
    const gameState = state({
      players: [
        player(1, [card("eichel", "7"), card("gruen", "9", "gruen-9-keep-round")]),
        player(2, [card("rot", "9")]),
      ],
      discardPile: [card("eichel", "9", "eichel-9-top")],
      deck: [card("gruen", "8", "gruen-8-a"), card("rot", "8", "rot-8-a"), card("schellen", "9", "schellen-9-a")],
      currentPlayerIndex: 0,
      drawChainCount: 0,
    });

    const afterSeven = processAction(gameState, { type: "PLAY_CARD", cardId: "eichel-7" }, 1);
    expect(afterSeven.drawChainCount).toBe(2);
    expect(afterSeven.currentPlayerIndex).toBe(1);

    const afterDraw = processAction(afterSeven, { type: "DRAW_CARD" }, 2);
    expect(afterDraw.drawChainCount).toBe(0);
    expect(afterDraw.players[1].hand).toHaveLength(3);
    expect(afterDraw.currentPlayerIndex).toBe(0);
  });

  it("active wish suit clears when a matching non-Unter card is played", () => {
    const gameState = state({
      players: [player(1, [card("rot", "9")]), player(2, [card("eichel", "10")])],
      discardPile: [card("eichel", "7", "eichel-7-top")],
      currentWishSuit: "rot",
      currentPlayerIndex: 0,
    });

    const afterPlay = processAction(gameState, { type: "PLAY_CARD", cardId: "rot-9" }, 1);
    expect(afterPlay.currentWishSuit).toBeNull();
  });

  it("rebuilds draw pile from discard while keeping top discard card", () => {
    const gameState = state({
      players: [player(1, [card("rot", "9", "rot-9-hand")]), player(2, [card("eichel", "10", "eichel-10-hand")])],
      deck: [],
      discardPile: [card("eichel", "7", "eichel-7-old"), card("rot", "8", "rot-8-top")],
      currentPlayerIndex: 0,
    });

    const afterDraw = processAction(gameState, { type: "DRAW_CARD" }, 1);

    expect(afterDraw.discardPile).toHaveLength(1);
    expect(afterDraw.discardPile[0].id).toBe("rot-8-top");
    expect(afterDraw.players[0].hand).toHaveLength(2);
  });

  it("aborts round with collective penalty when deck and reshuffle are impossible", () => {
    const gameState = state({
      players: [player(1, [card("rot", "9", "rot-9-a")]), player(2, [card("eichel", "10", "eichel-10-a")])],
      deck: [],
      discardPile: [card("schellen", "8", "schellen-8-only")],
      currentPlayerIndex: 0,
      hasRoundStarted: true,
    });

    const afterDraw = processAction(gameState, { type: "DRAW_CARD" }, 1);

    expect(afterDraw.phase).toBe("round_end");
    expect(afterDraw.players[0].lossPoints).toBe(1);
    expect(afterDraw.players[1].lossPoints).toBe(1);
  });

  it("clears eliminated player hand and keeps card IDs unique across next round", () => {
    const gameState = state({
      players: [
        player(1, [card("gruen", "9", "gruen-9-last")], { isReady: false }),
        player(2, [card("eichel", "7", "eichel-7-loser")], { lossPoints: 6, isReady: false }),
        player(3, [], { isReady: false }),
      ],
      discardPile: [card("rot", "9", "rot-9-top")],
      currentPlayerIndex: 0,
      hasRoundStarted: true,
    });

    const roundEnd = processAction(gameState, { type: "PLAY_CARD", cardId: "gruen-9-last" }, 1);
    expect(roundEnd.phase).toBe("round_end");
    expect(roundEnd.players[1].isEliminated).toBe(true);
    expect(roundEnd.players[1].hand).toHaveLength(0);

    const readyP1 = processAction(roundEnd, { type: "READY" }, 1);
    const nextRound = processAction(readyP1, { type: "READY" }, 3);
    expect(nextRound.phase).toBe("playing");
    expect(nextRound.players[1].isEliminated).toBe(true);
    expect(nextRound.players[1].hand).toHaveLength(0);

    const ids = allCardIds(nextRound);
    expect(ids).toHaveLength(32);
    expect(new Set(ids).size).toBe(32);
  });

  it("enters game_end when only one non-eliminated player remains", () => {
    const gameState = state({
      players: [
        player(1, [card("gruen", "9", "gruen-9-win")]),
        player(2, [card("eichel", "7", "eichel-7-final-loss")], { lossPoints: 6 }),
      ],
      discardPile: [card("rot", "9", "rot-9-top-final")],
      currentPlayerIndex: 0,
      hasRoundStarted: true,
    });

    const gameEnd = processAction(gameState, { type: "PLAY_CARD", cardId: "gruen-9-win" }, 1);
    expect(gameEnd.phase).toBe("game_end");
    expect(gameEnd.players[1].isEliminated).toBe(true);
    expect(gameEnd.players[1].hand).toHaveLength(0);
  });
});
