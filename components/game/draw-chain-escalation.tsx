import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Dimensions, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { FX_TOKENS, withAlpha } from "@/lib/design-tokens";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface DrawChainEscalationProps {
  drawChainCount: number;
}

export function DrawChainEscalation({ drawChainCount }: DrawChainEscalationProps) {
  const shakeX = useSharedValue(0);
  const shakeY = useSharedValue(0);
  const vignetteOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const [prevCount, setPrevCount] = useState(0);

  useEffect(() => {
    if (drawChainCount <= 1) {
      vignetteOpacity.value = withTiming(0, { duration: 300 });
      shakeX.value = 0;
      shakeY.value = 0;
      setPrevCount(0);
      return;
    }

    // Only trigger effects on chain increase
    if (drawChainCount > prevCount) {
      // Haptic feedback scales with chain
      if (Platform.OS !== "web") {
        if (drawChainCount >= 6) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else if (drawChainCount >= 4) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }

      // Screen shake intensity scales with chain
      const intensity = Math.min(drawChainCount * 1.0, 8);
      shakeX.value = withSequence(
        withTiming(intensity, { duration: 40 }),
        withTiming(-intensity, { duration: 40 }),
        withTiming(intensity * 0.7, { duration: 40 }),
        withTiming(-intensity * 0.7, { duration: 40 }),
        withTiming(intensity * 0.4, { duration: 40 }),
        withTiming(0, { duration: 40 }),
      );
      shakeY.value = withSequence(
        withTiming(-intensity * 0.5, { duration: 50 }),
        withTiming(intensity * 0.5, { duration: 50 }),
        withTiming(-intensity * 0.3, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );

      // Red vignette: opacity scales with chain
      const vignetteTarget = Math.min(0.04 + drawChainCount * 0.025, 0.2);
      vignetteOpacity.value = withTiming(vignetteTarget, { duration: 300 });

      // Lightning flash only in very high chain events
      if (drawChainCount >= 7) {
        flashOpacity.value = withSequence(
          withTiming(0.3, { duration: 50 }),
          withTiming(0, { duration: 100 }),
          withDelay(100, withTiming(0.18, { duration: 50 })),
          withTiming(0, { duration: 150 }),
        );
      }

      // Pulse effect
      pulseScale.value = withSequence(
        withTiming(1.03, { duration: 100, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 200 }),
      );
    }

    setPrevCount(drawChainCount);
  }, [drawChainCount]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shakeX.value },
      { translateY: shakeY.value },
      { scale: pulseScale.value },
    ],
  }));

  const vignetteStyle = useAnimatedStyle(() => ({
    opacity: vignetteOpacity.value,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  return (
    <>
      {/* Red vignette overlay */}
      <Animated.View style={[styles.vignette, vignetteStyle]} pointerEvents="none">
        <View style={styles.vignetteInner} />
      </Animated.View>

      {/* Lightning flash */}
      <Animated.View style={[styles.flash, flashStyle]} pointerEvents="none" />
    </>
  );
}

/** Wrapper that applies screen shake to its children */
export function DrawChainShakeWrapper({
  drawChainCount,
  children,
}: {
  drawChainCount: number;
  children: React.ReactNode;
}) {
  const shakeX = useSharedValue(0);
  const shakeY = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const [prevCount, setPrevCount] = useState(0);

  useEffect(() => {
    if (drawChainCount <= 1) {
      shakeX.value = 0;
      shakeY.value = 0;
      pulseScale.value = 1;
      setPrevCount(0);
      return;
    }

    if (drawChainCount > prevCount) {
      const intensity = Math.min(drawChainCount * 1.0, 8);
      shakeX.value = withSequence(
        withTiming(intensity, { duration: 40 }),
        withTiming(-intensity, { duration: 40 }),
        withTiming(intensity * 0.7, { duration: 40 }),
        withTiming(-intensity * 0.7, { duration: 40 }),
        withTiming(intensity * 0.4, { duration: 40 }),
        withTiming(0, { duration: 40 }),
      );
      shakeY.value = withSequence(
        withTiming(-intensity * 0.5, { duration: 50 }),
        withTiming(intensity * 0.5, { duration: 50 }),
        withTiming(-intensity * 0.3, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
      pulseScale.value = withSequence(
        withTiming(1.02, { duration: 100 }),
        withTiming(1, { duration: 200 }),
      );
    }

    setPrevCount(drawChainCount);
  }, [drawChainCount]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shakeX.value },
      { translateY: shakeY.value },
      { scale: pulseScale.value },
    ],
  }));

  return (
    <Animated.View style={[{ flex: 1 }, shakeStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  vignette: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 95,
  },
  vignetteInner: {
    flex: 1,
    borderWidth: 40,
    borderColor: withAlpha(FX_TOKENS.DRAW_CHAIN_SHADOW, 0.6),
    borderRadius: 0,
    // Gradient effect via shadow
    shadowColor: FX_TOKENS.DRAW_CHAIN_SHADOW,
    shadowOpacity: 1,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: FX_TOKENS.DRAW_CHAIN_FLASH,
    zIndex: 96,
  },
});
