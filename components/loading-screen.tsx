import { View, Text, ActivityIndicator } from "react-native";

export function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
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
