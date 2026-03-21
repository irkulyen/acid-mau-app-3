import { useEffect, useMemo } from "react";
import { View, Text } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  runOnJS,
} from "react-native-reanimated";

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
            borderColor: "rgba(255,180,0,0.9)",
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
                backgroundColor: p.isCard ? "rgba(220, 235, 255, 0.9)" : "rgba(46, 224, 128, 0.95)",
                borderWidth: p.isCard ? 1 : 0,
                borderColor: p.isCard ? "rgba(20,40,80,0.7)" : "transparent",
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
            <Text style={{ color: selected ? "#D8FFE8" : "#E6EDF3", fontSize: 11, fontWeight: "800", textAlign: "center" }}>
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
          backgroundColor: "rgba(46, 224, 128, 0.22)",
          zIndex: 65,
        },
        glowStyle,
      ]}
    />
  );
}

type SpecialCardRank = "7" | "ass" | "bube" | "8";

type SpecialCardActionFxProps = {
  visible: boolean;
  eventKey: number;
  rank?: SpecialCardRank;
  wishSuit?: string;
  direction?: "clockwise" | "counterclockwise";
  drawChainCount?: number;
  onDone?: () => void;
};

function specialTitle(rank?: SpecialCardRank, drawChainCount?: number) {
  if (rank === "7") return drawChainCount && drawChainCount > 1 ? `Ziehkette +${drawChainCount}` : "Ziehkette";
  if (rank === "ass") return "Aussetzen";
  if (rank === "bube") return "Wunschfarbe";
  if (rank === "8") return "Richtungswechsel";
  return "";
}

function specialTone(rank?: SpecialCardRank) {
  if (rank === "7") {
    return {
      bg: "rgba(92, 46, 10, 0.92)",
      border: "rgba(255, 184, 72, 0.95)",
      glow: "rgba(255, 142, 24, 0.28)",
    };
  }
  if (rank === "ass") {
    return {
      bg: "rgba(64, 18, 18, 0.92)",
      border: "rgba(255, 98, 98, 0.95)",
      glow: "rgba(255, 76, 76, 0.3)",
    };
  }
  if (rank === "bube") {
    return {
      bg: "rgba(20, 58, 46, 0.94)",
      border: "rgba(90, 230, 160, 0.95)",
      glow: "rgba(60, 220, 152, 0.24)",
    };
  }
  return {
    bg: "rgba(18, 38, 70, 0.94)",
    border: "rgba(110, 182, 255, 0.95)",
    glow: "rgba(88, 162, 255, 0.24)",
  };
}

export function SpecialCardActionFx({
  visible,
  eventKey,
  rank,
  wishSuit,
  direction,
  drawChainCount,
  onDone,
}: SpecialCardActionFxProps) {
  const progress = useSharedValue(0);
  const flash = useSharedValue(0);

  useEffect(() => {
    if (!visible || !rank) return;
    progress.value = 0;
    flash.value = 0;
    const dur = rank === "7" ? 620 : rank === "ass" ? 500 : rank === "bube" ? 560 : 520;
    flash.value = withSequence(
      withTiming(1, { duration: 80, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) }),
    );
    progress.value = withTiming(1, { duration: dur, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished && onDone) runOnJS(onDone)();
    });
  }, [visible, eventKey, rank, onDone, progress, flash]);

  const tone = specialTone(rank);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value * (rank === "7" ? 0.45 : rank === "ass" ? 0.34 : 0.26),
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.max(0, (progress.value - 0.74) / 0.26),
    transform: [
      { scale: 0.9 + Math.min(1, progress.value * 1.16) * 0.14 },
      { translateY: interpolate(progress.value, [0, 1], [8, -10]) },
    ],
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    opacity: rank === "8" ? (1 - progress.value) * 0.8 : 0,
    transform: [
      { rotate: `${interpolate(progress.value, [0, 1], [-20, 24])}deg` },
      { translateX: interpolate(progress.value, [0, 1], [-22, 24]) },
    ],
  }));

  const slashStyle = useAnimatedStyle(() => ({
    opacity: rank === "ass" ? (1 - progress.value) * 0.9 : 0,
    transform: [{ rotate: "-22deg" }, { scaleX: 0.8 + progress.value * 0.9 }],
  }));

  if (!visible || !rank) return null;

  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: "33%", alignItems: "center", zIndex: 72 }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 24,
            right: 24,
            top: -32,
            bottom: -28,
            borderRadius: 22,
            backgroundColor: tone.glow,
          },
          flashStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            minWidth: 198,
            maxWidth: 258,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: tone.border,
            backgroundColor: tone.bg,
            paddingHorizontal: 14,
            paddingVertical: 9,
            alignItems: "center",
            shadowColor: "#000",
            shadowOpacity: 0.24,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          },
          cardStyle,
        ]}
      >
        <Text style={{ color: "#F4FBFF", fontSize: 13, fontWeight: "900", letterSpacing: 0.4 }}>
          {specialTitle(rank, drawChainCount)}
        </Text>
        {rank === "bube" && wishSuit && (
          <Text style={{ color: "#D9FFF0", fontSize: 11, fontWeight: "800", marginTop: 2 }}>
            {suitLabel(wishSuit)}
          </Text>
        )}
        {rank === "8" && (
          <Text style={{ color: "#E3F4FF", fontSize: 11, fontWeight: "800", marginTop: 2 }}>
            {direction === "counterclockwise" ? "↺ Gegen den Uhrzeigersinn" : "↻ Im Uhrzeigersinn"}
          </Text>
        )}
      </Animated.View>
      {rank === "7" && (
        <Animated.View
          style={[
            {
              position: "absolute",
              width: 220,
              height: 44,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "rgba(255, 198, 103, 0.7)",
              backgroundColor: "rgba(255, 150, 42, 0.12)",
            },
            cardStyle,
          ]}
        />
      )}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 16,
            width: 210,
            height: 12,
            borderRadius: 8,
            backgroundColor: "rgba(255, 236, 207, 0.65)",
          },
          slashStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 6,
            width: 190,
            height: 48,
            borderRadius: 14,
            borderWidth: 1.2,
            borderColor: "rgba(139, 198, 255, 0.75)",
            backgroundColor: "rgba(68, 146, 255, 0.12)",
          },
          sweepStyle,
        ]}
      />
    </View>
  );
}
