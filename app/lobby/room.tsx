import { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-provider";
import { useSocket, type PreparationData } from "@/lib/socket-provider";
import { GamePreparationScreen, type PreparationDrawData } from "@/components/game/game-preparation-screen";
import { trpc } from "@/lib/trpc";

export default function RoomScreen() {
  const router = useRouter();
  const { code, botCount: botCountParam } = useLocalSearchParams<{ code: string; botCount?: string }>();
  const { user } = useAuth();
  const { data: profile } = trpc.profile.me.useQuery(undefined, { enabled: !!user });

  const [isJoining, setIsJoining] = useState(true);
  const [botsAdded, setBotsAdded] = useState(false);

  // Preparation state
  const [showPreparation, setShowPreparation] = useState(false);
  const [prepSeatDraws, setPrepSeatDraws] = useState<PreparationDrawData[]>([]);
  const [prepDealerDraws, setPrepDealerDraws] = useState<PreparationDrawData[]>([]);
  const [preparationDone, setPreparationDone] = useState(false);

  const {
    isConnected,
    gameState,
    joinRoom,
    leaveRoom,
    sendAction,
    addBot,
    sendPreparationDone,
    setOnPreparation,
    setOnError,
  } = useSocket();

  // Registriere Callbacks
  useEffect(() => {
    setOnPreparation((data: PreparationData) => {
      console.log("[room] Preparation data received!", data);
      setPrepSeatDraws(data.seatDraws.map(d => ({ playerId: d.playerId, username: d.username, card: d.card })));
      setPrepDealerDraws(data.dealerDraws.map(d => ({ playerId: d.playerId, username: d.username, card: d.card })));
      setShowPreparation(true);
    });

    setOnError((error: string) => {
      Alert.alert("Fehler", error);
    });

    return () => {
      setOnPreparation(null);
      setOnError(null);
    };
  }, [setOnPreparation, setOnError]);

  // Join room when connected
  useEffect(() => {
    if (!user || !profile || !code) return;
    if (isConnected && isJoining) {
      joinRoom(code, user.id, profile.username);
      setIsJoining(false);
    }
  }, [isConnected, user, profile, code, isJoining]);

  // Auto-add bots after joining room
  useEffect(() => {
    if (!gameState || !user || botsAdded) return;
    if (gameState.hostUserId !== user.id) return;

    const requestedBots = parseInt(botCountParam || "0", 10);
    if (requestedBots <= 0) return;

    const currentBots = gameState.players.filter(p => p.userId < 0).length;
    if (currentBots >= requestedBots) {
      setBotsAdded(true);
      return;
    }

    const botsToAdd = requestedBots - currentBots;
    if (botsToAdd > 0) {
      addBot(gameState.roomId, user.id);
    }
  }, [gameState, user, botsAdded, botCountParam]);

  // Mark bots as fully added
  useEffect(() => {
    if (!gameState || botsAdded) return;
    const requestedBots = parseInt(botCountParam || "0", 10);
    const currentBots = gameState.players.filter(p => p.userId < 0).length;
    if (currentBots >= requestedBots && requestedBots > 0) {
      setBotsAdded(true);
    }
  }, [gameState?.players.length]);

  const handleLeaveRoom = () => {
    if (gameState && user) {
      const player = gameState.players.find((p) => p.userId === user.id);
      if (player) {
        leaveRoom(gameState.roomId, player.id);
      }
    }
    router.push("/" as any);
  };

  const handleStartGame = () => {
    if (!gameState || !user) return;
    const player = gameState.players.find((p) => p.userId === user.id);
    if (!player) return;
    sendAction(gameState.roomId, player.id, { type: "START_GAME" });
  };

  const handleAddBot = () => {
    if (!gameState || !user) return;
    addBot(gameState.roomId, user.id);
  };

  const deleteRoomMutation = trpc.rooms.delete.useMutation({
    onSuccess: () => {
      Alert.alert("Erfolg", "Raum wurde gelöscht");
      router.push("/" as any);
    },
    onError: (error) => {
      Alert.alert("Fehler", error.message);
    },
  });

  const handleDeleteRoom = () => {
    if (!gameState) return;
    deleteRoomMutation.mutate({ roomId: gameState.roomId });
  };

  // Handle preparation completion
  const handlePreparationComplete = useCallback(() => {
    setShowPreparation(false);
    setPreparationDone(true);
    if (gameState?.roomId) {
      sendPreparationDone(gameState.roomId);
    }
  }, [gameState?.roomId, sendPreparationDone]);

  // Navigate to game when it starts AND preparation is done
  useEffect(() => {
    if (gameState && gameState.phase === "playing") {
      if (showPreparation) return;
      router.replace(`/game/play?code=${code}` as any);
    }
  }, [gameState?.phase, showPreparation, preparationDone]);

  const isHost = gameState && user && gameState.hostUserId === user.id;
  const canStart = gameState && gameState.players.length >= 2;

  // Show preparation screen
  if (showPreparation && gameState) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <GamePreparationScreen
          players={gameState.players}
          serverSeatDraws={prepSeatDraws}
          serverDealerDraws={prepDealerDraws}
          onComplete={handlePreparationComplete}
        />
      </ScreenContainer>
    );
  }

  if (!isConnected || !gameState) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#228B22" />
          <Text className="text-foreground text-lg mt-4">
            {!isConnected ? "Verbinde mit Server..." : "Trete Spielraum bei..."}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground">Warteraum</Text>
          <View className="flex-row items-center gap-2 mt-2">
            <Text className="text-muted">Raum-Code:</Text>
            <Text className="text-primary text-xl font-bold">{gameState.roomCode}</Text>
          </View>
        </View>

        {/* Player List */}
        <View className="bg-surface rounded-2xl p-6 border border-border mb-6">
          <Text className="text-foreground text-lg font-semibold mb-4">
            Spieler ({gameState.players.length})
          </Text>
          <View className="gap-3">
            {gameState.players.map((player) => (
              <View
                key={player.id}
                className="flex-row items-center p-3 bg-background rounded-xl"
              >
                <View className="w-10 h-10 rounded-full bg-primary items-center justify-center mr-3">
                  <Text className="text-background text-lg font-bold">
                    {player.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-foreground font-semibold">
                    {player.username}
                  </Text>
                  {player.userId === gameState.hostUserId && (
                    <Text className="text-warning text-sm">Host</Text>
                  )}
                </View>
                {player.isReady && (
                  <View className="bg-success px-3 py-1 rounded-full">
                    <Text className="text-background text-xs font-semibold">Bereit</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Info Box */}
        <View className="bg-surface rounded-2xl p-4 border border-border mb-6">
          <Text className="text-muted text-center">
            {canStart
              ? isHost
                ? "Du kannst das Spiel starten"
                : "Warte auf den Host, um das Spiel zu starten"
              : "Mindestens 2 Spieler benötigt"}
          </Text>
        </View>

        {/* Actions */}
        <View className="gap-3">
          {isHost && (
            <>
              <Pressable
                onPress={handleStartGame}
                disabled={!canStart}
                style={({ pressed }) => [{
                  backgroundColor: '#228B22',
                  paddingHorizontal: 32,
                  paddingVertical: 20,
                  borderRadius: 16,
                  opacity: !canStart ? 0.5 : pressed ? 0.8 : 1,
                }]}
              >
                <Text className="text-background text-xl font-bold text-center">
                  Spiel starten
                </Text>
              </Pressable>

              <Pressable
                onPress={handleAddBot}
                disabled={gameState && gameState.players.length >= (gameState as any).maxPlayers}
                style={({ pressed }) => [{
                  backgroundColor: '#0a7ea4',
                  paddingHorizontal: 32,
                  paddingVertical: 16,
                  borderRadius: 16,
                  opacity: (gameState && gameState.players.length >= (gameState as any).maxPlayers) ? 0.5 : pressed ? 0.8 : 1,
                }]}
              >
                <Text className="text-background text-lg font-semibold text-center">
                  🤖 KI hinzufügen
                </Text>
              </Pressable>
            </>
          )}

          <Pressable
            onPress={handleLeaveRoom}
            style={({ pressed }) => [{
              backgroundColor: '#1e2022',
              borderWidth: 1,
              borderColor: '#334155',
              paddingHorizontal: 32,
              paddingVertical: 16,
              borderRadius: 16,
              opacity: pressed ? 0.8 : 1,
            }]}
          >
            <Text className="text-foreground text-lg font-semibold text-center">
              Raum verlassen
            </Text>
          </Pressable>

          {isHost && (
            <Pressable
              onPress={handleDeleteRoom}
              disabled={deleteRoomMutation.isPending}
              style={({ pressed }) => [{
                backgroundColor: '#EF4444',
                paddingHorizontal: 32,
                paddingVertical: 16,
                borderRadius: 16,
                opacity: deleteRoomMutation.isPending ? 0.5 : pressed ? 0.8 : 1,
              }]}
            >
              <Text className="text-background text-lg font-semibold text-center">
                {deleteRoomMutation.isPending ? "Wird gelöscht..." : "Raum löschen"}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
