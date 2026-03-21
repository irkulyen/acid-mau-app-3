import type { GameState, Player } from "../shared/game-types";
import { detectStateTransitionFx } from "../server/game-fx-transitions";

function player(id: number, userId: number, username: string, isEliminated = false): Player {
  return {
    id,
    userId,
    username,
    hand: [],
    lossPoints: 0,
    isEliminated,
    isReady: true,
  };
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 1,
    roomCode: "ABC123",
    phase: "playing",
    players: [player(1, 101, "A"), player(2, 102, "B")],
    currentPlayerIndex: 0,
    dealerIndex: 0,
    direction: "clockwise",
    deck: [],
    discardPile: [],
    currentWishSuit: null,
    drawChainCount: 0,
    skipNextPlayer: false,
    roundNumber: 1,
    hostUserId: 101,
    hasRoundStarted: true,
    openingFreePlay: false,
    ...overrides,
  };
}

describe("game-fx state transition detection", () => {
  it("detects elimination transitions with stable payload", () => {
    const oldState = baseState();
    const newState = baseState({
      players: [player(1, 101, "A"), player(2, 102, "B", true)],
    });

    const events = detectStateTransitionFx(oldState, newState, 1, 10_000);
    const elimination = events.find((event) => event.type === "elimination");
    expect(elimination).toBeTruthy();
    expect(elimination?.playerName).toBe("B");
    expect(elimination?.eliminatedPlayerName).toBe("B");
  });

  it("detects match_result transition when game ends", () => {
    const oldState = baseState({ phase: "playing" });
    const newState = baseState({
      phase: "game_end",
      players: [player(1, 101, "A"), player(2, 102, "B", true)],
    });

    const events = detectStateTransitionFx(oldState, newState, 1, 20_000);
    const match = events.find((event) => event.type === "match_result");
    expect(match).toBeTruthy();
    expect(match?.winnerPlayerName).toBe("A");
    expect(match?.winnerUserId).toBe(101);
  });

  it("detects round transition when next round starts", () => {
    const now = 30_000;
    const oldState = baseState({ phase: "round_end", roundNumber: 1, currentPlayerIndex: 0 });
    const newState = baseState({ phase: "playing", roundNumber: 2, currentPlayerIndex: 1 });

    const events = detectStateTransitionFx(oldState, newState, 1, now);
    const roundTransition = events.find((event) => event.type === "round_transition");
    expect(roundTransition).toBeTruthy();
    expect(roundTransition?.roundNumber).toBe(2);
  });

  it("detects turn transition in active playing phase with deterministic startAt", () => {
    const now = 30_000;
    const oldState = baseState({ phase: "playing", roundNumber: 2, currentPlayerIndex: 0 });
    const newState = baseState({ phase: "playing", roundNumber: 2, currentPlayerIndex: 1 });

    const events = detectStateTransitionFx(oldState, newState, 1, now);
    const turnTransition = events.find((event) => event.type === "turn_transition");

    expect(turnTransition).toBeTruthy();
    expect(turnTransition?.playerName).toBe("B");
    expect(turnTransition?.startAt).toBe(now + 170);
  });
});
