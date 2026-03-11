import { Text, View, StyleSheet, Pressable } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Image } from "expo-image";
import type { Card } from "@/shared/game-types";

interface PlayingCardProps {
  card: Card;
  onPress?: () => void;
  disabled?: boolean;
  size?: "small" | "medium" | "large";
  faceDown?: boolean;
  elevated?: boolean;
}

const SUIT_SYMBOLS: Record<string, string> = {
  eichel: "🌰",
  gruen: "🍀",
  rot: "❤️",
  schellen: "🔔",
};

const SUIT_COLORS: Record<string, string> = {
  eichel: "#8B4513",
  gruen: "#228B22",
  rot: "#DC143C",
  schellen: "#DAA520",
};

const SUIT_BG_COLORS: Record<string, string> = {
  eichel: "rgba(139, 69, 19, 0.15)",
  gruen: "rgba(34, 139, 34, 0.15)",
  rot: "rgba(220, 20, 60, 0.15)",
  schellen: "rgba(218, 165, 32, 0.15)",
};

const SUIT_BORDER_GLOW: Record<string, string> = {
  eichel: "rgba(139, 69, 19, 0.4)",
  gruen: "rgba(34, 139, 34, 0.4)",
  rot: "rgba(220, 20, 60, 0.4)",
  schellen: "rgba(218, 165, 32, 0.4)",
};

const RANK_DISPLAY: Record<string, string> = {
  "7": "7",
  "8": "8",
  "9": "9",
  "10": "10",
  bube: "B",
  dame: "D",
  konig: "K",
  ass: "A",
};

const SIZES = {
  small: { width: 42, height: 63 },
  medium: { width: 58, height: 85 },
  large: { width: 75, height: 110 },
};

const TEXT_SIZES = {
  small: 10,
  medium: 14,
  large: 18,
};

const SYMBOL_SIZES = {
  small: 10,
  medium: 16,
  large: 24,
};

export function PlayingCard({ card, onPress, disabled, size = "medium", faceDown, elevated }: PlayingCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.95, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const cardSize = SIZES[size];
  const textSize = TEXT_SIZES[size];
  const symbolSize = SYMBOL_SIZES[size];

  if (faceDown) {
    return (
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled || !onPress}
          style={({ pressed }) => [
            styles.cardBack,
            cardSize,
            pressed && styles.pressed,
            disabled && styles.disabled,
          ]}
        >
          <Image
            source={require("@/assets/cards/card-back.png")}
            style={styles.cardBackImage}
            contentFit="cover"
          />
        </Pressable>
      </Animated.View>
    );
  }

  const suitColor = SUIT_COLORS[card.suit];
  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const suitBg = SUIT_BG_COLORS[card.suit];
  const suitGlow = SUIT_BORDER_GLOW[card.suit];
  const rankDisplay = RANK_DISPLAY[card.rank];

  // Special cards get extra flair
  const isSpecial = card.rank === "bube" || card.rank === "7" || card.rank === "ass";

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || !onPress}
        style={({ pressed }) => [
          styles.card,
          cardSize,
          {
            borderColor: suitColor,
            backgroundColor: "#0D0D0D",
            shadowColor: isSpecial ? suitColor : "#000",
            shadowOpacity: isSpecial ? 0.6 : 0.3,
            shadowRadius: isSpecial ? 10 : 6,
          },
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        {/* Subtle gradient background */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: suitBg,
              borderRadius: 10,
            },
          ]}
        />

        {/* Top-left corner: rank + suit mini */}
        <View style={styles.cornerTopLeft}>
          <Text style={[styles.cornerRank, { color: "white", fontSize: textSize * 0.85, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }]}>
            {rankDisplay}
          </Text>
          <Text style={{ fontSize: symbolSize, marginTop: -4 }}>{suitSymbol}</Text>
        </View>

        {/* Center: large suit symbol */}
        <View style={styles.cardCenter}>
          <Text style={{ fontSize: textSize * 1.2 }}>{suitSymbol}</Text>
        </View>

        {/* Bottom-right corner: rank + suit mini (rotated) */}
        <View style={styles.cornerBottomRight}>
          <Text style={{ fontSize: symbolSize, marginBottom: -4 }}>{suitSymbol}</Text>
          <Text style={[styles.cornerRank, { color: "white", fontSize: textSize * 0.85, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }]}>
            {rankDisplay}
          </Text>
        </View>

        {/* Special card indicator */}
        {isSpecial && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: 10,
                borderWidth: 1,
                borderColor: suitGlow,
              },
            ]}
          />
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardBack: {
    backgroundColor: "#1e2022",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cardBackImage: {
    width: "100%",
    height: "100%",
  },
  card: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 4,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    overflow: "visible",
  },
  cornerTopLeft: {
    position: "absolute",
    top: 2,
    left: 2,
    alignItems: "center",
    paddingTop: 2,
    paddingLeft: 2,
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: 2,
    right: 2,
    alignItems: "center",
    paddingBottom: 2,
    paddingRight: 2,
    transform: [{ rotate: "180deg" }],
  },
  cornerRank: {
    fontWeight: "900",
    lineHeight: 18,
  },
  cardCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
