export type SoundPriority = 1 | 2 | 3 | 4 | 5;

export type MixPriorityState = {
  priority: SoundPriority;
  until: number;
};

export type ScheduledPriorityEntry = {
  priority: SoundPriority;
};

export function getGlobalGapMs(priority: SoundPriority): number {
  if (priority >= 4) return 60;
  if (priority >= 3) return 75;
  return 95;
}

export function getHoldPriorityMs(priority: SoundPriority, override?: number): number {
  if (typeof override === "number") return override;
  if (priority >= 4) return 280;
  if (priority >= 3) return 200;
  return 120;
}

export function isBlockedByCooldown(now: number, lastPlayedAt: number, cooldownMs: number): boolean {
  if (cooldownMs <= 0) return false;
  return now - lastPlayedAt < cooldownMs;
}

export function isBlockedByPriorityWindow(now: number, priority: SoundPriority, activeMix: MixPriorityState): boolean {
  return now < activeMix.until && priority < activeMix.priority;
}

export function isBlockedByGlobalGap(
  now: number,
  priority: SoundPriority,
  lastAnySoundAt: number,
  bypassGlobalGap = false,
): boolean {
  if (bypassGlobalGap) return false;
  const gapMs = getGlobalGapMs(priority);
  return now - lastAnySoundAt < gapMs;
}

export function computeNextMixState(
  now: number,
  priority: SoundPriority,
  activeMix: MixPriorityState,
  holdPriorityMs?: number,
): MixPriorityState {
  return {
    priority: priority >= activeMix.priority ? priority : activeMix.priority,
    until: Math.max(activeMix.until, now + getHoldPriorityMs(priority, holdPriorityMs)),
  };
}

export function shouldDropScheduledSound(scheduledPriority: SoundPriority, triggeringPriority: SoundPriority): boolean {
  return triggeringPriority >= 4 && scheduledPriority < 4;
}

export function filterScheduledByPriority<T extends ScheduledPriorityEntry>(
  entries: readonly T[],
  triggeringPriority: SoundPriority,
): T[] {
  return entries.filter((entry) => !shouldDropScheduledSound(entry.priority, triggeringPriority));
}

