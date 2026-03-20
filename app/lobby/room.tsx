import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, Alert } from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-provider";
import { useSocket, type PreparationData } from "@/lib/socket-provider";
import { getApiBaseUrl } from "@/constants/oauth";
import { GamePreparationScreen, type PreparationDrawData } from "@/components/game/game-preparation-screen";
import { getBotProfileByName } from "@/lib/bot-profiles";
import { trpc } from "@/lib/trpc";

export default function RoomScreen() {
  const router = useRouter();
  const { code, botCount: botCountParam } = useLocalSearchParams<{ code: string; botCount?: string }>();
  const { user } = useAuth();
  const { data: profile } = trpc.profile.me.useQuery(undefined, { enabled: !!user });

  const [isJoining, setIsJoining] = useState(true);
  const [botsAdded, setBotsAdded] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [joinAttempt, setJoinAttempt] = useState(0);
  const normalizedCode = useMemo(() => (code || "").toUpperCase(), [code]);
  const joinUsername = useMemo(() => {
    const preferred = (profile?.username || "").trim();
    if (preferred.length >= 3) return preferred;
    const fallbackName = (user?.name || "").trim();
    if (fallbackName.length >= 3) return fallbackName;
    if (user?.id) return `Spieler${user.id}`;
    return "Spieler";
  }, [profile?.username, user?.name, user?.id]);

  // Preparation state
  const [showPreparation, setShowPreparation] = useState(false);
  const [prepSeatDraws, setPrepSeatDraws] = useState<PreparationDrawData[]>([]);
  const [prepDealerDraws, setPrepDealerDraws] = useState<PreparationDrawData[]>([]);
  const [prepPhase, setPrepPhase] = useState<"seat_selection" | "dealer_selection">("seat_selection");
  const [prepSeatOrder, setPrepSeatOrder] = useState<number[]>([]);
  const [prepSeatChoices, setPrepSeatChoices] = useState<Array<{ userId: number; seatPosition: number }>>([]);
  const [prepCurrentPicker, setPrepCurrentPicker] = useState<number | null>(null);

  const {
    isConnected,
    gameState,
    joinRoom,
    recoverSession,
    leaveRoom,
    sendAction,
    addBot,
    chooseSeat,
    sendPreparationDone,
    setOnPreparation,
    setOnRoomJoined,
    setOnError,
  } = useSocket();
  const backendUrl = useMemo(() => {
    try {
      return getApiBaseUrl();
    } catch {
      return "(nicht konfiguriert)";
    }
  }, []);
  const roomStateMatchesCode = Boolean(gameState && gameState.roomCode.toUpperCase() === normalizedCode);
  const activeGameState = roomStateMatchesCode ? gameState : null;

  // Registriere Callbacks
  useEffect(() => {
    setOnRoomJoined((data) => {
      if (isJoining && data.roomCode.toUpperCase() === normalizedCode) {
        // If room-joined arrives before/without a state packet, force recovery.
        void recoverSession();
        setTimeout(() => void recoverSession(), 700);
      }
    });

    setOnPreparation((data: PreparationData) => {
      console.log("[room] Preparation data received!", data);
      setPrepSeatDraws(data.seatDraws.map(d => ({ playerId: d.playerId, username: d.username, card: d.card })));
      setPrepDealerDraws(data.dealerDraws.map(d => ({ playerId: d.playerId, username: d.username, card: d.card })));
      setPrepPhase(data.phase ?? "seat_selection");
      setPrepSeatOrder(data.seatPickOrderUserIds ?? []);
      setPrepSeatChoices(data.seatChoices ?? []);
      setPrepCurrentPicker(data.currentPickerUserId ?? null);
      setShowPreparation(true);
    });

    setOnError((error: string) => {
      setIsStartingGame(false);
      Alert.alert("Fehler", error);
      if (isJoining && /Room not found|Invalid room code|User already in another active room|Game session unavailable|Room is full|Game already in progress|Too many join attempts|Failed to join|Socket-Verbindung blockiert|Server nicht erreichbar|Socket-Verbindung fehlgeschlagen/i.test(error)) {
        setIsJoining(false);
        router.replace("/lobby/join" as any);
      }
    });

    return () => {
      setOnRoomJoined(null);
      setOnPreparation(null);
      setOnError(null);
    };
  }, [isJoining, normalizedCode, recoverSession, router, setOnPreparation, setOnRoomJoined, setOnError]);

  // Join room when connected
  useEffect(() => {
    if (!user || !code) return;
    if (isConnected && isJoining) {
      joinRoom(normalizedCode, user.id, joinUsername);
      setJoinAttempt((prev) => prev + 1);
    }
  }, [isConnected, user, code, isJoining, joinRoom, joinUsername, normalizedCode]);

  useEffect(() => {
    if (!isConnected || !isJoining || activeGameState || !user || !code) return;
    const timeout = setTimeout(() => {
      if (joinAttempt >= 6) {
        setIsJoining(false);
        Alert.alert("Verbindung fehlgeschlagen", "Konnte dem Raum nicht beitreten. Bitte erneut versuchen.");
        router.replace("/lobby/join" as any);
        return;
      }
      joinRoom(normalizedCode, user.id, joinUsername);
      setJoinAttempt((prev) => prev + 1);
    }, 3500);
    return () => clearTimeout(timeout);
  }, [isConnected, isJoining, activeGameState, joinAttempt, user, code, joinRoom, joinUsername, router, normalizedCode]);

  // Auto-add bots after joining room
  useEffect(() => {
    if (!activeGameState || !user || botsAdded) return;
    if (activeGameState.hostUserId !== user.id) return;
    if (activeGameState.phase !== "waiting") return;

    const requestedBots = parseInt(botCountParam || "0", 10);
    if (requestedBots <= 0) return;

    const currentBots = activeGameState.players.filter((p) => p.userId < 0).length;
    if (currentBots >= requestedBots) {
      setBotsAdded(true);
      return;
    }

    const botsToAdd = requestedBots - currentBots;
    if (botsToAdd > 0) {
      addBot(activeGameState.roomId, user.id);
    }
  }, [activeGameState, user, botsAdded, botCountParam, addBot]);

  // Mark bots as fully added
  useEffect(() => {
    if (!activeGameState || botsAdded) return;
    const requestedBots = parseInt(botCountParam || "0", 10);
    const currentBots = activeGameState.players.filter((p) => p.userId < 0).length;
    if (currentBots >= requestedBots && requestedBots > 0) {
      setBotsAdded(true);
    }
    if (activeGameState.phase !== "waiting") {
      setBotsAdded(true);
    }
  }, [activeGameState, botsAdded, botCountParam]);

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
    if (!gameState || !user || isStartingGame) return;
    const player = gameState.players.find((p) => p.userId === user.id);
    if (!player) return;
    setIsStartingGame(true);
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
    if (gameState?.roomId) {
      sendPreparationDone(gameState.roomId);
    }
  }, [gameState?.roomId, sendPreparationDone]);

  // Navigate to game when it starts AND preparation is done
  useEffect(() => {
    if (gameState && gameState.roomCode.toUpperCase() === normalizedCode) {
      setIsJoining(false);
    }
  }, [gameState, normalizedCode]);

  // Navigate to game when it starts AND preparation is done
  useEffect(() => {
    if (gameState && gameState.phase === "playing" && !showPreparation) {
      setIsStartingGame(false);
      setShowPreparation(false);
      router.replace(`/game/play?code=${code}` as any);
    }
  }, [gameState?.phase, code, router, showPreparation]);

  const isHost = activeGameState && user && activeGameState.hostUserId === user.id;
  const canStart = activeGameState && activeGameState.players.length >= 2;
  const roomMaxPlayers = activeGameState?.maxPlayers ?? 5;
  const myPreparationUserId = user?.id ?? activeGameState?.players.find((p) => profile?.username && p.username === profile.username)?.userId;

  // Show preparation screen
  if (showPreparation && activeGameState) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <GamePreparationScreen
          players={activeGameState.players}
          serverSeatDraws={prepSeatDraws}
          serverDealerDraws={prepDealerDraws}
          preparationPhase={prepPhase}
          seatPickOrderUserIds={prepSeatOrder}
          seatChoices={prepSeatChoices}
          currentPickerUserId={prepCurrentPicker}
          myUserId={myPreparationUserId}
          myUsername={profile?.username}
          onChooseSeat={(seatPosition, pickerUserId) => {
            if (!activeGameState?.roomId) return;
            chooseSeat(activeGameState.roomId, seatPosition, pickerUserId ?? myPreparationUserId);
          }}
          onComplete={handlePreparationComplete}
        />
      </ScreenContainer>
    );
  }

  if (!isConnected || !activeGameState) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#228B22" />
          <Text className="text-foreground text-lg mt-4">
            {!isConnected ? "Verbinde mit Server..." : "Trete Spielraum bei..."}
          </Text>
          <Text className="text-muted text-xs mt-2 text-center">
            Backend: {backendUrl}
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
            <Text className="text-primary text-xl font-bold">{activeGameState.roomCode}</Text>
          </View>
        </View>

        {/* Player List */}
        <View className="bg-surface rounded-2xl p-6 border border-border mb-6">
          <Text className="text-foreground text-lg font-semibold mb-4">
            Spieler ({activeGameState.players.length})
          </Text>
          <View className="gap-3">
            {activeGameState.players.map((player, index) => (
              <View
                key={`${player.id}-${player.userId}-${index}`}
                className="flex-row items-center p-3 bg-background rounded-xl"
              >
                {(() => {
                  const botImage = player.userId < 0 ? getBotProfileByName(player.username)?.imagePath : undefined;
                  const avatarSource = player.avatarUrl ? { uri: player.avatarUrl } : botImage;
                  if (avatarSource) {
                    return (
                      <Image
                        source={avatarSource}
                        style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12, borderWidth: 1, borderColor: "rgba(148, 163, 184, 0.7)" }}
                        contentFit="cover"
                      />
                    );
                  }
                  return (
                    <View className="w-10 h-10 rounded-full bg-primary items-center justify-center mr-3">
                      <Text className="text-background text-lg font-bold">
                        {player.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  );
                })()}
                <View className="flex-1">
                  <Text className="text-foreground font-semibold">
                    {player.username}
                  </Text>
                  {player.userId === activeGameState.hostUserId && (
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
                disabled={!canStart || isStartingGame}
                style={({ pressed }) => [{
                  backgroundColor: '#228B22',
                  paddingHorizontal: 32,
                  paddingVertical: 20,
                  borderRadius: 16,
                  opacity: (!canStart || isStartingGame) ? 0.5 : pressed ? 0.8 : 1,
                }]}
              >
                <Text className="text-background text-xl font-bold text-center">
                  {isStartingGame ? "Startet..." : "Spiel starten"}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleAddBot}
                disabled={Boolean(activeGameState && activeGameState.players.length >= roomMaxPlayers)}
                style={({ pressed }) => [{
                  backgroundColor: '#0a7ea4',
                  paddingHorizontal: 32,
                  paddingVertical: 16,
                  borderRadius: 16,
                  opacity: (activeGameState && activeGameState.players.length >= roomMaxPlayers) ? 0.5 : pressed ? 0.8 : 1,
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
