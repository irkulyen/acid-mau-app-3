import { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type Position = { x: number; y: number };

type AnimationType =
  | "flyBy"
  | "drawChain"
  | "chaos"
  | "elimination"
  | "roundStart"
  | "victory";

interface AmselMascotProps {
  visible: boolean;
  startPosition: Position;
  endPosition: Position;
  duration: number;
  animationType?: AnimationType;
  size?: { width: number; height: number };
  rotation?: number;
  scale?: number;
  glowTrail?: boolean;
  zIndex?: number;
  onComplete?: () => void;
  // Optional: allows using only sprite animation while parent controls movement.
  motionEnabled?: boolean;
  wingFrameMs?: number;
  trailStrength?: "subtle" | "normal" | "strong";
}

const FRAME_SEQUENCE = [0, 1, 2, 1] as const;
const FRAME_MS = 120;

const FRAMES = [
  require("@/assets/mascot/amsel_fly_1.png"),
  require("@/assets/mascot/amsel_fly_2.png"),
  require("@/assets/mascot/amsel_fly_3.png"),
  require("@/assets/mascot/amsel_fly_4.png"),
] as const;

function getFlightParams(animationType: AnimationType | undefined) {
  switch (animationType) {
    case "drawChain":
      return { amplitude: 16, cycles: 3.3, tilt: 9 };
    case "chaos":
      return { amplitude: 18, cycles: 3.8, tilt: 10 };
    case "elimination":
      return { amplitude: 10, cycles: 2.5, tilt: 8 };
    case "roundStart":
      return { amplitude: 12, cycles: 2.2, tilt: 6 };
    case "victory":
      return { amplitude: 20, cycles: 4.2, tilt: 12 };
    default:
      return { amplitude: 14, cycles: 3.0, tilt: 7 };
  }
}

function getSecondaryMotionParams(animationType: AnimationType | undefined) {
  switch (animationType) {
    case "drawChain":
      return { bob: 2.6, tilt: 5.6, scale: 0.024, jitter: 0.6 };
    case "chaos":
      return { bob: 3.6, tilt: 8.2, scale: 0.03, jitter: 1.45 };
    case "elimination":
      return { bob: 2.2, tilt: 6.8, scale: 0.02, jitter: 0.9 };
    case "roundStart":
      return { bob: 1.6, tilt: 3.6, scale: 0.015, jitter: 0.2 };
    case "victory":
      return { bob: 3.0, tilt: 6.0, scale: 0.028, jitter: 0.5 };
    default:
      return { bob: 2.1, tilt: 4.6, scale: 0.02, jitter: 0.35 };
  }
}

export function AmselMascot({
  visible,
  startPosition,
  endPosition,
  duration,
  animationType = "flyBy",
  size = { width: 112, height: 102 },
  rotation = 0,
  scale = 1,
  glowTrail = true,
  zIndex = 105,
  onComplete,
  motionEnabled = true,
  wingFrameMs = FRAME_MS,
  trailStrength = "normal",
}: AmselMascotProps) {
  const progress = useSharedValue(0);
  const trailPulse = useSharedValue(0);
  const flapCycle = useSharedValue(0);
  const [frameStep, setFrameStep] = useState(0);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flight = useMemo(() => getFlightParams(animationType), [animationType]);
  const secondary = useMemo(() => getSecondaryMotionParams(animationType), [animationType]);

  useEffect(() => {
    if (!visible) {
      progress.value = 0;
      trailPulse.value = 0;
      setFrameStep(0);
      cancelAnimation(flapCycle);
      flapCycle.value = 0;
      if (frameTimerRef.current) {
        clearInterval(frameTimerRef.current);
        frameTimerRef.current = null;
      }
      return;
    }

    // Wing flap sequence: 1 -> 2 -> 3 -> 2 -> repeat
    setFrameStep(0);
    frameTimerRef.current = setInterval(() => {
      setFrameStep((prev) => (prev + 1) % FRAME_SEQUENCE.length);
    }, wingFrameMs);

    // Continuous oscillator for subtle secondary body/head/tail style movement.
    const cycleMs = Math.max(260, wingFrameMs * FRAME_SEQUENCE.length);
    flapCycle.value = 0;
    flapCycle.value = withRepeat(
      withTiming(1, { duration: cycleMs, easing: Easing.linear }),
      -1,
      false,
    );

    trailPulse.value = 0;
    trailPulse.value = withTiming(1, {
      duration: Math.max(400, Math.min(duration, 1400)),
      easing: Easing.inOut(Easing.ease),
    });

    if (motionEnabled) {
      progress.value = 0;
      progress.value = withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished && onComplete) runOnJS(onComplete)();
      });
    } else {
      progress.value = 0;
    }

    return () => {
      if (frameTimerRef.current) {
        clearInterval(frameTimerRef.current);
        frameTimerRef.current = null;
      }
      cancelAnimation(flapCycle);
      flapCycle.value = 0;
    };
  }, [visible, duration, motionEnabled, onComplete, progress, trailPulse, flapCycle, wingFrameMs]);

  const mascotStyle = useAnimatedStyle(() => {
    const p = motionEnabled ? progress.value : 0;
    const flap = Math.sin(flapCycle.value * Math.PI * 2);
    const jitterOsc = Math.sin(flapCycle.value * Math.PI * 6) * secondary.jitter;
    const x = startPosition.x + (endPosition.x - startPosition.x) * p;
    const baseY = startPosition.y + (endPosition.y - startPosition.y) * p;
    const sineY = motionEnabled ? Math.sin(p * Math.PI * 2 * flight.cycles) * flight.amplitude : 0;
    const tilt = motionEnabled ? Math.sin(p * Math.PI * 2) * flight.tilt : 0;
    const microBob = flap * secondary.bob;
    const microTilt = flap * secondary.tilt;
    const floatScale = motionEnabled ? 1 + Math.sin(p * Math.PI * 4) * 0.02 : 1;
    const microScale = 1 + flap * secondary.scale;
    const jitterX = motionEnabled ? 0 : jitterOsc;

    return {
      transform: [
        { translateX: x + jitterX },
        { translateY: baseY + sineY + microBob },
        { rotate: `${rotation + tilt + microTilt}deg` },
        { scale: scale * floatScale * microScale },
      ],
      opacity: visible ? 1 : 0,
    };
  });

  const trailOpacityFactor = trailStrength === "strong" ? 1.25 : trailStrength === "subtle" ? 0.7 : 1;
  const trailStyle = useAnimatedStyle(() => ({
    opacity: glowTrail
      ? (0.14 + Math.abs(Math.sin(trailPulse.value * Math.PI * 2)) * 0.22 + Math.abs(Math.sin(flapCycle.value * Math.PI * 2)) * 0.08) * trailOpacityFactor
      : 0,
    transform: [{ scale: 0.9 + trailPulse.value * 0.14 + Math.abs(Math.sin(flapCycle.value * Math.PI * 2)) * 0.05 }],
  }));

  const frameSource = FRAMES[FRAME_SEQUENCE[frameStep]];

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          width: size.width,
          height: size.height,
          zIndex,
        },
        mascotStyle,
      ]}
    >
      {glowTrail && (
        <Animated.View style={[styles.trailOuter, trailStyle]} />
      )}
      {glowTrail && (
        <Animated.View style={[styles.trailInner, trailStyle]} />
      )}
      <Image source={frameSource} contentFit="contain" style={{ width: size.width, height: size.height }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  trailOuter: {
    position: "absolute",
    width: "85%",
    height: "75%",
    borderRadius: 999,
    backgroundColor: "rgba(38, 233, 134, 0.22)",
    shadowColor: "#39E59F",
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 10,
  },
  trailInner: {
    position: "absolute",
    width: "62%",
    height: "52%",
    borderRadius: 999,
    backgroundColor: "rgba(51, 255, 170, 0.16)",
  },
});
