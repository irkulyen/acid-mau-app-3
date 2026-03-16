import { useEffect, useMemo } from "react";
import { View, Text } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { FX_TOKENS, withAlpha } from "@/lib/design-tokens";

type Intensity = 1 | 2 | 3 | 4 | 5;

function suitLabel(suit?: string) {
  if (suit === "eichel") return "🌰 Eichel";
  if (suit === "gruen") return "🍀 Gras";
  if (suit === "rot") return "❤️ Herz";
  if (suit === "schellen") return "🔔 Schellen";
  return "❔";
}

type DiscardImpactBurstProps = {
  visible: boolean;
  eventKey: number;
  intensity: Intensity;
  onDone?: () => void;
};

export function DiscardImpactBurst({ visible, eventKey, intensity, onDone }: DiscardImpactBurstProps) {
  const progress = useSharedValue(0);
  const particles = useMemo(() => {
    const count = 8 + intensity * 4;
    return Array.from({ length: count }).map((_, i) => {
      const base = (eventKey + 1) * (i + 3);
      const angle = (Math.PI * 2 * i) / count;
      const speed = 10 + (base % 8) + intensity * 4;
      const size = 3 + (base % 4);
      const isCard = i % 3 === 0;
      return { id: i, angle, speed, size, isCard };
    });
  }, [eventKey, intensity]);

  useEffect(() => {
    if (!visible) return;
    progress.value = 0;
    const dur = 320 + intensity * 80;
    progress.value = withTiming(1, { duration: dur, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished && onDone) runOnJS(onDone)();
    });
  }, [visible, eventKey, intensity, onDone, progress]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ scale: 0.7 + progress.value * 1.35 }],
  }));

  const particleCloudStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ scale: 0.9 + progress.value * 1.3 }, { rotate: `${progress.value * 420}deg` }],
  }));

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={{ position: "absolute", left: -20, top: -20, width: 92, height: 112, zIndex: 50 }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 23,
            top: 33,
            width: 46,
            height: 46,
            borderRadius: 23,
            borderWidth: 2,
            borderColor: withAlpha(FX_TOKENS.DRAW_CHAIN_SHADOW, 0.9),
          },
          ringStyle,
        ]}
      />
      <Animated.View style={[{ position: "absolute", left: 43, top: 53 }, particleCloudStyle]}>
        {particles.map((p) => {
          const spread = p.speed * 2.8;
          return (
            <View
              key={p.id}
              style={{
                position: "absolute",
                left: Math.cos(p.angle) * spread,
                top: Math.sin(p.angle) * spread,
                width: p.isCard ? p.size + 5 : p.size + 1,
                height: p.isCard ? p.size + 7 : p.size + 1,
                borderRadius: p.isCard ? 2 : 99,
                backgroundColor: p.isCard
                  ? withAlpha(FX_TOKENS.DRAW_CHAIN_FLASH, 0.9)
                  : withAlpha(FX_TOKENS.WISH_TEXT_SELECTED, 0.95),
                borderWidth: p.isCard ? 1 : 0,
                borderColor: p.isCard ? withAlpha(FX_TOKENS.WISH_TEXT_DEFAULT, 0.7) : "transparent",
              }}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}

type SuitWishBurstProps = {
  visible: boolean;
  eventKey: number;
  wishSuit?: string;
  onDone?: () => void;
};

export function SuitWishBurst({ visible, eventKey, wishSuit, onDone }: SuitWishBurstProps) {
  const progress = useSharedValue(0);
  const suits = ["eichel", "gruen", "rot", "schellen"] as const;

  useEffect(() => {
    if (!visible) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished && onDone) runOnJS(onDone)();
    });
  }, [visible, eventKey, onDone, progress]);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.max(0, (progress.value - 0.75) / 0.25),
    transform: [{ scale: 0.92 + Math.min(1, progress.value * 1.1) * 0.08 }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          alignSelf: "center",
          top: 18,
          zIndex: 70,
          flexDirection: "row",
          gap: 8,
          backgroundColor: "rgba(12, 18, 26, 0.94)",
          borderRadius: 14,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: "rgba(120, 145, 170, 0.8)",
        },
        panelStyle,
      ]}
    >
      {suits.map((suit) => {
        const selected = suit === wishSuit;
        return (
          <View
            key={suit}
            style={{
              minWidth: 56,
              paddingHorizontal: 8,
              paddingVertical: 6,
              borderRadius: 10,
              backgroundColor: selected ? "rgba(46, 224, 128, 0.22)" : "rgba(80, 88, 96, 0.2)",
              borderWidth: 1.5,
              borderColor: selected ? "rgba(46, 224, 128, 1)" : "rgba(120, 130, 140, 0.5)",
            }}
          >
            <Text
              style={{
                color: selected ? FX_TOKENS.WISH_TEXT_SELECTED : FX_TOKENS.WISH_TEXT_DEFAULT,
                fontSize: 11,
                fontWeight: "800",
                textAlign: "center",
              }}
            >
              {suitLabel(suit)}
            </Text>
          </View>
        );
      })}
    </Animated.View>
  );
}

type RoundStartGlowProps = {
  visible: boolean;
  eventKey: number;
  onDone?: () => void;
};

export function RoundStartGlow({ visible, eventKey, onDone }: RoundStartGlowProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished && onDone) runOnJS(onDone)();
    });
  }, [visible, eventKey, onDone, progress]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ scale: 0.72 + progress.value * 0.75 }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          alignSelf: "center",
          top: "41%",
          width: 230,
          height: 130,
          borderRadius: 999,
          backgroundColor: withAlpha(FX_TOKENS.WISH_TEXT_SELECTED, 0.22),
          zIndex: 65,
        },
        glowStyle,
      ]}
    />
  );
}
