import { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
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
} from "react-native-reanimated";
import { hashString, pickBySeed, seededRange } from "@/lib/deterministic";

const { width: SW, height: SH } = Dimensions.get("window");

const TRAIL_EMOJIS = ["⭐", "💫", "✨", "🌟", "💥", "🎵", "🎶", "❗", "❓", "🔥", "💀", "🃏"];

const ROUND_START_PHRASES = [
  "Na gut… neue Runde.",
  "Mal sehen, wer diesmal abstürzt.",
  "Konzentriert euch. Oder versucht es zumindest.",
  "Auf geht’s.",
];

const WINNER_PHRASES = [
  (n: string) => `${n} ist durch.`,
  (n: string) => `${n} legt die letzte Karte.`,
  (n: string) => "Und weg ist er.",
  () => "Nicht schlecht.",
  () => "Sauber gespielt.",
];

const LOSER_PHRASES = [
  (n: string) => `Autsch, ${n}.`,
  () => "Das tat weh.",
  () => "Das war wohl nichts.",
];

const DRAW_CHAIN_PHRASES = [
  (count: number) => `Oh oh… das wird teuer (+${count}).`,
  () => "Zieh mal schön Karten.",
  () => "Das eskaliert gerade.",
  () => "Ich glaube, das tut gleich weh.",
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

type EventType = "round_start" | "winner" | "loser" | "draw_chain" | "seven_played" | "ass" | "unter" | "mvp";

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
  eventId?: string;
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

const CONFETTI_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#FF8C00", "#00FF88", "#FF69B4", "#7B68EE"];

export function BlackbirdAnimation({
  visible, eventId, loserName, winnerName, eventType, drawChainCount, wishSuit, intensity = 3, spotlightPlayerName, statsText, variant, phrase: phraseFromServer, onDone, onStart,
}: BlackbirdAnimationProps) {
  const translateX = useSharedValue(-120);
  const translateY = useSharedValue(SH * 0.42);
  const rotate = useSharedValue(0);
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const wingPhase = useSharedValue(0);
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
  const spritePulse = useSharedValue(0);
  const spriteBob = useSharedValue(0);
  const spriteTilt = useSharedValue(0);
  const [trail, setTrail] = useState<TrailParticle[]>([]);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [phrase, setPhrase] = useState("");
  const [speechPos, setSpeechPos] = useState({ x: 0, y: 0 });
  const [currentEvent, setCurrentEvent] = useState<EventType>("round_start");
  const onDoneRef = useRef<(() => void) | undefined>(onDone);
  const onStartRef = useRef<(() => void) | undefined>(onStart);
  const animationRunTokenRef = useRef(0);
  const confettiClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    onStartRef.current = onStart;
  }, [onStart]);

  const fireOnDone = useCallback(() => {
    onDoneRef.current?.();
  }, []);

  const fireOnStart = useCallback(() => {
    onStartRef.current?.();
  }, []);

  const addTrailParticle = useCallback((particle: TrailParticle) => {
    setTrail((prev) => [...prev.slice(-18), particle]);
  }, []);

  const spawnConfetti = useCallback((centerX: number, centerY: number, seed: number, runToken: number) => {
    const pieces: ConfettiPiece[] = [];
    for (let i = 0; i < 24; i++) {
      const x = centerX + seededRange(seed, -SW * 0.3, SW * 0.3, i * 3 + 1);
      const y = centerY + seededRange(seed, -SH * 0.16, SH * 0.16, i * 3 + 2);
      pieces.push({
        id: seed * 100 + i,
        x,
        y,
        color: pickBySeed(CONFETTI_COLORS, seed, i * 3 + 4),
        size: seededRange(seed, 6, 16, i * 3 + 5),
        angle: seededRange(seed, 0, 360, i * 3 + 6),
      });
    }
    setConfetti(pieces);
    if (confettiClearTimerRef.current) {
      clearTimeout(confettiClearTimerRef.current);
      confettiClearTimerRef.current = null;
    }
    confettiClearTimerRef.current = setTimeout(() => {
      if (animationRunTokenRef.current !== runToken) return;
      setConfetti([]);
      confettiClearTimerRef.current = null;
    }, 2500);
  }, []);

  const fireOnDoneForRun = useCallback((runToken: number) => {
    if (animationRunTokenRef.current !== runToken) return;
    fireOnDone();
  }, [fireOnDone]);

  useEffect(() => {
    return () => {
      if (confettiClearTimerRef.current) {
        clearTimeout(confettiClearTimerRef.current);
        confettiClearTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      animationRunTokenRef.current += 1;
      setTrail([]);
      setConfetti([]);
      if (confettiClearTimerRef.current) {
        clearTimeout(confettiClearTimerRef.current);
        confettiClearTimerRef.current = null;
      }
      return;
    }
    const runToken = ++animationRunTokenRef.current;

    // Determine event type and phrase
    let evType: EventType = eventType || "round_start";
    let selectedPhrase: string;
    const seedBase = hashString(
      `${eventId || ""}:${eventType || ""}:${winnerName || ""}:${loserName || ""}:${drawChainCount || 0}:${wishSuit || ""}:${statsText || ""}`,
    );

    if (winnerName) {
      evType = "winner";
      selectedPhrase = pickBySeed(WINNER_PHRASES, seedBase, 1)(winnerName);
    } else if (loserName) {
      evType = "loser";
      selectedPhrase = pickBySeed(LOSER_PHRASES, seedBase, 2)(loserName);
    } else if (eventType === "seven_played") {
      selectedPhrase = pickBySeed(SEVEN_PLAYED_PHRASES, seedBase, 3)(drawChainCount || 1);
    } else if (eventType === "draw_chain" && drawChainCount) {
      selectedPhrase = pickBySeed(DRAW_CHAIN_PHRASES, seedBase, 4)(drawChainCount);
    } else if (eventType === "ass") {
      selectedPhrase = pickBySeed(ASS_PHRASES, seedBase, 5);
    } else if (eventType === "unter" && wishSuit) {
      selectedPhrase = pickBySeed(UNTER_PHRASES, seedBase, 6)();
    } else if (eventType === "mvp" && statsText) {
      selectedPhrase = pickBySeed(MVP_PHRASES, seedBase, 7)(statsText);
    } else {
      selectedPhrase = pickBySeed(ROUND_START_PHRASES, seedBase, 8);
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
    spritePulse.value = 0;
    spriteBob.value = 0;
    spriteTilt.value = 0;
    setTrail([]);
    setConfetti([]);

    fireOnStart();

    // === DRAMATIC ENTRANCE: Screen flash ===
    const isBigEvent = evType === "winner" || evType === "loser" || evType === "round_start" || evType === "mvp";
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

    // Event-based flights
    const isQuickEvent = evType !== "mvp";

    // Sprite breathing / premium "alive" feel
    spritePulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 460, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.1, { duration: 460, easing: Easing.inOut(Easing.ease) }),
      ),
      isQuickEvent ? 10 : 22,
      false,
    );
    spriteBob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 320, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 320, easing: Easing.inOut(Easing.ease) }),
      ),
      isQuickEvent ? 16 : 34,
      false,
    );
    spriteTilt.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 260, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 260, easing: Easing.inOut(Easing.ease) }),
      ),
      isQuickEvent ? 14 : 30,
      false,
    );

    const dur = (ms: number) => ({ duration: isQuickEvent ? ms * 0.6 : ms, easing: Easing.inOut(Easing.ease) });
    const fast = (ms: number) => ({ duration: isQuickEvent ? ms * 0.6 : ms, easing: Easing.out(Easing.cubic) });

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
            runOnJS(fireOnDoneForRun)(runToken);
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
            runOnJS(fireOnDoneForRun)(runToken);
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

    // Wing flapping – faster for dramatic effect
    wingPhase.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 90, easing: Easing.linear }),
        withTiming(0, { duration: 90, easing: Easing.linear }),
      ),
      isQuickEvent ? 18 : 36,
      false,
    );

    // Speech bubble timing
    const speechDelay = isQuickEvent ? 380 : 900;
    const speechDuration = isQuickEvent ? 850 : 1200;
    let speechHideTimer: ReturnType<typeof setTimeout> | null = null;
    const speechTimer = setTimeout(() => {
      if (animationRunTokenRef.current !== runToken) return;
      setSpeechPos({
        x: isQuickEvent ? SW * 0.12 : SW * 0.14,
        y: isQuickEvent ? SH * 0.16 : SH * 0.14,
      });
      speechScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      speechOpacity.value = withTiming(1, { duration: 200 });

      // Confetti burst for winner/loser
      if (evType === "winner" || evType === "loser") {
        spawnConfetti(SW * 0.4, SH * 0.26, seedBase + 901, runToken);
      }

      speechHideTimer = setTimeout(() => {
        if (animationRunTokenRef.current !== runToken) return;
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
      const y = SH * (0.28 + Math.sin(progress * Math.PI * 3) * 0.1 + seededRange(seedBase, 0, 0.06, i + 1));
      const emoji = pickBySeed(TRAIL_EMOJIS, seedBase, i + 11);
      const timer = setTimeout(
        () => addTrailParticle({ id: seedBase * 100 + i, emoji, x, y }),
        t,
      );
      intervals.push(timer);
    }

    return () => {
      intervals.forEach(clearTimeout);
      if (speechHideTimer) clearTimeout(speechHideTimer);
    };
  }, [visible, eventId, eventType, winnerName, loserName, drawChainCount, wishSuit, statsText, phraseFromServer, addTrailParticle, spawnConfetti, intensity, fireOnDoneForRun, fireOnStart]);

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

  const wingUpStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: 1 - wingPhase.value * 0.8 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + glowPulse.value * 0.7,
  }));

  const speechStyle = useAnimatedStyle(() => ({
    opacity: speechOpacity.value,
    transform: [{ scale: speechScale.value }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
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

  const spriteHaloStyle = useAnimatedStyle(() => ({
    opacity: 0.22 + spritePulse.value * 0.42,
    transform: [{ scale: 0.8 + spritePulse.value * 0.42 }],
  }));

  const spriteStyle = useAnimatedStyle(() => ({
    opacity: 0.86 + spritePulse.value * 0.14,
    transform: [
      { translateY: -3 + spriteBob.value * 6 },
      { rotate: `${-4 + spriteTilt.value * 8}deg` },
      { scale: 0.92 + spritePulse.value * 0.11 },
    ],
  }));

  // Event-based colors
  const getColors = () => {
    if (variant === "legendary") {
      return { bubble: "rgba(35, 25, 0, 0.98)", border: "#FFD700", text: "#FFE066", tail: "#FFD700", glow: "#FFC700", body: "#3D3000" };
    }
    switch (currentEvent) {
      case "winner": return { bubble: "rgba(5, 25, 5, 0.97)", border: "#22C55E", text: "#4ADE80", tail: "#22C55E", glow: "#00FF00", body: "#003300" };
      case "loser": return { bubble: "rgba(30, 5, 5, 0.97)", border: "#FF4444", text: "#FF6B6B", tail: "#FF4444", glow: "#FF0000", body: "#330000" };
      case "draw_chain": return { bubble: "rgba(30, 15, 0, 0.97)", border: "#FF8C00", text: "#FFB347", tail: "#FF8C00", glow: "#FF6600", body: "#331A00" };
      case "seven_played": return { bubble: "rgba(20, 30, 0, 0.97)", border: "#F59E0B", text: "#FCD34D", tail: "#F59E0B", glow: "#F59E0B", body: "#2A2200" };
      case "ass": return { bubble: "rgba(20, 0, 30, 0.97)", border: "#A855F7", text: "#C084FC", tail: "#A855F7", glow: "#9333EA", body: "#1A0033" };
      case "unter": return { bubble: "rgba(0, 15, 25, 0.97)", border: "#06B6D4", text: "#67E8F9", tail: "#06B6D4", glow: "#0891B2", body: "#001A26" };
      case "mvp": return { bubble: "rgba(35, 25, 0, 0.98)", border: "#FFD700", text: "#FFE066", tail: "#FFD700", glow: "#FFC700", body: "#3D3000" };
      default: return { bubble: "rgba(255, 255, 255, 0.97)", border: "#FFD700", text: "#111", tail: "#FFD700", glow: "#FFD700", body: "#332B00" };
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
        <TrailParticle key={p.id} particleId={p.id} emoji={p.emoji} x={p.x} y={p.y} />
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
            color: "#E8E8E8",
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

      {/* The Bird – larger (90x62) */}
      {visible && (
        <Animated.View style={[{ position: "absolute", width: 90, height: 62, zIndex: 105 }, containerStyle]}>
          {/* Premium halo behind mascot */}
          <Animated.View
            style={[
              {
                position: "absolute",
                width: 86,
                height: 86,
                borderRadius: 43,
                top: -12,
                left: 2,
                backgroundColor: colors.glow,
                shadowColor: colors.glow,
                shadowOpacity: 1,
                shadowRadius: 28,
                elevation: 30,
              },
              spriteHaloStyle,
            ]}
          />
          {/* Brand sprite layer */}
          <Animated.View
            style={[
              {
                position: "absolute",
                width: 72,
                height: 72,
                top: -8,
                left: 10,
                zIndex: 2,
              },
              spriteStyle,
            ]}
          >
            <Image
              source={require("@/assets/images/acid-mau-logo.png")}
              style={{ width: "100%", height: "100%" }}
              contentFit="contain"
            />
          </Animated.View>
          {/* Outer neon glow – bigger, more dramatic */}
          <Animated.View style={[{
            position: "absolute",
            width: 80,
            height: 52,
            borderRadius: 26,
            top: 5,
            left: 5,
            backgroundColor: colors.glow,
            shadowColor: colors.glow,
            shadowOpacity: 1,
            shadowRadius: 30,
            elevation: 20,
          }, glowStyle]} />

          {/* Event-colored body glow overlay */}
          <Animated.View style={[{
            position: "absolute",
            width: 52,
            height: 34,
            borderRadius: 20,
            top: 14,
            left: 16,
            backgroundColor: colors.glow,
          }, bodyGlowStyle]} />

          {/* Tail feathers – animated wag */}
          <Animated.View style={[{
            position: "absolute", width: 22, height: 14,
            backgroundColor: "#1a1a2e", borderRadius: 7,
            top: 28, left: 0,
            transformOrigin: "right center",
          }, tailStyle]}>
            {/* Tail detail */}
            <View style={{
              position: "absolute", width: 18, height: 10,
              backgroundColor: "#16213e", borderRadius: 5,
              top: 2, left: 0,
            }} />
            {/* Tail tip accent */}
            <Animated.View style={[{
              position: "absolute", width: 8, height: 3,
              backgroundColor: colors.glow, borderRadius: 2,
              top: 5, left: 0,
            }, glowStyle]} />
          </Animated.View>

          {/* Body – main shape */}
          <View style={{
            position: "absolute", width: 50, height: 34,
            backgroundColor: "#0a0a1a", borderRadius: 18,
            top: 14, left: 16,
          }} />
          {/* Body highlight – top */}
          <View style={{
            position: "absolute", width: 40, height: 18,
            backgroundColor: "#1a1a3e", borderRadius: 12,
            top: 16, left: 22,
            opacity: 0.5,
          }} />
          {/* Shimmer streak across body */}
          <Animated.View style={[{
            position: "absolute", width: 14, height: 28,
            backgroundColor: "#ffffff",
            borderRadius: 7,
            top: 17, left: 20,
            overflow: "hidden",
          }, shimmerStyle]} />
          {/* Belly – lighter */}
          <View style={{
            position: "absolute", width: 26, height: 14,
            backgroundColor: "#2a2a4e", borderRadius: 10,
            top: 28, left: 26,
            opacity: 0.45,
          }} />

          {/* Head – slightly larger */}
          <View style={{
            position: "absolute", width: 28, height: 25,
            backgroundColor: "#0a0a1a", borderRadius: 14,
            top: 6, left: 48,
          }} />
          {/* Head highlight */}
          <View style={{
            position: "absolute", width: 18, height: 12,
            backgroundColor: "#1a1a3e", borderRadius: 8,
            top: 8, left: 52,
            opacity: 0.4,
          }} />

          {/* Beak – two-tone, larger */}
          <View style={{
            position: "absolute", width: 18, height: 7,
            backgroundColor: "#FFD700", borderRadius: 4,
            top: 18, left: 74,
          }} />
          <View style={{
            position: "absolute", width: 16, height: 4,
            backgroundColor: "#FFA500", borderRadius: 3,
            top: 22, left: 74,
          }} />
          {/* Beak shine */}
          <View style={{
            position: "absolute", width: 6, height: 2,
            backgroundColor: "#FFF8DC", borderRadius: 1,
            top: 19, left: 76,
            opacity: 0.6,
          }} />

          {/* Eye – glowing, animated */}
          <Animated.View style={[{
            position: "absolute", width: 13, height: 13,
            backgroundColor: "#FFD700", borderRadius: 7,
            top: 10, left: 60,
            shadowColor: "#FFD700",
            shadowOpacity: 1,
            shadowRadius: 8,
            elevation: 8,
          }, eyeGlowStyle]}>
            <View style={{
              width: 7, height: 7,
              backgroundColor: "#000",
              borderRadius: 4,
              position: "absolute", top: 3, left: 3,
            }} />
            <View style={{
              width: 3, height: 3,
              backgroundColor: "#FFF",
              borderRadius: 2,
              position: "absolute", top: 3, left: 6,
            }} />
            {/* Red eye reflection for loser/draw events */}
            {(currentEvent === "loser" || currentEvent === "draw_chain" || currentEvent === "seven_played") && (
              <View style={{
                width: 2, height: 2,
                backgroundColor: "#FF0000",
                borderRadius: 1,
                position: "absolute", top: 5, left: 4,
              }} />
            )}
          </Animated.View>

          {/* Angry eyebrow – thicker */}
          <View style={{
            position: "absolute", width: 11, height: 3.5,
            backgroundColor: "#FF3333", borderRadius: 2,
            top: 6, left: 58,
            transform: [{ rotate: "-35deg" }],
          }} />

          {/* Wings – primary */}
          <Animated.View style={[{
            position: "absolute", width: 38, height: 22,
            backgroundColor: "#111133", borderRadius: 12,
            top: 0, left: 16,
            transformOrigin: "bottom center",
            borderWidth: 1.5,
            borderColor: "rgba(100, 100, 200, 0.3)",
          }, wingUpStyle]} />
          {/* Wing inner */}
          <Animated.View style={[{
            position: "absolute", width: 32, height: 18,
            backgroundColor: "#0d0d28", borderRadius: 10,
            top: 2, left: 22,
            transformOrigin: "bottom center",
          }, wingUpStyle]} />
          {/* Wing feather detail */}
          <Animated.View style={[{
            position: "absolute", width: 26, height: 3,
            backgroundColor: "rgba(100, 100, 200, 0.2)", borderRadius: 2,
            top: 10, left: 22,
            transformOrigin: "bottom center",
          }, wingUpStyle]} />

          {/* Neon accent stripes on wing */}
          <Animated.View style={[{
            position: "absolute", width: 28, height: 3,
            backgroundColor: colors.glow,
            borderRadius: 2,
            top: 18, left: 20,
          }, glowStyle]} />
          <Animated.View style={[{
            position: "absolute", width: 18, height: 2,
            backgroundColor: colors.glow,
            borderRadius: 1,
            top: 22, left: 24,
            opacity: 0.5,
          }, glowStyle]} />

          {/* Feet – slightly larger */}
          <View style={{
            position: "absolute", width: 8, height: 6,
            backgroundColor: "#FFA500", borderRadius: 3,
            top: 47, left: 30,
          }} />
          <View style={{
            position: "absolute", width: 8, height: 6,
            backgroundColor: "#FFA500", borderRadius: 3,
            top: 47, left: 42,
          }} />
          {/* Toe details */}
          <View style={{
            position: "absolute", width: 4, height: 3,
            backgroundColor: "#FF8C00", borderRadius: 2,
            top: 52, left: 28,
          }} />
          <View style={{
            position: "absolute", width: 4, height: 3,
            backgroundColor: "#FF8C00", borderRadius: 2,
            top: 52, left: 44,
          }} />

          {/* Crown/crest on head */}
          <View style={{
            position: "absolute", width: 8, height: 8,
            backgroundColor: "#FFD700", borderRadius: 4,
            top: 2, left: 58,
            transform: [{ rotate: "45deg" }],
          }} />
          <View style={{
            position: "absolute", width: 6, height: 6,
            backgroundColor: "#FFA500", borderRadius: 3,
            top: 1, left: 64,
            transform: [{ rotate: "30deg" }],
          }} />
          {/* Final sprite pass on top for crisp mascot silhouette */}
          <Animated.View
            style={[
              {
                position: "absolute",
                width: 70,
                height: 70,
                top: -8,
                left: 11,
                zIndex: 40,
              },
              spriteStyle,
            ]}
          >
            <Image
              source={require("@/assets/images/acid-mau-logo.png")}
              style={{ width: "100%", height: "100%" }}
              contentFit="contain"
            />
          </Animated.View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

function TrailParticle({ particleId, emoji, x, y }: { particleId: number; emoji: string; x: number; y: number }) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.2);
  const rotate = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    const seed = hashString(`${particleId}:${emoji}:${x}:${y}`);
    scale.value = withSpring(1.8, { damping: 8, stiffness: 180 });
    rotate.value = withTiming(seededRange(seed, -30, 30, 1), { duration: 500 });
    translateY.value = withTiming(seededRange(seed, -48, -20, 2), { duration: 800, easing: Easing.out(Easing.ease) });
    opacity.value = withDelay(400, withTiming(0, { duration: 800 }));
  }, [particleId, emoji, x, y]);

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
    const seed = hashString(`${x}:${y}:${size}:${angle}`);
    opacity.value = withSequence(
      withTiming(1, { duration: 150 }),
      withDelay(1200, withTiming(0, { duration: 800 })),
    );
    scale.value = withSpring(1, { damping: 6, stiffness: 200 });
    translateY.value = withTiming(seededRange(seed, 80, 200, 1), { duration: 2000, easing: Easing.in(Easing.ease) });
    rotate.value = withTiming(angle + seededRange(seed, 360, 1080, 2), { duration: 2000, easing: Easing.out(Easing.ease) });
  }, [x, y, size, angle]);

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
