import type { GameState } from "../shared/game-types";
import type { GameFxEvent } from "../shared/socket-contract";

export type TransitionFxEmit = Omit<GameFxEvent, "id" | "roomId" | "sequence" | "emittedAt" | "startAt"> & {
  startAt?: number;
  minGapMs: number;
};

export function detectStateTransitionFx(
  oldState: GameState,
  newState: GameState,
  actorPlayerId?: number,
  now = Date.now(),
): TransitionFxEmit[] {
  const out: TransitionFxEmit[] = [];

  for (const player of newState.players) {
    const oldPlayer = oldState.players.find((entry) => entry.id === player.id);
    if (!oldPlayer) continue;
    if (!oldPlayer.isEliminated && player.isEliminated) {
      out.push({
        type: "elimination",
        playerId: player.id,
        userId: player.userId,
        playerName: player.username,
        eliminatedUserId: player.userId,
        eliminatedPlayerName: player.username,
        minGapMs: 220,
      });
    }
  }

  if (oldState.phase === "round_end" && newState.phase === "playing" && newState.roundNumber > oldState.roundNumber) {
    out.push({
      type: "round_transition",
      roundNumber: newState.roundNumber,
      playerId: actorPlayerId,
      minGapMs: 240,
    });
  }

  if (
    oldState.phase === "playing" &&
    newState.phase === "playing" &&
    oldState.currentPlayerIndex !== newState.currentPlayerIndex
  ) {
    const turnPlayer = newState.players[newState.currentPlayerIndex];
    out.push({
      type: "turn_transition",
      roundNumber: newState.roundNumber,
      playerId: turnPlayer?.id,
      userId: turnPlayer?.userId,
      playerName: turnPlayer?.username,
      startAt: now + 170,
      minGapMs: 100,
    });
  }

  if (oldState.phase !== "game_end" && newState.phase === "game_end") {
    const winner = newState.players.find((player) => !player.isEliminated);
    out.push({
      type: "match_result",
      roundNumber: newState.roundNumber,
      winnerUserId: winner?.userId,
      winnerPlayerName: winner?.username,
      playerId: winner?.id,
      playerName: winner?.username,
      minGapMs: 240,
    });
  }

  return out;
}
