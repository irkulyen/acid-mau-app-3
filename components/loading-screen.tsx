import { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

export function LoadingScreen() {
  const pulse = useSharedValue(0.88);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.04, { duration: 1200, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.95,
  }));

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Animated.View style={logoStyle}>
        <Image
          source={require("@/assets/branding/crazy-amsel-logo.png")}
          style={{ width: 112, height: 112, marginBottom: 14 }}
          contentFit="contain"
        />
      </Animated.View>
      {/* Loading Spinner */}
      <ActivityIndicator size="large" color="#228B22" />
      
      {/* Loading Text */}
      <Text className="text-foreground text-2xl font-bold mt-4">
        Acid-Mau
      </Text>
      <Text className="text-muted text-base mt-2">
        Lade...
      </Text>
    </View>
  );
}
