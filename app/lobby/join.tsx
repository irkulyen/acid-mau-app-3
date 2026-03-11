import { Touchable } from "@/components/ui/button";
import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-provider";
import { trpc } from "@/lib/trpc";

export default function JoinRoomScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [roomCode, setRoomCode] = useState("");

  const { data: availableRooms, isLoading } = trpc.rooms.available.useQuery(undefined, {
    enabled: !!user,
  });

  const handleJoinByCode = () => {
    if (!roomCode.trim()) {
      alert("Bitte gib einen Raum-Code ein");
      return;
    }

    // Navigate to room with code (will be handled by room screen)
    router.push(`/lobby/room?code=${roomCode.toUpperCase()}`);
  };

  const handleJoinRoom = (code: string) => {
    router.push(`/lobby/room?code=${code}`);
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Header */}
        <View className="mb-8">
          <Pressable
            onPress={() => router.push("/" as any)}
            style={({ pressed }) => [{ marginBottom: 16, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text className="text-primary text-lg">← Zurück</Text>
          </Pressable>
          <Text className="text-3xl font-bold text-foreground">Raum beitreten</Text>
          <Text className="text-muted mt-2">Trete einem bestehenden Raum bei</Text>
        </View>

        {/* Join by Code */}
        <View className="bg-surface rounded-2xl p-6 border border-border mb-6">
          <Text className="text-foreground text-lg font-semibold mb-4">
            Mit Code beitreten
          </Text>
          <TextInput
            value={roomCode}
            onChangeText={(text) => setRoomCode(text.toUpperCase())}
            placeholder="Raum-Code eingeben"
            placeholderTextColor="#8B7355"
            maxLength={8}
            autoCapitalize="characters"
            className="bg-background border border-border rounded-xl px-4 py-4 text-foreground text-lg mb-4"
          />
          <Touchable
            onPress={handleJoinByCode}
            className="bg-primary px-6 py-4 rounded-xl active:opacity-80"
          >
            <Text className="text-background text-lg font-bold text-center">
              Beitreten
            </Text>
          </Touchable>
        </View>

        {/* Available Rooms */}
        <View>
          <Text className="text-foreground text-lg font-semibold mb-4">
            Verfügbare Räume
          </Text>

          {isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#228B22" />
            </View>
          ) : availableRooms && availableRooms.length > 0 ? (
            <View className="gap-3">
              {availableRooms.map((room) => (
                <Touchable
                  key={room.id}
                  onPress={() => handleJoinRoom(room.roomCode)}
                  className="bg-surface rounded-xl p-4 border border-border active:opacity-80"
                >
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1">
                      <Text className="text-foreground text-lg font-semibold">
                        Raum {room.roomCode}
                      </Text>
                      <Text className="text-muted text-sm mt-1">
                        {room.currentPlayers} / {room.maxPlayers} Spieler
                      </Text>
                    </View>
                    <View className="bg-primary px-4 py-2 rounded-lg">
                      <Text className="text-background font-semibold">Beitreten</Text>
                    </View>
                  </View>
                </Touchable>
              ))}
            </View>
          ) : (
            <View className="bg-surface rounded-xl p-8 border border-border">
              <Text className="text-muted text-center">
                Keine verfügbaren Räume gefunden
              </Text>
              <Text className="text-muted text-center text-sm mt-2">
                Erstelle einen neuen Raum oder trete mit Code bei
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
