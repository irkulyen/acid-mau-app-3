import { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from "react-native-reanimated";
import { PlayingCard } from "./playing-card";
import type { Card } from "@/shared/game-types";

interface AnimatedDiscardPileProps {
  card: Card | null;
  size?: "small" | "medium" | "large";
}

export function AnimatedDiscardPile({ card, size = "large" }: AnimatedDiscardPileProps) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (card) {
      // Reset and animate in
      opacity.value = 0;
      scale.value = 0.8;
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  }, [card?.id]); // Trigger animation when card ID changes

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!card) {
    return (
      <View className="w-24 h-36 bg-surface rounded-xl border-2 border-dashed border-border items-center justify-center">
        <Text className="text-muted">Leer</Text>
      </View>
    );
  }

  return (
    <Animated.View style={animatedStyle}>
      <PlayingCard card={card} size={size} />
    </Animated.View>
  );
}
