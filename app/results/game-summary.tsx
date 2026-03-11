import { Touchable } from "@/components/ui/button";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-provider";
import { trpc } from "@/lib/trpc";

export default function GameSummaryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { winner, players, roundNumber } = useLocalSearchParams<{
    winner: string;
    players: string;
    roundNumber: string;
  }>();

  const parsedPlayers = players ? JSON.parse(players) : [];
  const { data: profile } = trpc.profile.me.useQuery(undefined, {
    enabled: !!user,
  });

  const isWinner = winner === user?.name;

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1">
          {/* Header */}
          <View className="items-center mb-8">
            <Text className="text-5xl mb-4">{isWinner ? "🎉" : "😔"}</Text>
            <Text className="text-foreground text-3xl font-bold mb-2">
              {isWinner ? "Gewonnen!" : "Spiel beendet"}
            </Text>
            <Text className="text-muted text-lg">
              {winner} hat gewonnen
            </Text>
          </View>

          {/* Game Stats */}
          <View className="bg-surface rounded-2xl p-6 mb-6 border border-border">
            <Text className="text-foreground text-xl font-bold mb-4">
              Spielstatistiken
            </Text>
            <View className="gap-3">
              <View className="flex-row justify-between">
                <Text className="text-muted">Runden gespielt:</Text>
                <Text className="text-foreground font-semibold">{roundNumber}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted">Spieler:</Text>
                <Text className="text-foreground font-semibold">{parsedPlayers.length}</Text>
              </View>
            </View>
          </View>

          {/* Players Ranking */}
          <View className="bg-surface rounded-2xl p-6 mb-6 border border-border">
            <Text className="text-foreground text-xl font-bold mb-4">
              Endstand
            </Text>
            <View className="gap-3">
              {parsedPlayers
                .sort((a: any, b: any) => a.lossPoints - b.lossPoints)
                .map((player: any, index: number) => (
                  <View
                    key={player.id}
                    className={`flex-row items-center justify-between p-3 rounded-xl ${
                      index === 0 ? "bg-success/20" : "bg-background"
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <Text className="text-foreground text-xl font-bold w-8">
                        #{index + 1}
                      </Text>
                      <View>
                        <Text className="text-foreground font-semibold">
                          {player.username}
                        </Text>
                        <Text className="text-muted text-sm">
                          {player.lossPoints} Verluste
                        </Text>
                      </View>
                    </View>
                    {index === 0 && <Text className="text-2xl">👑</Text>}
                  </View>
                ))}
            </View>
          </View>

          {/* Personal Stats (if logged in) */}
          {profile && (
            <View className="bg-surface rounded-2xl p-6 mb-6 border border-border">
              <Text className="text-foreground text-xl font-bold mb-4">
                Deine Gesamtstatistik
              </Text>
              <View className="gap-3">
                <View className="flex-row justify-between">
                  <Text className="text-muted">Gespielte Spiele:</Text>
                  <Text className="text-foreground font-semibold">
                    {profile.totalGamesPlayed}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-muted">Siege:</Text>
                  <Text className="text-success font-semibold">
                    {profile.totalGamesWon}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-muted">Siegesrate:</Text>
                  <Text className="text-foreground font-semibold">
                    {profile.totalGamesPlayed > 0
                      ? Math.round((profile.totalGamesWon / profile.totalGamesPlayed) * 100)
                      : 0}
                    %
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Actions */}
          <View className="gap-3 mt-auto">
            <Pressable
              onPress={() => router.replace("/")}
              style={({ pressed }) => [{
                backgroundColor: '#228B22',
                borderRadius: 9999,
                paddingVertical: 16,
                opacity: pressed ? 0.8 : 1,
              }]}
            >
              <Text className="text-background text-center font-bold text-lg">
                Zurück zum Hauptmenü
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
