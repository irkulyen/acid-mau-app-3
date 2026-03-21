import { useState, useCallback } from "react";
import { View, Text, Switch, ActivityIndicator, Pressable, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-provider";
import { useSocket } from "@/lib/socket-provider";
import { trpc } from "@/lib/trpc";
import { getRoomFlowStatus, toFriendlyRoomError } from "@/lib/ux-status";

export default function CreateRoomScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: profile } = trpc.profile.me.useQuery(undefined, { enabled: !!user });
  const [isPrivate, setIsPrivate] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [botCount, setBotCount] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  const { isConnected, gameState, createRoom, leaveRoom, recoverSession, setOnRoomCreated, setOnError } = useSocket();
  const canCreateRoom = Boolean(user && profile) && !isCreating;
  const flowStatus = getRoomFlowStatus({
    isConnected,
    isJoining: false,
    hasRoomState: Boolean(gameState),
  });

  // Register callbacks only while this screen is focused.
  // Prevents background screens from overriding active room/join handlers.
  useFocusEffect(useCallback(() => {
    setOnRoomCreated((data) => {
      console.log("[create] Room created:", data.roomCode);
      setIsCreating(false);
      router.push(`/lobby/room?code=${data.roomCode}&botCount=${botCount}` as any);
    });

    setOnError((error) => {
      setIsCreating(false);
      if (error.includes("User already has an active room session")) {
        const roomCode = gameState?.roomCode;
        const player = gameState?.players.find((p) => p.userId === user?.id);

        Alert.alert(
          "Aktive Sitzung gefunden",
          roomCode
            ? `Du bist noch im Raum ${roomCode}.`
            : "Du bist noch in einem aktiven Raum.",
          [
            roomCode
              ? {
                  text: "Zum Raum",
                  onPress: () => router.push(`/lobby/room?code=${roomCode}` as any),
                }
              : {
                  text: "Sitzung aktualisieren",
                  onPress: () => {
                    void recoverSession();
                  },
                },
            (gameState && player)
              ? {
                  text: "Verlassen & neu erstellen",
                  style: "destructive",
                  onPress: () => {
                    leaveRoom(gameState.roomId, player.id);
                    setTimeout(() => {
                      if (user && profile) {
                        createRoom(user.id, profile.username, maxPlayers, isPrivate);
                      }
                    }, 350);
                  },
                }
              : { text: "OK", style: "cancel" },
          ],
        );
        return;
      }
      Alert.alert("Fehler", toFriendlyRoomError(error));
    });

    return () => {
      setOnRoomCreated(null);
      setOnError(null);
    };
  }, [botCount, createRoom, gameState, isPrivate, leaveRoom, maxPlayers, profile, recoverSession, router, setOnRoomCreated, setOnError, user]));

  // Bot count can't exceed maxPlayers - 1 (at least 1 human)
  const maxBots = maxPlayers - 1;

  const handleSetMaxPlayers = (num: number) => {
    setMaxPlayers(num);
    if (botCount > num - 1) {
      setBotCount(num - 1);
    }
  };

  const handleCreateRoom = async () => {
    if (!user || !profile) {
      Alert.alert("Fehler", "Bitte melde dich an, um einen Raum zu erstellen");
      return;
    }

    if (!isConnected) {
      setIsCreating(true);
      try {
        await recoverSession();
      } catch {
        setIsCreating(false);
        Alert.alert("Verbindung fehlgeschlagen", "Server aktuell nicht erreichbar. Bitte erneut versuchen.");
        return;
      }
      createRoom(user.id, profile.username, maxPlayers, isPrivate);
      return;
    }

    setIsCreating(true);
    createRoom(user.id, profile.username, maxPlayers, isPrivate);
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
            <View
              style={{
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderWidth: 1,
                borderColor:
                  flowStatus.tone === "success"
                    ? "rgba(34,139,34,0.55)"
                    : "rgba(234,179,8,0.55)",
                backgroundColor:
                  flowStatus.tone === "success"
                    ? "rgba(34,139,34,0.12)"
                    : "rgba(234,179,8,0.12)",
              }}
            >
              <Text className="text-foreground font-semibold">{flowStatus.title}</Text>
              <Text className="text-muted text-sm mt-1">{flowStatus.detail}</Text>
            </View>

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
              onPress={canCreateRoom ? handleCreateRoom : undefined}
              disabled={!canCreateRoom}
              style={({ pressed }) => [{
                backgroundColor: canCreateRoom ? '#228B22' : '#94A3B8',
                paddingHorizontal: 32,
                paddingVertical: 20,
                borderRadius: 16,
                opacity: canCreateRoom ? (pressed ? 0.8 : 1) : 0.55,
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
                Noch keine Verbindung. Du kannst tippen, wir senden automatisch sobald der Server erreichbar ist.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
