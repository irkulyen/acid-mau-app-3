import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Touchable } from "@/components/ui/button";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";

export default function PracticeSetupScreen() {
  const router = useRouter();
  const [playerCount, setPlayerCount] = useState(4); // Default: 4 Spieler (Du + 3 Bots)

  const handleStartPractice = () => {
    router.push(`/practice/game?players=${playerCount}` as any);
  };

  return (
    <ScreenContainer className="p-6">
      <View className="flex-1">
        {/* Header */}
        <View className="mb-8">
          <Pressable
            onPress={() => router.push("/" as any)}
            style={({ pressed }) => [{ marginBottom: 16, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text className="text-primary text-lg">← Zurück</Text>
          </Pressable>
          <Text className="text-3xl font-bold text-foreground">Übungsmodus</Text>
          <Text className="text-muted mt-2">Spiele gegen KI-Gegner</Text>
        </View>

        {/* Player Count Selection */}
        <View className="bg-surface rounded-2xl p-6 border border-border mb-6">
          <Text className="text-foreground text-lg font-semibold mb-4">
            Anzahl Spieler (Du + Bots)
          </Text>
          <View className="flex-row gap-3 flex-wrap">
            {[2, 3, 4, 5, 6].map((num) => (
              <Touchable
                key={num}
                onPress={() => setPlayerCount(num)}
                className={`px-6 py-4 rounded-xl ${
                  playerCount === num
                    ? "bg-primary"
                    : "bg-background border border-border"
                }`}
              >
                <Text
                  className={`text-lg font-semibold ${
                    playerCount === num ? "text-background" : "text-foreground"
                  }`}
                >
                  {num}
                </Text>
              </Touchable>
            ))}
          </View>
          <Text className="text-muted text-sm mt-4">
            Du spielst gegen {playerCount - 1} KI-Gegner
          </Text>
        </View>

        {/* Start Button */}
        <Touchable
          onPress={handleStartPractice}
          className="bg-primary px-8 py-6 rounded-2xl"
        >
          <Text className="text-background text-2xl font-bold text-center">
            Spiel starten
          </Text>
        </Touchable>
      </View>
    </ScreenContainer>
  );
}
