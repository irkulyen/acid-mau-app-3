import { Touchable } from "@/components/ui/button";
import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator, ScrollView, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-provider";
import { useSocket } from "@/lib/socket-provider";
import { trpc } from "@/lib/trpc";
import { getRoomFlowStatus } from "@/lib/ux-status";

export default function JoinRoomScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [roomCode, setRoomCode] = useState("");
  const { isConnected } = useSocket();
  const sanitizedCode = roomCode.trim().toUpperCase();
  const codeLooksValid = /^[A-Z0-9]{6}$/.test(sanitizedCode);
  const roomFlowStatus = getRoomFlowStatus({
    isConnected,
    isJoining: false,
    hasRoomState: false,
  });

  const { data: availableRooms, isLoading } = trpc.rooms.available.useQuery(undefined, {
    enabled: !!user,
  });

  const handleJoinByCode = () => {
    if (!codeLooksValid) {
      Alert.alert("Ungültiger Raum-Code", "Bitte gib einen gültigen 6-stelligen Raum-Code ein.");
      return;
    }

    // Navigate to room with code (will be handled by room screen)
    router.push(`/lobby/room?code=${sanitizedCode}`);
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
          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 12,
              borderColor:
                roomFlowStatus.tone === "success"
                  ? "rgba(34,139,34,0.55)"
                  : "rgba(234,179,8,0.55)",
              backgroundColor:
                roomFlowStatus.tone === "success"
                  ? "rgba(34,139,34,0.12)"
                  : "rgba(234,179,8,0.12)",
            }}
          >
            <Text className="text-foreground font-semibold">{roomFlowStatus.title}</Text>
            <Text className="text-muted text-sm mt-1">{roomFlowStatus.detail}</Text>
          </View>
          <Text className="text-foreground text-lg font-semibold mb-4">
            Mit Code beitreten
          </Text>
          <TextInput
            value={roomCode}
            onChangeText={(text) => setRoomCode(text.toUpperCase())}
            placeholder="Raum-Code eingeben"
            placeholderTextColor="#8B7355"
            maxLength={6}
            autoCapitalize="characters"
            className="bg-background border border-border rounded-xl px-4 py-4 text-foreground text-lg mb-4"
          />
          <Text
            style={{
              fontSize: 12,
              marginBottom: 10,
              color: roomCode.length > 0 && !codeLooksValid ? "#DC2626" : "#6B7280",
            }}
          >
            {roomCode.length > 0 && !codeLooksValid
              ? "Raum-Code muss genau 6 Zeichen (A-Z, 0-9) haben."
              : "Beispiel: PRKDEO"}
          </Text>
          <Touchable
            onPress={codeLooksValid ? handleJoinByCode : undefined}
            className="bg-primary px-6 py-4 rounded-xl active:opacity-80"
            style={{ opacity: codeLooksValid ? 1 : 0.45 }}
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
