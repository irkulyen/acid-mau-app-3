import { useEffect } from "react";
import { Dimensions, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { PlayingCard } from "./playing-card";
import { hashString, seededRange } from "@/lib/deterministic";

const { width: SW, height: SH } = Dimensions.get("window");

type DrawCardAnimationProps = {
  visible: boolean;
  drawCount: number;
  playerName?: string;
  targetX: number;
  targetY: number;
  onDone?: () => void;
};

export function DrawCardAnimation({
  visible,
  drawCount,
  playerName,
  targetX,
  targetY,
  onDone,
}: DrawCardAnimationProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;

    const safeCount = Math.max(1, drawCount);
    const seed = hashString(`${playerName || "player"}:${safeCount}:${targetX.toFixed(3)}:${targetY.toFixed(3)}`);

    const startX = SW * 0.5 - 29;
    const startY = SH * 0.54;
    const endX = SW * targetX - 29;
    const endY = SH * targetY;

    const arcX = seededRange(seed, -24, 24, 1);
    const arcLift = seededRange(seed, 24, 52, 2);
    const finalRotate = seededRange(seed, -14, 14, 3);

    translateX.value = startX;
    translateY.value = startY;
    rotate.value = 0;
    scale.value = 0.86;
    opacity.value = 0;

    opacity.value = withSequence(
      withTiming(1, { duration: 70 }),
      withTiming(1, { duration: 340 }),
      withTiming(0, { duration: 120 }),
    );

    scale.value = withSequence(
      withTiming(1.04, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withTiming(0.96, { duration: 150, easing: Easing.inOut(Easing.ease) }),
      withTiming(1, { duration: 120, easing: Easing.inOut(Easing.ease) }),
    );

    translateX.value = withSequence(
      withTiming(startX + arcX, { duration: 130, easing: Easing.out(Easing.cubic) }),
      withTiming(endX, { duration: 240, easing: Easing.inOut(Easing.cubic) }),
    );

    translateY.value = withSequence(
      withTiming(startY - arcLift, { duration: 130, easing: Easing.out(Easing.cubic) }),
      withTiming(endY, { duration: 240, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished && onDone) {
          runOnJS(onDone)();
        }
      }),
    );

    rotate.value = withTiming(finalRotate, {
      duration: 360,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, drawCount, playerName, targetX, targetY, onDone]);

  const cardStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: translateX.value,
    top: translateY.value,
    transform: [{ rotate: `${rotate.value}deg` }, { scale: scale.value }],
    opacity: opacity.value,
    zIndex: 205,
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: translateX.value - 4,
    top: translateY.value + 4,
    opacity: opacity.value * 0.28,
    transform: [{ rotate: `${rotate.value * 0.7}deg` }, { scale: scale.value * 0.94 }],
    zIndex: 204,
  }));

  if (!visible) return null;

  const showStackHint = drawCount > 1;

  return (
    <>
      <Animated.View pointerEvents="none" style={shadowStyle}>
        <View
          style={{
            width: 58,
            height: 85,
            borderRadius: 11,
            backgroundColor: "rgba(8, 12, 18, 0.75)",
          }}
        />
      </Animated.View>
      {showStackHint && (
        <Animated.View
          pointerEvents="none"
          style={[
            cardStyle,
            {
              transform: [{ translateX: -6 }, { translateY: 4 }, { rotate: "-7deg" }],
              opacity: 0.56,
            },
          ]}
        >
          <PlayingCard card={{ suit: "eichel", rank: "7", id: "draw-fx-stack" }} size="medium" faceDown />
        </Animated.View>
      )}
      <Animated.View pointerEvents="none" style={cardStyle}>
        <PlayingCard card={{ suit: "eichel", rank: "7", id: "draw-fx-main" }} size="medium" faceDown />
        {showStackHint && (
          <View
            style={{
              position: "absolute",
              right: -8,
              top: -8,
              minWidth: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: "rgba(12, 24, 18, 0.96)",
              borderWidth: 1,
              borderColor: "rgba(95, 232, 160, 0.85)",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 6,
            }}
          >
            <Text style={{ color: "#CFFFE7", fontWeight: "900", fontSize: 12 }}>+{drawCount}</Text>
          </View>
        )}
      </Animated.View>
    </>
  );
}
