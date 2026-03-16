import { Text, View, StyleSheet, Pressable } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Image } from "expo-image";
import type { Card } from "@/shared/game-types";
import { PLAYING_CARD_TOKENS, withAlpha } from "@/lib/design-tokens";

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
  eichel: PLAYING_CARD_TOKENS.SUIT_EICHEL,
  gruen: PLAYING_CARD_TOKENS.SUIT_GRUEN,
  rot: PLAYING_CARD_TOKENS.SUIT_ROT,
  schellen: PLAYING_CARD_TOKENS.SUIT_SCHELLEN,
};

const SUIT_BG_COLORS: Record<string, string> = {
  eichel: withAlpha(PLAYING_CARD_TOKENS.SUIT_EICHEL, 0.1),
  gruen: withAlpha(PLAYING_CARD_TOKENS.SUIT_GRUEN, 0.1),
  rot: withAlpha(PLAYING_CARD_TOKENS.SUIT_ROT, 0.1),
  schellen: withAlpha(PLAYING_CARD_TOKENS.SUIT_SCHELLEN, 0.1),
};

const SUIT_BORDER_GLOW: Record<string, string> = {
  eichel: withAlpha(PLAYING_CARD_TOKENS.SUIT_EICHEL, 0.28),
  gruen: withAlpha(PLAYING_CARD_TOKENS.SUIT_GRUEN, 0.28),
  rot: withAlpha(PLAYING_CARD_TOKENS.SUIT_ROT, 0.28),
  schellen: withAlpha(PLAYING_CARD_TOKENS.SUIT_SCHELLEN, 0.28),
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
  small: { width: 52, height: 78 },
  medium: { width: 58, height: 85 },
  large: { width: 75, height: 110 },
};

const TEXT_SIZES = {
  small: 11,
  medium: 14,
  large: 18,
};

const SYMBOL_SIZES = {
  small: 12,
  medium: 16,
  large: 24,
};

const CORNER_RANK_SIZES = {
  small: 13,
  medium: 14,
  large: 18,
};

const CENTER_SYMBOL_SIZES = {
  small: 22,
  medium: 26,
  large: 34,
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
  const cornerRankSize = CORNER_RANK_SIZES[size];
  const centerSymbolSize = CENTER_SYMBOL_SIZES[size];

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
            source={require("@/assets/cards/card-back-acid-mau.png")}
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
            backgroundColor: PLAYING_CARD_TOKENS.CARD_FACE_BG,
            shadowColor: isSpecial ? suitColor : PLAYING_CARD_TOKENS.CARD_SHADOW,
            shadowOpacity: isSpecial ? 0.36 : 0.24,
            shadowRadius: isSpecial ? 10 : 7,
          },
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        {/* Paper tone surface */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: suitBg,
              borderRadius: 10,
            },
          ]}
        />

        {/* Slight paper grain illusion */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: 10,
              backgroundColor: "rgba(111, 92, 61, 0.05)",
            },
          ]}
        />

        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: 10,
              borderWidth: 1.1,
              borderColor: "rgba(15, 23, 42, 0.26)",
            },
          ]}
        />

        {/* Top-left corner: rank + suit mini */}
        <View style={styles.cornerTopLeft}>
          <Text style={[styles.cornerRank, { color: suitColor, fontSize: cornerRankSize, fontWeight: "900" }]}>
            {rankDisplay}
          </Text>
          <Text style={{ fontSize: symbolSize, marginTop: -3 }}>{suitSymbol}</Text>
        </View>

        {/* Center: large suit symbol */}
        <View style={styles.cardCenter}>
          <Text style={{ fontSize: centerSymbolSize }}>{suitSymbol}</Text>
        </View>

        {/* Bottom-right corner: rank + suit mini (rotated) */}
        <View style={styles.cornerBottomRight}>
          <Text style={{ fontSize: symbolSize, marginBottom: -3 }}>{suitSymbol}</Text>
          <Text style={[styles.cornerRank, { color: suitColor, fontSize: cornerRankSize, fontWeight: "900" }]}>
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
    backgroundColor: PLAYING_CARD_TOKENS.CARD_BACK_BG,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: PLAYING_CARD_TOKENS.CARD_BACK_BORDER,
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
    borderWidth: 2.4,
    padding: 4,
    shadowOffset: { width: 0, height: 4 },
    elevation: 9,
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
