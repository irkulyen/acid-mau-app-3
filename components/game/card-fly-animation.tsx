import { useEffect } from "react";
import { View, Dimensions, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { PlayingCard } from "./playing-card";
import type { Card } from "@/shared/game-types";

const { width: SW, height: SH } = Dimensions.get("window");

interface CardFlyAnimationProps {
  /** The card to animate */
  card: Card | null;
  /** Whether the animation is active */
  visible: boolean;
  /** Called when animation completes */
  onDone?: () => void;
}

/**
 * Animates a card flying from the player's hand (bottom center)
 * to the discard pile (center of screen) with rotation and scale.
 */
export function CardFlyAnimation({ card, visible, onDone }: CardFlyAnimationProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible || !card) return;

    // Start position: bottom center (player's hand area)
    const startX = SW * 0.5 - 29; // half card width
    const startY = SH * 0.78;
    // End position: center (discard pile area)
    const endX = SW * 0.5 - 29;
    const endY = SH * 0.35;

    // Random slight rotation for natural feel
    const randomRotation = (Math.random() - 0.5) * 20; // -10 to +10 degrees

    translateX.value = startX;
    translateY.value = startY;
    rotate.value = 0;
    scale.value = 0.85;
    opacity.value = 0;

    // Fade in immediately
    opacity.value = withTiming(1, { duration: 80 });

    // Scale up slightly during flight, then back to normal
    scale.value = withSequence(
      withTiming(1.15, { duration: 200, easing: Easing.out(Easing.cubic) }),
      withTiming(1.0, { duration: 200, easing: Easing.inOut(Easing.ease) }),
    );

    // Fly to center with slight arc
    const midX = endX + (Math.random() - 0.5) * 30;
    translateX.value = withSequence(
      withTiming(midX, { duration: 250, easing: Easing.out(Easing.cubic) }),
      withTiming(endX, { duration: 150, easing: Easing.inOut(Easing.ease) }),
    );

    translateY.value = withSequence(
      withTiming(endY - 20, { duration: 250, easing: Easing.out(Easing.cubic) }),
      withTiming(endY, {
        duration: 150,
        easing: Easing.inOut(Easing.ease),
      }, (finished) => {
        if (finished && onDone) {
          opacity.value = withTiming(0, { duration: 100 });
          runOnJS(onDone)();
        }
      }),
    );

    // Rotate during flight
    rotate.value = withTiming(randomRotation, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, card?.id]);

  const animatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: translateX.value,
    top: translateY.value,
    transform: [
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
    zIndex: 200,
  }));

  if (!visible || !card) return null;

  return (
    <Animated.View style={animatedStyle}>
      <PlayingCard card={card} size="medium" />
    </Animated.View>
  );
}
