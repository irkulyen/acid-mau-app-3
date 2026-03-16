import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  withSpring,
  Easing,
  runOnJS,
  interpolateColor,
} from "react-native-reanimated";
import { FALLBACK_CORE_TOKENS, FX_TOKENS, withAlpha } from "@/lib/design-tokens";
import { AmselMascot } from "@/components/game/AmselMascot";

const { width: SW, height: SH } = Dimensions.get("window");

const TRAIL_EMOJIS = ["⭐", "💫", "✨", "🌟", "💥", "🎵", "🎶", "❗", "❓", "🔥", "💀", "🃏"];

const ROUND_START_PHRASES = [
  "Na gut. Neue Runde.",
  "Weiter geht's.",
  "Konzentriert euch.",
  "Los.",
];

const WINNER_PHRASES = [
  (n: string) => `${n}: sauber.`,
  (n: string) => `${n} ist durch.`,
  () => "Sauber.",
  () => "Nicht schlecht.",
];

const LOSER_PHRASES = [
  (n: string) => `${n}: das war nichts.`,
  () => "Das war wohl nichts.",
  () => "Tja.",
];

const DRAW_CHAIN_PHRASES = [
  (count: number) => `Oh oh. (+${count})`,
  () => "Das eskaliert.",
  () => "Das wird teuer.",
];

const ELIMINATION_PHRASES = [
  (n: string) => `${n}: raus.`,
  () => "Raus.",
  () => "Weg.",
];

const CHAOS_PHRASES = [
  () => "Chaos.",
  () => "Das wird wild.",
  () => "Haltet euch fest.",
];

const GUIDE_PHRASES = [
  () => "Hinweis: Top-Karte lesen.",
  () => "Hinweis: spielbare Karten zuerst.",
  () => "Hinweis: ruhig bleiben.",
];

const SEVEN_PLAYED_PHRASES = [
  (count: number) => count > 1 ? `Sieben gelegt. Ziehkette bei ${count}.` : "Sieben gelegt.",
  () => "Oh oh… das wird teuer.",
  () => "Das eskaliert gerade.",
];

const ASS_PHRASES = [
  "Pause für dich.",
  "Du setzt aus.",
  "Kurz zuschauen.",
];

const UNTER_PHRASES = [
  () => "Neue Farbe.",
  () => "Interessante Wahl.",
  () => "Mal sehen, ob das funktioniert.",
];

const MVP_PHRASES = [
  (s: string) => `Highlight: ${s}`,
  (s: string) => `MVP: ${s}`,
  (s: string) => `Starker Moment: ${s}`,
];

type EventType =
  | "round_start"
  | "winner"
  | "loser"
  | "draw_chain"
  | "seven_played"
  | "ass"
  | "unter"
  | "mvp"
  | "elimination"
  | "chaos"
  | "guide";

interface TrailParticle {
  id: number;
  emoji: string;
  x: number;
  y: number;
}

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  angle: number;
}

interface BlackbirdAnimationProps {
  visible: boolean;
  loserName?: string;
  winnerName?: string;
  eventType?: EventType;
  drawChainCount?: number;
  wishSuit?: string;
  intensity?: 1 | 2 | 3 | 4 | 5;
  spotlightPlayerName?: string;
  statsText?: string;
  variant?: string;
  phrase?: string;
  onDone?: () => void;
  onStart?: () => void;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const CONFETTI_COLORS = [
  FALLBACK_CORE_TOKENS.STATE_DANGER,
  FALLBACK_CORE_TOKENS.SECONDARY_NEON,
  FALLBACK_CORE_TOKENS.STATE_SUCCESS,
  FALLBACK_CORE_TOKENS.STATE_WARNING,
  FALLBACK_CORE_TOKENS.TEXT_MAIN,
  FALLBACK_CORE_TOKENS.TEXT_MUTED,
  withAlpha(FALLBACK_CORE_TOKENS.SECONDARY_NEON, 0.9),
  withAlpha(FALLBACK_CORE_TOKENS.STATE_WARNING, 0.85),
  withAlpha(FALLBACK_CORE_TOKENS.STATE_DANGER, 0.85),
  withAlpha(FALLBACK_CORE_TOKENS.TEXT_MAIN, 0.9),
];

export function BlackbirdAnimation({
  visible, loserName, winnerName, eventType, drawChainCount, wishSuit, intensity = 3, spotlightPlayerName, statsText, variant, phrase: phraseFromServer, onDone, onStart,
}: BlackbirdAnimationProps) {
  const translateX = useSharedValue(-120);
  const translateY = useSharedValue(SH * 0.42);
  const rotate = useSharedValue(0);
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const opacity = useSharedValue(0);
  const speechOpacity = useSharedValue(0);
  const speechScale = useSharedValue(0.3);
  const glowPulse = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const featherShimmer = useSharedValue(0);
  const tailWag = useSharedValue(0);
  const bodyGlow = useSharedValue(0);
  const eyeGlow = useSharedValue(0);
  const clawDrop = useSharedValue(0);
  const [trail, setTrail] = useState<TrailParticle[]>([]);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [phrase, setPhrase] = useState("");
  const [speechPos, setSpeechPos] = useState({ x: 0, y: 0 });
  const [currentEvent, setCurrentEvent] = useState<EventType>("round_start");

  const addTrailParticle = useCallback((x: number, y: number) => {
    const emoji = pickRandom(TRAIL_EMOJIS);
    setTrail((prev) => [...prev.slice(-18), { id: Date.now() + Math.random(), emoji, x, y }]);
  }, []);

  const spawnConfetti = useCallback((centerX: number, centerY: number) => {
    const pieces: ConfettiPiece[] = [];
    for (let i = 0; i < 24; i++) {
      pieces.push({
        id: Date.now() + i + Math.random(),
        x: centerX + (Math.random() - 0.5) * SW * 0.6,
        y: centerY + (Math.random() - 0.5) * SH * 0.3,
        color: pickRandom(CONFETTI_COLORS),
        size: 6 + Math.random() * 10,
        angle: Math.random() * 360,
      });
    }
    setConfetti(pieces);
    setTimeout(() => setConfetti([]), 2500);
  }, []);

  useEffect(() => {
    if (!visible) {
      setTrail([]);
      setConfetti([]);
      return;
    }

    // Determine event type and phrase
    let evType: EventType = eventType || "round_start";
    let selectedPhrase: string;

    if (winnerName) {
      evType = "winner";
      selectedPhrase = pickRandom(WINNER_PHRASES)(winnerName);
    } else if (loserName) {
      evType = "loser";
      selectedPhrase = pickRandom(LOSER_PHRASES)(loserName);
    } else if (eventType === "seven_played") {
      selectedPhrase = pickRandom(SEVEN_PLAYED_PHRASES)(drawChainCount || 1);
    } else if (eventType === "draw_chain" && drawChainCount) {
      selectedPhrase = pickRandom(DRAW_CHAIN_PHRASES)(drawChainCount);
    } else if (eventType === "ass") {
      selectedPhrase = pickRandom(ASS_PHRASES);
    } else if (eventType === "unter" && wishSuit) {
      selectedPhrase = pickRandom(UNTER_PHRASES)();
    } else if (eventType === "mvp" && statsText) {
      selectedPhrase = pickRandom(MVP_PHRASES)(statsText);
    } else if (eventType === "elimination") {
      selectedPhrase = pickRandom(ELIMINATION_PHRASES)(loserName || spotlightPlayerName || "...");
    } else if (eventType === "chaos") {
      selectedPhrase = pickRandom(CHAOS_PHRASES)();
    } else if (eventType === "guide") {
      selectedPhrase = pickRandom(GUIDE_PHRASES)();
    } else {
      selectedPhrase = pickRandom(ROUND_START_PHRASES);
    }

    if (phraseFromServer && phraseFromServer.trim().length > 0) {
      selectedPhrase = phraseFromServer.trim();
    }

    setPhrase(selectedPhrase);
    setCurrentEvent(evType);

    // Reset all
    translateX.value = -120;
    translateY.value = SH * 0.42;
    rotate.value = 0;
    scaleX.value = 1;
    scaleY.value = 1;
    opacity.value = 0;
    speechOpacity.value = 0;
    speechScale.value = 0.3;
    flashOpacity.value = 0;
    shakeX.value = 0;
    featherShimmer.value = 0;
    tailWag.value = 0;
    bodyGlow.value = 0;
    eyeGlow.value = 0;
    clawDrop.value = 0;
    setTrail([]);
    setConfetti([]);

    if (onStart) runOnJS(onStart)();

    // === DRAMATIC ENTRANCE: Screen flash ===
    const isBigEvent =
      evType === "winner" ||
      evType === "loser" ||
      evType === "round_start" ||
      evType === "mvp" ||
      evType === "elimination" ||
      evType === "chaos";
    if (isBigEvent) {
      const power = Math.max(1, intensity);
      flashOpacity.value = withSequence(
        withTiming(Math.min(0.2 + power * 0.08, 0.6), { duration: 80 }),
        withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) }),
      );
      // Screen shake
      shakeX.value = withSequence(
        withTiming(4 + power, { duration: 40 }),
        withTiming(-(4 + power), { duration: 40 }),
        withTiming(3 + Math.floor(power / 2), { duration: 40 }),
        withTiming(-2 - Math.floor(power / 3), { duration: 40 }),
        withTiming(0, { duration: 60 }),
      );
    }

    // Fade in
    opacity.value = withTiming(1, { duration: 180 });

    // Neon glow pulse – faster, more dramatic
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 280, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.2, { duration: 280, easing: Easing.inOut(Easing.ease) }),
      ),
      14,
      false,
    );

    // Feather shimmer – continuous highlight sweep
    featherShimmer.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.linear }),
      10,
      false,
    );

    // Tail wag
    tailWag.value = withRepeat(
      withSequence(
        withTiming(15, { duration: 150, easing: Easing.inOut(Easing.ease) }),
        withTiming(-15, { duration: 150, easing: Easing.inOut(Easing.ease) }),
      ),
      20,
      false,
    );

    // Body glow pulse (event-colored)
    bodyGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 500, easing: Easing.inOut(Easing.ease) }),
      ),
      8,
      false,
    );

    // Eye glow
    eyeGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 350, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 350, easing: Easing.inOut(Easing.ease) }),
      ),
      12,
      false,
    );

    if (evType === "elimination") {
      clawDrop.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 180, easing: Easing.inOut(Easing.ease) }),
        ),
        6,
        false,
      );
    }

    // Event-based flights
    const isQuickEvent = evType !== "mvp";
    // Event-specific quick-flight tuning for clearer personality per moment.
    const quickSpeedByEvent: Partial<Record<EventType, number>> = {
      round_start: 0.9,
      draw_chain: 0.74,
      seven_played: 0.72,
      chaos: 0.68,
      elimination: 0.7,
      loser: 0.74,
      winner: 0.82,
      ass: 0.86,
      unter: 0.86,
      guide: 0.92,
    };
    const quickMultiplier = quickSpeedByEvent[evType] ?? 0.8;
    const dur = (ms: number) => ({
      duration: isQuickEvent ? ms * quickMultiplier : ms,
      easing: Easing.inOut(Easing.ease),
    });
    const fast = (ms: number) => ({
      duration: isQuickEvent ? ms * quickMultiplier : ms,
      easing: Easing.out(Easing.cubic),
    });

    if (isQuickEvent) {
      // Quick fly-by
      translateX.value = withSequence(
        withTiming(SW * 0.15, dur(380)),
        withTiming(SW * 0.35, dur(240)),
        withTiming(SW * 0.35, { duration: 480 }),
        withTiming(SW * 0.55, dur(220)),
        withTiming(SW + 140, fast(420), (finished) => {
          if (finished) {
            opacity.value = withTiming(0, { duration: 150 });
            if (onDone) runOnJS(onDone)();
          }
        }),
      );
      translateY.value = withSequence(
        withTiming(SH * 0.36, dur(380)),
        withTiming(SH * 0.32, dur(240)),
        withTiming(SH * 0.32, { duration: 480 }),
        withTiming(SH * 0.39, dur(220)),
        withTiming(SH * 0.28, fast(420)),
      );
      rotate.value = withSequence(
        withTiming(-10, dur(380)),
        withTiming(5, dur(240)),
        withTiming(0, { duration: 480 }),
        withTiming(10, dur(220)),
        withTiming(-5, fast(420)),
      );
    } else {
      // Full dramatic flight: ~6.5 seconds with dive-bomb and loop
      translateX.value = withSequence(
        withTiming(SW * 0.18, dur(1100)),
        withTiming(SW * 0.08, dur(400)),
        withTiming(SW * 0.36, dur(550)),
        withTiming(SW * 0.36, { duration: 900 }),
        withTiming(SW * 0.12, dur(700)),
        withTiming(SW * 0.48, dur(550)),
        withTiming(SW * 0.38, dur(280)),
        withTiming(SW * 0.7, dur(520)),
        withTiming(SW + 140, fast(800), (finished) => {
          if (finished) {
            opacity.value = withTiming(0, { duration: 200 });
            if (onDone) runOnJS(onDone)();
          }
        }),
      );

      translateY.value = withSequence(
        withTiming(SH * 0.36, dur(1100)),
        withTiming(SH * 0.18, dur(400)),
        withTiming(SH * 0.3, dur(550)),
        withTiming(SH * 0.16, dur(450)),
        withTiming(SH * 0.45, dur(450)),
        withTiming(SH * 0.34, dur(700)),
        withTiming(SH * 0.50, dur(550)),
        withTiming(SH * 0.37, dur(280)),
        withTiming(SH * 0.4, dur(520)),
        withTiming(SH * 0.3, fast(800)),
      );

      rotate.value = withSequence(
        withTiming(0, dur(1100)),
        withTiming(-18, dur(400)),
        withTiming(12, dur(550)),
        withTiming(360, { duration: 900, easing: Easing.linear }),
        withTiming(180, dur(350)),
        withTiming(180, dur(700)),
        withTiming(0, dur(500)),
        withTiming(-22, dur(280)),
        withTiming(8, dur(520)),
        withTiming(0, fast(800)),
      );

      scaleX.value = withSequence(
        withTiming(1, dur(2050)),
        withTiming(-1, dur(350)),
        withTiming(-1, dur(700)),
        withTiming(1, dur(350)),
        withTiming(1, fast(1350)),
      );

      scaleY.value = withSequence(
        withTiming(1, dur(1100)),
        withTiming(1.4, dur(250)),
        withTiming(0.7, dur(250)),
        withTiming(1.3, dur(350)),
        withTiming(0.75, dur(350)),
        withTiming(1.35, dur(250)),
        withTiming(0.6, dur(250)),
        withTiming(1, dur(350)),
        withTiming(1.2, dur(250)),
        withTiming(0.85, dur(250)),
        withTiming(1, fast(800)),
      );
    }

    // Speech bubble timing
    const speechDelay = isQuickEvent ? 380 : 900;
    const speechDuration = isQuickEvent ? 850 : 1200;
    const speechTimer = setTimeout(() => {
      setSpeechPos({
        x: isQuickEvent ? SW * 0.12 : SW * 0.14,
        y: isQuickEvent ? SH * 0.16 : SH * 0.14,
      });
      speechScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      speechOpacity.value = withTiming(1, { duration: 200 });

      // Confetti burst for winner/loser
      if (evType === "winner" || evType === "loser") {
        runOnJS(spawnConfetti)(SW * 0.4, SH * 0.26);
      }

      setTimeout(() => {
        speechOpacity.value = withTiming(0, { duration: 500 });
        speechScale.value = withTiming(0.8, { duration: 500 });
      }, speechDuration);
    }, speechDelay);

    // Trail particles
    const intervals: ReturnType<typeof setTimeout>[] = [speechTimer];
    const trailCount = isQuickEvent ? 5 : 10;
    const totalTime = isQuickEvent ? 1900 : 3600;
    for (let i = 0; i < trailCount; i++) {
      const t = (totalTime / trailCount) * (i + 0.5);
      const progress = t / totalTime;
      const x = SW * (0.05 + progress * 0.85);
      const y = SH * (0.28 + Math.sin(progress * Math.PI * 3) * 0.1 + Math.random() * 0.06);
      const timer = setTimeout(() => runOnJS(addTrailParticle)(x, y), t);
      intervals.push(timer);
    }

    return () => intervals.forEach(clearTimeout);
  }, [visible, phraseFromServer]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scaleX: scaleX.value },
      { scaleY: scaleY.value },
    ],
    opacity: opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + glowPulse.value * 0.7,
  }));

  const speechStyle = useAnimatedStyle(() => ({
    opacity: speechOpacity.value,
    transform: [{ scale: speechScale.value }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value * 0.45,
  }));

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.15 + featherShimmer.value * 0.45,
    transform: [{ translateX: -10 + featherShimmer.value * 50 }],
  }));

  const tailStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-25 + tailWag.value}deg` }],
  }));

  const bodyGlowStyle = useAnimatedStyle(() => ({
    opacity: bodyGlow.value * 0.35,
  }));

  const eyeGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + eyeGlow.value * 0.4,
    transform: [{ scale: 0.95 + eyeGlow.value * 0.1 }],
  }));

  const clawStyle = useAnimatedStyle(() => ({
    opacity: currentEvent === "elimination" ? 0.7 + clawDrop.value * 0.3 : 0,
    transform: [{ translateY: 2 + clawDrop.value * 8 }],
  }));

  // Event-based colors
  const getColors = () => {
    if (variant === "legendary") {
      return {
        bubble: "rgba(35, 25, 0, 0.98)",
        border: FALLBACK_CORE_TOKENS.STATE_WARNING,
        text: FALLBACK_CORE_TOKENS.STATE_WARNING,
        tail: FALLBACK_CORE_TOKENS.STATE_WARNING,
        glow: FALLBACK_CORE_TOKENS.STATE_WARNING,
        body: withAlpha(FALLBACK_CORE_TOKENS.STATE_WARNING, 0.45),
      };
    }
    switch (currentEvent) {
      case "winner":
        return {
          bubble: "rgba(5, 25, 5, 0.97)",
          border: FALLBACK_CORE_TOKENS.STATE_SUCCESS,
          text: FALLBACK_CORE_TOKENS.SECONDARY_NEON,
          tail: FALLBACK_CORE_TOKENS.STATE_SUCCESS,
          glow: FALLBACK_CORE_TOKENS.STATE_SUCCESS,
          body: withAlpha(FALLBACK_CORE_TOKENS.STATE_SUCCESS, 0.35),
        };
      case "loser":
        return {
          bubble: "rgba(30, 5, 5, 0.97)",
          border: FALLBACK_CORE_TOKENS.STATE_DANGER,
          text: FALLBACK_CORE_TOKENS.STATE_DANGER,
          tail: FALLBACK_CORE_TOKENS.STATE_DANGER,
          glow: FX_TOKENS.DRAW_CHAIN_SHADOW,
          body: withAlpha(FALLBACK_CORE_TOKENS.STATE_DANGER, 0.35),
        };
      case "draw_chain":
        return {
          bubble: "rgba(30, 15, 0, 0.97)",
          border: FALLBACK_CORE_TOKENS.STATE_WARNING,
          text: FALLBACK_CORE_TOKENS.STATE_WARNING,
          tail: FALLBACK_CORE_TOKENS.STATE_WARNING,
          glow: FALLBACK_CORE_TOKENS.STATE_WARNING,
          body: withAlpha(FALLBACK_CORE_TOKENS.STATE_WARNING, 0.35),
        };
      case "elimination":
        return {
          bubble: "rgba(28, 6, 6, 0.98)",
          border: FALLBACK_CORE_TOKENS.STATE_DANGER,
          text: FALLBACK_CORE_TOKENS.TEXT_MAIN,
          tail: FALLBACK_CORE_TOKENS.STATE_DANGER,
          glow: FALLBACK_CORE_TOKENS.STATE_DANGER,
          body: withAlpha(FALLBACK_CORE_TOKENS.STATE_DANGER, 0.42),
        };
      case "chaos":
        return {
          bubble: withAlpha(FALLBACK_CORE_TOKENS.SURFACE_1, 0.98),
          border: FALLBACK_CORE_TOKENS.SECONDARY_NEON,
          text: FALLBACK_CORE_TOKENS.TEXT_MAIN,
          tail: FALLBACK_CORE_TOKENS.SECONDARY_NEON,
          glow: FALLBACK_CORE_TOKENS.STATE_WARNING,
          body: withAlpha(FALLBACK_CORE_TOKENS.SECONDARY_NEON, 0.26),
        };
      case "guide":
        return {
          bubble: withAlpha(FALLBACK_CORE_TOKENS.SURFACE_1, 0.97),
          border: FALLBACK_CORE_TOKENS.TEXT_MUTED,
          text: FALLBACK_CORE_TOKENS.TEXT_MAIN,
          tail: FALLBACK_CORE_TOKENS.TEXT_MUTED,
          glow: FALLBACK_CORE_TOKENS.TEXT_MUTED,
          body: withAlpha(FALLBACK_CORE_TOKENS.SURFACE_2, 0.75),
        };
      case "seven_played":
        return {
          bubble: "rgba(20, 30, 0, 0.97)",
          border: FALLBACK_CORE_TOKENS.STATE_WARNING,
          text: FALLBACK_CORE_TOKENS.STATE_WARNING,
          tail: FALLBACK_CORE_TOKENS.STATE_WARNING,
          glow: FALLBACK_CORE_TOKENS.STATE_WARNING,
          body: withAlpha(FALLBACK_CORE_TOKENS.STATE_WARNING, 0.28),
        };
      case "ass":
        return {
          bubble: withAlpha(FALLBACK_CORE_TOKENS.SURFACE_1, 0.97),
          border: FALLBACK_CORE_TOKENS.SECONDARY_NEON,
          text: FALLBACK_CORE_TOKENS.TEXT_MAIN,
          tail: FALLBACK_CORE_TOKENS.SECONDARY_NEON,
          glow: FALLBACK_CORE_TOKENS.SECONDARY_NEON,
          body: withAlpha(FALLBACK_CORE_TOKENS.SURFACE_2, 0.7),
        };
      case "unter":
        return {
          bubble: withAlpha(FALLBACK_CORE_TOKENS.SURFACE_1, 0.97),
          border: FALLBACK_CORE_TOKENS.SECONDARY_NEON,
          text: FALLBACK_CORE_TOKENS.TEXT_MAIN,
          tail: FALLBACK_CORE_TOKENS.SECONDARY_NEON,
          glow: FALLBACK_CORE_TOKENS.SECONDARY_NEON,
          body: withAlpha(FALLBACK_CORE_TOKENS.SURFACE_2, 0.7),
        };
      case "mvp":
        return {
          bubble: "rgba(35, 25, 0, 0.98)",
          border: FALLBACK_CORE_TOKENS.STATE_WARNING,
          text: FALLBACK_CORE_TOKENS.STATE_WARNING,
          tail: FALLBACK_CORE_TOKENS.STATE_WARNING,
          glow: FALLBACK_CORE_TOKENS.STATE_WARNING,
          body: withAlpha(FALLBACK_CORE_TOKENS.STATE_WARNING, 0.45),
        };
      default:
        return {
          bubble: withAlpha(FALLBACK_CORE_TOKENS.SURFACE_1, 0.97),
          border: FALLBACK_CORE_TOKENS.STATE_WARNING,
          text: FALLBACK_CORE_TOKENS.TEXT_INVERSE,
          tail: FALLBACK_CORE_TOKENS.STATE_WARNING,
          glow: FALLBACK_CORE_TOKENS.STATE_WARNING,
          body: withAlpha(FALLBACK_CORE_TOKENS.STATE_WARNING, 0.35),
        };
    }
  };
  const colors = getColors();

  if (!visible && trail.length === 0 && confetti.length === 0) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, shakeStyle]} pointerEvents="none">
      {/* Screen flash */}
      <Animated.View style={[{
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.glow,
        zIndex: 95,
      }, flashStyle]} />

      {/* Confetti */}
      {confetti.map((p) => (
        <ConfettiPiece key={p.id} x={p.x} y={p.y} color={p.color} size={p.size} angle={p.angle} />
      ))}

      {/* Trail particles */}
      {trail.map((p) => (
        <TrailParticle key={p.id} emoji={p.emoji} x={p.x} y={p.y} />
      ))}

      {/* Speech bubble – larger, more dramatic */}
      <Animated.View
        style={[
          {
            position: "absolute",
            backgroundColor: colors.bubble,
            borderRadius: 18,
            paddingHorizontal: 18,
            paddingVertical: 14,
            borderWidth: 3,
            borderColor: colors.border,
            shadowColor: colors.glow,
            shadowOpacity: 0.9,
            shadowRadius: 24,
            elevation: 16,
            maxWidth: SW * 0.78,
            left: speechPos.x,
            top: speechPos.y,
            zIndex: 110,
          },
          speechStyle,
        ]}
      >
        {/* Inner glow */}
        <View style={{
          position: "absolute",
          top: 2, left: 2, right: 2, bottom: 2,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: 0.3,
        }} />
        <Text style={{
          color: colors.text,
          fontWeight: "900",
          fontSize: 18,
          textAlign: "center",
          textShadowColor: colors.glow,
          textShadowRadius: 8,
          textShadowOffset: { width: 0, height: 0 },
          letterSpacing: 0.5,
        }}>
          {phrase}
        </Text>
        {(spotlightPlayerName || statsText) && (
          <Text style={{
            color: FALLBACK_CORE_TOKENS.TEXT_MAIN,
            fontWeight: "700",
            fontSize: 12,
            textAlign: "center",
            marginTop: 6,
            opacity: 0.9,
          }}>
            {[spotlightPlayerName ? `Spotlight: ${spotlightPlayerName}` : "", statsText || ""]
              .filter(Boolean)
              .join(" • ")}
          </Text>
        )}
        {/* Speech tail */}
        <View style={{
          position: "absolute",
          bottom: -11,
          left: 20,
          width: 0,
          height: 0,
          borderLeftWidth: 9,
          borderRightWidth: 9,
          borderTopWidth: 11,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: colors.border,
        }} />
        <View style={{
          position: "absolute",
          bottom: -8,
          left: 22,
          width: 0,
          height: 0,
          borderLeftWidth: 7,
          borderRightWidth: 7,
          borderTopWidth: 9,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: colors.bubble,
        }} />
      </Animated.View>

      {/* The Bird (animated mascot sprite, existing event + flight logic retained) */}
      {visible && (
        <Animated.View style={[{ position: "absolute", width: 124, height: 114, zIndex: 105 }, containerStyle]}>
          {/* Outer neon glow */}
          <Animated.View style={[{
            position: "absolute",
            width: 96,
            height: 84,
            borderRadius: 999,
            top: 9,
            left: 11,
            backgroundColor: colors.glow,
            shadowColor: colors.glow,
            shadowOpacity: 0.95,
            shadowRadius: 26,
            elevation: 20,
          }, glowStyle]} />

          {/* Event-colored body glow overlay */}
          <Animated.View style={[{
            position: "absolute",
            width: 88,
            height: 78,
            borderRadius: 999,
            top: 12,
            left: 15,
            backgroundColor: colors.glow,
          }, bodyGlowStyle]} />

          {/* Sprite loop only here; the parent container keeps existing movement */}
          <AmselMascot
            visible={visible}
            startPosition={{ x: 6, y: 6 }}
            endPosition={{ x: 6, y: 6 }}
            duration={
              currentEvent === "chaos"
                ? 760
                : currentEvent === "draw_chain" || currentEvent === "seven_played"
                  ? 820
                  : currentEvent === "elimination" || currentEvent === "loser"
                    ? 780
                    : currentEvent === "winner"
                      ? 980
                      : currentEvent === "round_start"
                        ? 1040
                        : 900
            }
            animationType={
              currentEvent === "chaos"
                ? "chaos"
                : currentEvent === "draw_chain" || currentEvent === "seven_played"
                  ? "drawChain"
                  : currentEvent === "elimination"
                    ? "elimination"
                    : currentEvent === "winner"
                      ? "victory"
                      : currentEvent === "loser"
                        ? "elimination"
                        : currentEvent === "round_start"
                          ? "roundStart"
                          : "flyBy"
            }
            wingFrameMs={
              currentEvent === "draw_chain" || currentEvent === "seven_played"
                ? 96
                : currentEvent === "chaos"
                  ? 92
                  : currentEvent === "winner"
                  ? 110
                  : 120
            }
            trailStrength={
              currentEvent === "chaos"
                ? "strong"
                : currentEvent === "draw_chain" || currentEvent === "seven_played"
                  ? "normal"
                  : currentEvent === "round_start"
                  ? "subtle"
                  : "normal"
            }
            size={{
              width: currentEvent === "winner" || currentEvent === "chaos" ? 118 : 112,
              height: currentEvent === "winner" || currentEvent === "chaos" ? 108 : 102,
            }}
            rotation={
              currentEvent === "elimination" || currentEvent === "loser"
                ? -8
                : currentEvent === "winner"
                  ? 6
                  : currentEvent === "chaos"
                    ? -4
                    : 0
            }
            scale={
              currentEvent === "winner"
                ? 1.06
                : currentEvent === "chaos"
                  ? 1.04
                  : 1
            }
            glowTrail={
              currentEvent === "draw_chain" ||
              currentEvent === "seven_played" ||
              currentEvent === "chaos" ||
              currentEvent === "winner"
            }
            motionEnabled={false}
            zIndex={106}
          />

          {/* Subtle eye accent glow to preserve event readability */}
          <Animated.View style={[{
            position: "absolute",
            width: 18,
            height: 18,
            borderRadius: 999,
            top: 20,
            left: 70,
            backgroundColor: colors.glow,
            shadowColor: colors.glow,
            shadowOpacity: 1,
            shadowRadius: 10,
            elevation: 8,
          }, eyeGlowStyle]} />

          {/* Talons for elimination moments (kept from previous behavior) */}
          <Animated.View style={[{
            position: "absolute",
            top: 83,
            left: 46,
            width: 14,
            height: 8,
            borderBottomWidth: 3,
            borderBottomColor: FALLBACK_CORE_TOKENS.STATE_WARNING,
            borderLeftWidth: 2,
            borderLeftColor: FALLBACK_CORE_TOKENS.STATE_WARNING,
            borderRadius: 3,
          }, clawStyle]} />
          <Animated.View style={[{
            position: "absolute",
            top: 83,
            left: 58,
            width: 14,
            height: 8,
            borderBottomWidth: 3,
            borderBottomColor: FALLBACK_CORE_TOKENS.STATE_WARNING,
            borderRightWidth: 2,
            borderRightColor: FALLBACK_CORE_TOKENS.STATE_WARNING,
            borderRadius: 3,
          }, clawStyle]} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

function TrailParticle({ emoji, x, y }: { emoji: string; x: number; y: number }) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.2);
  const rotate = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1.8, { damping: 8, stiffness: 180 });
    rotate.value = withTiming(Math.random() * 60 - 30, { duration: 500 });
    translateY.value = withTiming(-20 + Math.random() * -30, { duration: 800, easing: Easing.out(Easing.ease) });
    opacity.value = withDelay(400, withTiming(0, { duration: 800 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
      { translateY: translateY.value },
    ],
  }));

  return (
    <Animated.View style={[{ position: "absolute", left: x, top: y, zIndex: 100 }, style]}>
      <Text style={{ fontSize: 24 }}>{emoji}</Text>
    </Animated.View>
  );
}

function ConfettiPiece({ x, y, color, size, angle }: { x: number; y: number; color: string; size: number; angle: number }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: 150 }),
      withDelay(1200, withTiming(0, { duration: 800 })),
    );
    scale.value = withSpring(1, { damping: 6, stiffness: 200 });
    translateY.value = withTiming(80 + Math.random() * 120, { duration: 2000, easing: Easing.in(Easing.ease) });
    rotate.value = withTiming(angle + 360 + Math.random() * 720, { duration: 2000, easing: Easing.out(Easing.ease) });
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[{
      position: "absolute",
      left: x,
      top: y,
      width: size,
      height: size * 0.6,
      backgroundColor: color,
      borderRadius: size * 0.15,
      zIndex: 108,
    }, style]} />
  );
}
