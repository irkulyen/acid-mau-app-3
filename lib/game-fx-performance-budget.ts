import type { GameFxEvent } from "../shared/socket-contract";

export type GameFxPerformanceBudget = {
  maxQueueDepth: number;
  maxQueueLagMs: number;
  maxStartDriftMs: number;
};

export const GAME_FX_PERF_BUDGET: GameFxPerformanceBudget = {
  maxQueueDepth: 10,
  maxQueueLagMs: 1200,
  maxStartDriftMs: 300,
};

export function getQueueLagMs(event: Pick<GameFxEvent, "startAt">, now = Date.now()): number {
  if (typeof event.startAt !== "number") return 0;
  return Math.max(0, now - event.startAt);
}

export function getStartDriftMs(event: Pick<GameFxEvent, "startAt">, now = Date.now()): number {
  if (typeof event.startAt !== "number") return 0;
  return Math.max(0, now - event.startAt);
}

export function shouldWarnQueueDepth(depth: number, budget = GAME_FX_PERF_BUDGET): boolean {
  return depth > budget.maxQueueDepth;
}

export function shouldWarnQueueLag(lagMs: number, budget = GAME_FX_PERF_BUDGET): boolean {
  return lagMs > budget.maxQueueLagMs;
}

export function shouldWarnStartDrift(driftMs: number, budget = GAME_FX_PERF_BUDGET): boolean {
  return driftMs > budget.maxStartDriftMs;
}

