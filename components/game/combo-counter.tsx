import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ComboCounterProps {
  comboCount: number;
  playerName: string;
}

const COMBO_COLORS = [
  "#FFD700", // 2x - Gold
  "#FF8C00", // 3x - Orange
  "#FF4500", // 4x - Rot-Orange
  "#FF0000", // 5x - Rot
  "#FF00FF", // 6+ - Magenta
];

export function ComboCounter({ comboCount, playerName }: ComboCounterProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(-10);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (comboCount >= 2) {
      setVisible(true);
      scale.value = 0;
      opacity.value = 0;
      rotation.value = -10;

      // Pop in
      scale.value = withSequence(
        withTiming(1.4, { duration: 200, easing: Easing.out(Easing.back(3)) }),
        withTiming(1, { duration: 150 }),
        withDelay(1200, withTiming(0.8, { duration: 200 })),
      );
      opacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withDelay(1200, withTiming(0, { duration: 300 })),
      );
      rotation.value = withSequence(
        withTiming(5, { duration: 100 }),
        withTiming(-3, { duration: 100 }),
        withTiming(0, { duration: 100 }),
      );

      const timer = setTimeout(() => setVisible(false), 1800);
      return () => clearTimeout(timer);
    }
  }, [comboCount]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
    opacity: opacity.value,
  }));

  if (!visible || comboCount < 2) return null;

  const colorIndex = Math.min(comboCount - 2, COMBO_COLORS.length - 1);
  const color = COMBO_COLORS[colorIndex];
  const flames = comboCount >= 5 ? "🔥🔥🔥" : comboCount >= 4 ? "🔥🔥" : comboCount >= 3 ? "🔥" : "";

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[styles.badge, { borderColor: color, shadowColor: color }, animStyle]}>
        <Text style={[styles.count, { color }]}>{comboCount}x</Text>
        <Text style={[styles.label, { color }]}>COMBO</Text>
        {flames ? <Text style={styles.flames}>{flames}</Text> : null}
        <Text style={styles.name}>{playerName}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  badge: {
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    borderRadius: 20,
    borderWidth: 3,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: "center",
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
  },
  count: {
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 4,
    marginTop: -4,
  },
  flames: {
    fontSize: 24,
    marginTop: 4,
  },
  name: {
    color: "#9BA1A6",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
});
