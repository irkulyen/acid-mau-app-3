import type { BlackbirdEventType } from "./blackbird-presentation";

export type BlackbirdMotionProfile = {
  quickEvent: boolean;
  flightPattern: "quick_arc" | "zigzag_surge" | "precision_curve" | "hero_orbit" | "shake_reject";
  flashPeak: number;
  shakeAmplitude: number;
  glowCycles: number;
  spriteCycles: number;
  trailCount: number;
  totalTrailTimeMs: number;
  speechDelayMs: number;
  speechDurationMs: number;
  wingBeatMs: number;
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
        flightPattern: "hero_orbit",
        flashPeak: Math.min(0.48 + power * 0.07 + legendaryBoost * 0.05, 0.75),
        shakeAmplitude: 6 + power + legendaryBoost,
        glowCycles: 16 + legendaryBoost * 2,
        spriteCycles: 24 + legendaryBoost * 2,
        trailCount: 12 + legendaryBoost,
        totalTrailTimeMs: 3900,
        speechDelayMs: 860,
        speechDurationMs: 1320,
        wingBeatMs: 82,
        timingScale: 1,
      };
    case "round_start":
      return {
        quickEvent: true,
        flightPattern: "quick_arc",
        flashPeak: 0.22,
        shakeAmplitude: 3,
        glowCycles: 10,
        spriteCycles: 14,
        trailCount: 5,
        totalTrailTimeMs: 1800,
        speechDelayMs: 350,
        speechDurationMs: 820,
        wingBeatMs: 96,
        timingScale: 0.58,
      };
    case "draw_chain":
      return {
        quickEvent: true,
        flightPattern: "zigzag_surge",
        flashPeak: Math.min(0.32 + power * 0.06, 0.62),
        shakeAmplitude: 5 + Math.floor(power / 2),
        glowCycles: 13,
        spriteCycles: 17,
        trailCount: 7 + Math.floor(power / 2),
        totalTrailTimeMs: 2120,
        speechDelayMs: 360,
        speechDurationMs: 920,
        wingBeatMs: 72,
        timingScale: 0.62,
      };
    case "seven_played":
      return {
        quickEvent: true,
        flightPattern: "zigzag_surge",
        flashPeak: Math.min(0.28 + power * 0.05, 0.58),
        shakeAmplitude: 4 + Math.floor(power / 2),
        glowCycles: 12,
        spriteCycles: 16,
        trailCount: 6 + Math.floor(power / 2),
        totalTrailTimeMs: 1980,
        speechDelayMs: 370,
        speechDurationMs: 880,
        wingBeatMs: 76,
        timingScale: 0.62,
      };
    case "direction_shift":
      return {
        quickEvent: true,
        flightPattern: "precision_curve",
        flashPeak: Math.min(0.24 + power * 0.04, 0.5),
        shakeAmplitude: 4,
        glowCycles: 11,
        spriteCycles: 15,
        trailCount: 6,
        totalTrailTimeMs: 1950,
        speechDelayMs: 340,
        speechDurationMs: 860,
        wingBeatMs: 80,
        timingScale: 0.6,
      };
    case "invalid":
      return {
        quickEvent: true,
        flightPattern: "shake_reject",
        flashPeak: 0.14,
        shakeAmplitude: 3,
        glowCycles: 8,
        spriteCycles: 10,
        trailCount: 4,
        totalTrailTimeMs: 1200,
        speechDelayMs: 260,
        speechDurationMs: 680,
        wingBeatMs: 104,
        timingScale: 0.5,
      };
    case "ass":
    case "unter":
    default:
      return {
        quickEvent: true,
        flightPattern: "precision_curve",
        flashPeak: 0.18 + Math.min(power, 3) * 0.03,
        shakeAmplitude: 2 + Math.floor(power / 3),
        glowCycles: 10,
        spriteCycles: 14,
        trailCount: 5,
        totalTrailTimeMs: 1900,
        speechDelayMs: 380,
        speechDurationMs: 860,
        wingBeatMs: 90,
        timingScale: 0.6,
      };
  }
}
