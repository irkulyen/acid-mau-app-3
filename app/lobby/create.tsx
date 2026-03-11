import { useState, useEffect, useCallback } from "react";
import { View, Text, Switch, ActivityIndicator, Pressable, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-provider";
import { useSocket } from "@/lib/socket-provider";
import { trpc } from "@/lib/trpc";

export default function CreateRoomScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: profile } = trpc.profile.me.useQuery(undefined, { enabled: !!user });
  const [isPrivate, setIsPrivate] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [botCount, setBotCount] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  const { isConnected, createRoom, setOnRoomCreated, setOnError } = useSocket();

  // Registriere Callbacks beim Mount, entferne beim Unmount
  useEffect(() => {
    setOnRoomCreated((data) => {
      console.log("[create] Room created:", data.roomCode);
      setIsCreating(false);
      router.push(`/lobby/room?code=${data.roomCode}&botCount=${botCount}` as any);
    });

    setOnError((error) => {
      setIsCreating(false);
      Alert.alert("Fehler", error);
    });

    return () => {
      setOnRoomCreated(null);
      setOnError(null);
    };
  }, [botCount, router, setOnRoomCreated, setOnError]);

  // Bot count can't exceed maxPlayers - 1 (at least 1 human)
  const maxBots = maxPlayers - 1;

  const handleSetMaxPlayers = (num: number) => {
    setMaxPlayers(num);
    if (botCount > num - 1) {
      setBotCount(num - 1);
    }
  };

  const handleCreateRoom = () => {
    if (!user || !profile) {
      Alert.alert("Fehler", "Bitte melde dich an, um einen Raum zu erstellen");
      return;
    }

    if (!isConnected) {
      Alert.alert("Fehler", "Keine Verbindung zum Server. Bitte warte kurz.");
      return;
    }

    setIsCreating(true);
    createRoom(user.id, profile.username, maxPlayers);
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1">
          {/* Header */}
          <View className="mb-8">
            <Pressable
              onPress={() => router.push("/" as any)}
              style={({ pressed }) => [{ marginBottom: 16, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text className="text-primary text-lg">← Zurück</Text>
            </Pressable>
            <Text className="text-3xl font-bold text-foreground">Raum erstellen</Text>
            <Text className="text-muted mt-2">Erstelle einen neuen Spielraum</Text>
          </View>

          {/* Settings */}
          <View className="gap-6">
            {/* Privacy Setting */}
            <View className="bg-surface rounded-2xl p-6 border border-border">
              <View className="flex-row justify-between items-center">
                <View className="flex-1 mr-4">
                  <Text className="text-foreground text-lg font-semibold">Privater Raum</Text>
                  <Text className="text-muted text-sm mt-1">
                    Nur mit Code beitretbar
                  </Text>
                </View>
                <Switch
                  value={isPrivate}
                  onValueChange={setIsPrivate}
                  trackColor={{ false: "#E5E7EB", true: "#228B22" }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Max Players */}
            <View className="bg-surface rounded-2xl p-6 border border-border">
              <Text className="text-foreground text-lg font-semibold mb-2">
                Maximale Spieleranzahl
              </Text>
              <Text className="text-muted text-sm mb-4">
                Echte Spieler + KI zusammen
              </Text>
              <View className="flex-row gap-3">
                {[2, 3, 4, 5, 6].map((num) => (
                  <Pressable
                    key={num}
                    onPress={() => handleSetMaxPlayers(num)}
                    style={({ pressed }) => [{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: maxPlayers === num ? '#228B22' : '#E5E7EB',
                      backgroundColor: maxPlayers === num ? '#228B22' : 'transparent',
                      opacity: pressed ? 0.8 : 1,
                      alignItems: 'center',
                    }]}
                  >
                    <Text style={{
                      fontWeight: 'bold',
                      fontSize: 18,
                      color: maxPlayers === num ? '#FFFFFF' : '#11181C',
                    }}>
                      {num}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Bot Count */}
            <View className="bg-surface rounded-2xl p-6 border border-border">
              <Text className="text-foreground text-lg font-semibold mb-2">
                KI-Gegner
              </Text>
              <Text className="text-muted text-sm mb-4">
                {botCount === 0
                  ? "Keine KI – nur echte Spieler"
                  : `${botCount} KI + ${maxPlayers - botCount} freie Plätze für Spieler`}
              </Text>
              <View className="flex-row gap-3">
                {Array.from({ length: maxBots + 1 }, (_, i) => i).map((num) => (
                  <Pressable
                    key={num}
                    onPress={() => setBotCount(num)}
                    style={({ pressed }) => [{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: botCount === num ? '#0a7ea4' : '#E5E7EB',
                      backgroundColor: botCount === num ? '#0a7ea4' : 'transparent',
                      opacity: pressed ? 0.8 : 1,
                      alignItems: 'center',
                    }]}
                  >
                    <Text style={{
                      fontWeight: 'bold',
                      fontSize: 18,
                      color: botCount === num ? '#FFFFFF' : '#11181C',
                    }}>
                      {num}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Create Button */}
            <Pressable
              onPress={handleCreateRoom}
              disabled={isCreating || !isConnected}
              style={({ pressed }) => [{
                backgroundColor: '#228B22',
                paddingHorizontal: 32,
                paddingVertical: 20,
                borderRadius: 16,
                opacity: (isCreating || !isConnected) ? 0.5 : pressed ? 0.8 : 1,
              }]}
            >
              {isCreating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>
                  Raum erstellen
                </Text>
              )}
            </Pressable>

            {!isConnected && (
              <Text className="text-muted text-center text-sm">
                Verbinde mit Server...
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
