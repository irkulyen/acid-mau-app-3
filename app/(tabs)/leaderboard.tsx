import { ScrollView, Text, View, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

export default function LeaderboardScreen() {
  const { data: topPlayers, isLoading } = trpc.profile.leaderboard.useQuery({ limit: 50 });

  return (
    <ScreenContainer className="p-6">
      <View className="mb-6">
        <Text className="text-3xl font-bold text-foreground">Rangliste</Text>
        <Text className="text-muted mt-1">Die besten Acid-Mau Spieler</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#228B22" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          <View className="gap-3">
            {topPlayers?.map((player, index) => (
              <View
                key={player.id}
                className="bg-surface rounded-xl p-4 border border-border flex-row items-center"
              >
                {/* Rank */}
                <View className="w-12 items-center">
                  {index < 3 ? (
                    <Text className="text-3xl">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                    </Text>
                  ) : (
                    <Text className="text-xl font-bold text-muted">#{index + 1}</Text>
                  )}
                </View>

                {/* Player Info */}
                <View className="flex-1 ml-4 flex-row items-center">
                  {player.avatarUrl ? (
                    <Image
                      source={{ uri: player.avatarUrl }}
                      style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10, borderWidth: 1, borderColor: "rgba(148, 163, 184, 0.7)" }}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        marginRight: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        borderWidth: 1,
                        borderColor: "rgba(148, 163, 184, 0.7)",
                      }}
                    >
                      <Text className="text-foreground font-bold">
                        {player.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View className="flex-1">
                  <Text className="text-foreground text-lg font-semibold">
                    {player.username}
                  </Text>
                  <View className="flex-row gap-4 mt-1">
                    <Text className="text-muted text-sm">
                      {player.totalGamesWon} Siege
                    </Text>
                    <Text className="text-muted text-sm">
                      {player.totalGamesPlayed} Spiele
                    </Text>
                  </View>
                  </View>
                </View>

                {/* Win Rate */}
                <View className="items-end">
                  <Text className="text-primary text-xl font-bold">
                    {player.totalGamesPlayed > 0
                      ? Math.round((player.totalGamesWon / player.totalGamesPlayed) * 100)
                      : 0}
                    %
                  </Text>
                  <Text className="text-muted text-xs">Siegrate</Text>
                </View>
              </View>
            ))}

            {(!topPlayers || topPlayers.length === 0) && (
              <View className="items-center justify-center py-12">
                <Text className="text-muted text-lg">Noch keine Spieler in der Rangliste</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
