import type { BlackbirdEventType } from "./blackbird-presentation";

export type BlackbirdMotionProfile = {
  quickEvent: boolean;
  flashPeak: number;
  shakeAmplitude: number;
  glowCycles: number;
  spriteCycles: number;
  trailCount: number;
  totalTrailTimeMs: number;
  speechDelayMs: number;
  speechDurationMs: number;
  timingScale: number;
};

export function getBlackbirdMotionProfile(
  eventType: BlackbirdEventType,
  intensity: 1 | 2 | 3 | 4 | 5,
  variant?: string,
): BlackbirdMotionProfile {
  const power = Math.max(1, intensity);
  const legendaryBoost = variant === "legendary" ? 1 : 0;

  switch (eventType) {
    case "winner":
    case "loser":
    case "mvp":
      return {
        quickEvent: false,
        flashPeak: Math.min(0.48 + power * 0.07 + legendaryBoost * 0.05, 0.75),
        shakeAmplitude: 6 + power + legendaryBoost,
        glowCycles: 16 + legendaryBoost * 2,
        spriteCycles: 24 + legendaryBoost * 2,
        trailCount: 12 + legendaryBoost,
        totalTrailTimeMs: 3900,
        speechDelayMs: 860,
        speechDurationMs: 1320,
        timingScale: 1,
      };
    case "round_start":
      return {
        quickEvent: true,
        flashPeak: 0.22,
        shakeAmplitude: 3,
        glowCycles: 10,
        spriteCycles: 14,
        trailCount: 5,
        totalTrailTimeMs: 1800,
        speechDelayMs: 350,
        speechDurationMs: 820,
        timingScale: 0.58,
      };
    case "draw_chain":
    case "seven_played":
      return {
        quickEvent: true,
        flashPeak: Math.min(0.26 + power * 0.06, 0.55),
        shakeAmplitude: 4 + Math.floor(power / 2),
        glowCycles: 12,
        spriteCycles: 16,
        trailCount: 6 + Math.floor(power / 3),
        totalTrailTimeMs: 2050,
        speechDelayMs: 370,
        speechDurationMs: 900,
        timingScale: 0.62,
      };
    case "ass":
    case "unter":
    default:
      return {
        quickEvent: true,
        flashPeak: 0.18 + Math.min(power, 3) * 0.03,
        shakeAmplitude: 2 + Math.floor(power / 3),
        glowCycles: 10,
        spriteCycles: 14,
        trailCount: 5,
        totalTrailTimeMs: 1900,
        speechDelayMs: 380,
        speechDurationMs: 860,
        timingScale: 0.6,
      };
  }
}
