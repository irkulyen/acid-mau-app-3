import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Alert, Modal, Pressable, ImageBackground, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Touchable } from "@/components/ui/button";
import { useRouter, useLocalSearchParams } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { ScreenContainer } from "@/components/screen-container";
import { PlayingCard } from "@/components/game/playing-card";
import { AnimatedDiscardPile } from "@/components/game/animated-discard-pile";
import { BlackbirdAnimation } from "@/components/game/blackbird-animation";
import { ComboCounter } from "@/components/game/combo-counter";
import { EmoteSystem } from "@/components/game/emote-system";
import { DrawChainEscalation, DrawChainShakeWrapper } from "@/components/game/draw-chain-escalation";
import { CardFlyAnimation } from "@/components/game/card-fly-animation";
import { GamePreparationScreen } from "@/components/game/game-preparation-screen";
import { useAuth } from "@/lib/auth-provider";
import { useGameSounds } from "@/hooks/use-game-sounds";
import type { Card, CardSuit, GameState, Player } from "@/shared/game-types";
import { createGameState, startGame, processAction } from "@/shared/game-engine";
import { canPlayCard, getEffectiveTopCard } from "@/shared/game-rules";
import { performGamePreparation } from "@/shared/game-preparation";
import { AIPlayer } from "@/shared/ai-player";

/** Mini card backs for opponent hand display */
function MiniCardFan({ count, maxShow = 6 }: { count: number; maxShow?: number }) {
  const shown = Math.min(count, maxShow);
  return (
    <View style={{ flexDirection: "row", marginTop: 4 }}>
      {Array.from({ length: shown }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 18,
            height: 26,
            backgroundColor: "#1a3a5c",
            borderRadius: 4,
            borderWidth: 1,
            borderColor: "#2a5a8c",
            marginLeft: i === 0 ? 0 : -8,
            transform: [{ rotate: `${(i - (shown - 1) / 2) * 5}deg` }],
          }}
        >
          <View
            style={{
              flex: 1,
              margin: 2,
              borderRadius: 2,
              borderWidth: 0.5,
              borderColor: "#3a6a9c",
              backgroundColor: "#1e4a7a",
            }}
          />
        </View>
      ))}
      {count > maxShow && (
        <Text style={{ color: "#9BA1A6", fontSize: 10, marginLeft: 4, alignSelf: "center" }}>
          +{count - maxShow}
        </Text>
      )}
    </View>
  );
}

export default function PracticeGameScreen() {
  const router = useRouter();
  const { players: playersParam } = useLocalSearchParams<{ players?: string }>();
  const playerCount = playersParam ? parseInt(playersParam) : 4;
  const { user } = useAuth();
  const [roomId] = useState(1);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showSuitPicker, setShowSuitPicker] = useState(false);
  const [pendingUnterCard, setPendingUnterCard] = useState<Card | null>(null);
  const [showBlackbird, setShowBlackbird] = useState(false);
  const [blackbirdLoser, setBlackbirdLoser] = useState<string | undefined>(undefined);
  const [blackbirdWinner, setBlackbirdWinner] = useState<string | undefined>(undefined);
  const [blackbirdEvent, setBlackbirdEvent] = useState<"round_start" | "winner" | "loser" | "draw_chain" | "ass" | "unter" | undefined>(undefined);
  const [blackbirdDrawChain, setBlackbirdDrawChain] = useState<number | undefined>(undefined);
  const [blackbirdWishSuit, setBlackbirdWishSuit] = useState<string | undefined>(undefined);
  const [aiPlayers] = useState<AIPlayer[]>(
    Array.from({ length: playerCount - 1 }, () => new AIPlayer("easy"))
  );
  const { playCardPlay, playCardDraw, playRoundEnd, playBlackbird } = useGameSounds();
  const [comboCount, setComboCount] = useState(0);
  const [comboPlayer, setComboPlayer] = useState("");
  const [lastPlayerId, setLastPlayerId] = useState<number | null>(null);
  const [flyingCard, setFlyingCard] = useState<Card | null>(null);
  const [showFlyingCard, setShowFlyingCard] = useState(false);
  const [showPreparation, setShowPreparation] = useState(true);
  const [prepPlayers, setPrepPlayers] = useState<Player[]>([]);
  const insets = useSafeAreaInsets();
  // Tab bar height: 56px + bottom inset (min 8px)
  const tabBarHeight = 56 + Math.max(insets.bottom, 8);

  // Pulsing glow animation for active player
  const glowOpacity = useSharedValue(0.4);
  useEffect(() => {
    glowOpacity.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // Initialize game – first show preparation screen
  useEffect(() => {
    if (!user) return;

    const playerDefs: Omit<Player, "id" | "hand" | "lossPoints" | "isEliminated" | "isReady">[] = [
      { userId: user.id, username: user.name || "Du" },
      ...Array.from({ length: playerCount - 1 }, (_, i) => ({
        userId: -(i + 1),
        username: ["Alf", "Gizmo", "Yoda", "Pumuckl", "Gollum"][i % 5],
      })),
    ];

    const initialPlayers: Player[] = playerDefs.map((p, index) => ({
      ...p,
      id: index + 1,
      hand: [],
      lossPoints: 0,
      isEliminated: false,
      isReady: true,
    }));

    setPrepPlayers(initialPlayers);
    setShowPreparation(true);
  }, [user]);

  const handlePreparationComplete = useCallback((sorted: Player[], dealerIdx: number) => {
    if (!user) return;
    const initialState = createGameState(roomId, "PRACTICE", sorted, user.id);
    initialState.dealerIndex = dealerIdx;
    const startedState = startGame(initialState);
    setGameState(startedState);
    setShowPreparation(false);
  }, [user, roomId]);

  // AI turn logic – uses functional updates to avoid stale closure
  useEffect(() => {
    if (!gameState || gameState.phase !== "playing") return;

    const currentTurnPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentTurnPlayer || currentTurnPlayer.userId === user?.id) return;

    const aiIndex = currentTurnPlayer.userId * -1 - 1;
    const ai = aiPlayers[aiIndex];
    if (!ai) return;

    // Snapshot values for the closure
    const snapshotState = gameState;
    const snapshotPlayerId = currentTurnPlayer.id;

    const timeout = setTimeout(() => {
      const action = ai.decideAction(snapshotState, snapshotPlayerId);

      try {
        const newState = processAction(snapshotState, action, snapshotPlayerId);
        // Combo reset when AI plays (combo is player-only)
        if (action.type === "PLAY_CARD") {
          setComboCount(0);
          setLastPlayerId(snapshotPlayerId);

          // AI Event-Trigger: Ass
          if (action.cardId) {
            const playedCard = snapshotState.players.find(p => p.id === snapshotPlayerId)?.hand.find(c => c.id === action.cardId);
            if (playedCard?.rank === "ass") {
              setBlackbirdEvent("ass");
              setBlackbirdLoser(undefined);
              setBlackbirdWinner(undefined);
              setShowBlackbird(true);
            }
            // AI Event-Trigger: 7er-Kette ab 4+
            if (playedCard?.rank === "7" && newState.drawChainCount >= 4) {
              setBlackbirdEvent("draw_chain");
              setBlackbirdDrawChain(newState.drawChainCount * 2);
              setBlackbirdLoser(undefined);
              setBlackbirdWinner(undefined);
              setShowBlackbird(true);
            }
            // AI Event-Trigger: Unter
            if (playedCard?.rank === "bube" && action.wishSuit) {
              setBlackbirdEvent("unter");
              setBlackbirdWishSuit(action.wishSuit);
              setBlackbirdLoser(undefined);
              setBlackbirdWinner(undefined);
              setShowBlackbird(true);
            }
          }
        }
        // Letzte Karte durch AI gelegt?
        const aiUpdated = newState.players.find((p) => p.id === snapshotPlayerId);
        if (aiUpdated && aiUpdated.hand.length === 0 && newState.phase !== "round_end") {
          setBlackbirdWinner(aiUpdated.username);
          setBlackbirdLoser(undefined);
          setBlackbirdEvent("winner");
          setShowBlackbird(true);
          if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setGameState(newState);
      } catch (error: any) {
        console.error("AI action error:", error);
        try {
          const drawState = processAction(snapshotState, { type: "DRAW_CARD" }, snapshotPlayerId);
          setGameState(drawState);
        } catch (e) {
          console.error("AI fallback draw error:", e);
        }
      }
    }, 1800 + Math.random() * 1200);

    return () => clearTimeout(timeout);
  }, [gameState?.currentPlayerIndex, gameState?.phase, gameState?.roundNumber]);

  const handlePlayCard = (card: Card) => {
    if (!gameState || !user) return;

    const myPlayer = gameState.players.find((p) => p.userId === user.id);
    if (!myPlayer) return;

    const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === myPlayer.id;
    if (!isMyTurn) return;

    if (card.rank === "bube") {
      setPendingUnterCard(card);
      setShowSuitPicker(true);
      return;
    }

    try {
      const newState = processAction(gameState, {
        type: "PLAY_CARD",
        cardId: card.id,
      }, myPlayer.id);
      // Fluganimation starten
      setFlyingCard(card);
      setShowFlyingCard(true);
      playCardPlay();
      // Combo tracking
      if (lastPlayerId === myPlayer.id) {
        const newCombo = comboCount + 1;
        setComboCount(newCombo);
        setComboPlayer(myPlayer.username);
      } else {
        setComboCount(1);
        setComboPlayer(myPlayer.username);
      }
      setLastPlayerId(myPlayer.id);
      // Event-Trigger: Ass gespielt
      if (card.rank === "ass" && !showBlackbird) {
        setBlackbirdEvent("ass");
        setBlackbirdLoser(undefined);
        setBlackbirdWinner(undefined);
        setShowBlackbird(true);
      }
      // Event-Trigger: 7er-Kette ab 4+
      if (card.rank === "7" && newState.drawChainCount >= 4 && !showBlackbird) {
        setBlackbirdEvent("draw_chain");
        setBlackbirdDrawChain(newState.drawChainCount * 2);
        setBlackbirdLoser(undefined);
        setBlackbirdWinner(undefined);
        setShowBlackbird(true);
      }
      // Letzte Karte gelegt?
      const updatedPlayer = newState.players.find((p) => p.id === myPlayer.id);
      if (updatedPlayer && updatedPlayer.hand.length === 0 && newState.phase !== "round_end") {
        setBlackbirdWinner(myPlayer.username);
        setBlackbirdLoser(undefined);
        setBlackbirdEvent("winner");
        setShowBlackbird(true);
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setGameState(newState);
    } catch (error: any) {
      Alert.alert("Fehler", error.message);
    }
  };

  const handleSuitChoice = (suit: CardSuit) => {
    if (!gameState || !user || !pendingUnterCard) return;

    const myPlayer = gameState.players.find((p) => p.userId === user.id);
    if (!myPlayer) return;

    try {
      const newState = processAction(gameState, {
        type: "PLAY_CARD",
        cardId: pendingUnterCard.id,
        wishSuit: suit,
      }, myPlayer.id);
      // Fluganimation für Unter
      setFlyingCard(pendingUnterCard);
      setShowFlyingCard(true);
      playCardPlay();
      setShowSuitPicker(false);
      setPendingUnterCard(null);
      // Event-Trigger: Unter gespielt
      if (!showBlackbird) {
        setBlackbirdEvent("unter");
        setBlackbirdWishSuit(suit);
        setBlackbirdLoser(undefined);
        setBlackbirdWinner(undefined);
        setShowBlackbird(true);
      }
      setGameState(newState);
    } catch (error: any) {
      setShowSuitPicker(false);
      setPendingUnterCard(null);
      Alert.alert("Fehler", error.message);
    }
  };

  const handleDrawCard = () => {
    if (!gameState || !user) return;

    const myPlayer = gameState.players.find((p) => p.userId === user.id);
    if (!myPlayer) return;

    const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === myPlayer.id;
    if (!isMyTurn) return;

    try {
      const newState = processAction(gameState, {
        type: "DRAW_CARD",
      }, myPlayer.id);
      playCardDraw();
      setGameState(newState);
    } catch (error: any) {
      Alert.alert("Fehler", error.message);
    }
  };

  // Handle round end (automatic restart for practice mode)
  useEffect(() => {
    if (gameState && gameState.phase === "round_end") {
      playRoundEnd();
      // Verlierer = Spieler mit den meisten Karten auf der Hand
      const loser = gameState.players
        .filter((p) => !p.isEliminated)
        .reduce((a, b) => (a.hand.length >= b.hand.length ? a : b), gameState.players[0]);
      setBlackbirdLoser(loser?.username);
      setBlackbirdEvent("loser");
      // Amsel fliegt JETZT (während round_end), NEXT_ROUND wird in onDone ausgelöst
      setShowBlackbird(true);
    }
  }, [gameState?.phase]);

  // Handle game end
  useEffect(() => {
    if (gameState && gameState.phase === "game_end") {
      const winner = gameState.players.find((p) => !p.isEliminated);
      Alert.alert(
        "Spiel beendet!",
        winner ? `${winner.username} hat gewonnen!` : "Spiel beendet",
        [{ text: "OK", onPress: () => router.replace("/") }]
      );
    }
  }, [gameState?.phase]);

  if (showPreparation && prepPlayers.length > 0 && user) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <GamePreparationScreen
          players={prepPlayers}
          onComplete={handlePreparationComplete}
        />
      </ScreenContainer>
    );
  }

  if (!gameState || !user) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <Text className="text-foreground text-lg">Lade Übungsspiel...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const currentPlayer = gameState.players.find((p) => p.userId === user.id);
  if (!currentPlayer) return null;

  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === currentPlayer.id;
  const topCard = gameState.discardPile.length > 0 ? getEffectiveTopCard(gameState.discardPile) : undefined;
  const displayCard = gameState.discardPile[gameState.discardPile.length - 1];
  const currentTurnPlayer = gameState.players[gameState.currentPlayerIndex];
  const opponents = gameState.players
    .filter((p) => p.id !== currentPlayer.id)
    .filter((p) => !p.isEliminated);

  return (
    <ImageBackground
      source={require('@/assets/images/table-felt.png')}
      className="flex-1"
      resizeMode="repeat"
      imageStyle={{ opacity: 1 }}
    >
      {/* Dark overlay */}
      <View
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.3)",
        }}
      />
      {/* Center glow */}
      <View
        style={{
          position: "absolute",
          width: "70%",
          height: "70%",
          alignSelf: "center",
          top: "15%",
          backgroundColor: "rgba(0, 255, 0, 0.04)",
          borderRadius: 9999,
          shadowColor: "#00ff00",
          shadowOpacity: 0.2,
          shadowRadius: 80,
        }}
      />

      {/* Watermark logo */}
      <View className="absolute inset-0 items-center justify-center" style={{ opacity: 0.06 }}>
        <Image
          source={require("@/assets/images/game-logo.png")}
          style={{ width: 300, height: 300 }}
          resizeMode="contain"
        />
      </View>

      <ScreenContainer className="p-3" containerClassName="bg-transparent">
      <DrawChainShakeWrapper drawChainCount={gameState.drawChainCount}>
      <View className="flex-1">
        {/* Header with Back Button + Game Info - compact */}
        <View
          className="rounded-xl px-4 py-3 mb-2 border border-border"
          style={{ backgroundColor: "rgba(30, 32, 34, 0.85)" }}
        >
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => router.push("/" as any)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ color: "#32CD32", fontSize: 14 }}>{"\u2190"}</Text>
              </Pressable>
              {isMyTurn && (
                <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#32CD32" }, pulseStyle]} />
              )}
              <Text style={{ color: "#9BA1A6", fontSize: 12 }}>Am Zug:</Text>
              <Text style={{ color: isMyTurn ? "#32CD32" : "#E8E8E8", fontWeight: "700", fontSize: 13 }}>
                {isMyTurn ? "DU" : currentTurnPlayer?.username}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <Text style={{ color: "#E8E8E8", fontSize: 16 }}>
                {gameState.direction === "clockwise" ? "\u21BB" : "\u21BA"}
              </Text>
              <Text style={{ color: "#9BA1A6", fontSize: 12 }}>Runde {gameState.roundNumber}</Text>
            </View>
          </View>

          {gameState.drawChainCount > 0 && (
            <View className="mt-2 bg-error rounded-lg p-2 border-2 border-warning">
              <View className="flex-row items-center justify-center gap-2">
                <Text style={{ fontSize: 20 }}>⚠️</Text>
                <View>
                  <Text style={{ color: "#0D0D0D", textAlign: "center", fontWeight: "700", fontSize: 13 }}>
                    ZIEHKETTE
                  </Text>
                  <Text style={{ color: "#F59E0B", textAlign: "center", fontWeight: "800", fontSize: 16 }}>
                    +{gameState.drawChainCount} KARTEN
                  </Text>
                </View>
                <Text style={{ fontSize: 20 }}>⚠️</Text>
              </View>
            </View>
          )}

          {gameState.currentWishSuit && (
            <View
              className="mt-2 rounded-lg p-2 border-2"
              style={{
                backgroundColor:
                  gameState.currentWishSuit === "eichel"
                    ? "rgba(139, 69, 19, 0.3)"
                    : gameState.currentWishSuit === "gruen"
                    ? "rgba(34, 139, 34, 0.3)"
                    : gameState.currentWishSuit === "rot"
                    ? "rgba(220, 20, 60, 0.3)"
                    : "rgba(218, 165, 32, 0.3)",
                borderColor: "#fff",
              }}
            >
              <View className="flex-row items-center justify-center gap-2">
                <Text style={{ fontSize: 24 }}>
                  {gameState.currentWishSuit === "eichel" ? "🌰" : gameState.currentWishSuit === "gruen" ? "🍀" : gameState.currentWishSuit === "rot" ? "❤️" : "🔔"}
                </Text>
                <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800", fontSize: 14 }}>
                  WUNSCHFARBE
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Opponents - compact wrap grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
            {opponents.map((player) => {
              const isActive = gameState.players[gameState.currentPlayerIndex]?.id === player.id;
              // Calculate width: for <=3 opponents use flex:1, for more use ~30% width
              const chipWidth = opponents.length <= 3 ? undefined : "30%";
              return (
                <View
                  key={player.id}
                  style={{
                    backgroundColor: isActive ? "rgba(50, 205, 50, 0.12)" : "rgba(30, 32, 34, 0.8)",
                    borderRadius: 10,
                    paddingHorizontal: 6,
                    paddingVertical: 4,
                    borderWidth: isActive ? 1.5 : 1,
                    borderColor: isActive ? "#32CD32" : "rgba(51, 65, 85, 0.6)",
                    ...(chipWidth ? { width: chipWidth } : { flex: 1 }),
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {isActive && (
                    <Animated.View
                      style={[
                        {
                          position: "absolute",
                          top: -1,
                          left: -1,
                          right: -1,
                          bottom: -1,
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: "#32CD32",
                        },
                        pulseStyle,
                      ]}
                    />
                  )}
                  {isActive && <Text style={{ fontSize: 8 }}>▶️</Text>}
                  <Text
                    style={{
                      color: isActive ? "#32CD32" : "#E8E8E8",
                      fontWeight: "700",
                      fontSize: 11,
                      flexShrink: 1,
                    }}
                    numberOfLines={1}
                  >
                    {player.username}
                  </Text>
                  <MiniCardFan count={player.hand.length} maxShow={4} />
                  {player.lossPoints > 0 && (
                    <Text style={{ color: "#FF6B6B", fontSize: 9 }}>
                      {player.lossPoints}
                    </Text>
                  )}
                </View>
              );
            })}
        </View>

        {/* Game Table - centered draw + discard */}
        <View className="flex-1 items-center justify-center mb-2">
          {/* Center glow */}
          <View
            style={{
              position: "absolute",
              width: 260,
              height: 260,
              backgroundColor: "rgba(0, 255, 0, 0.06)",
              borderRadius: 9999,
              shadowColor: "#00ff00",
              shadowOpacity: 0.3,
              shadowRadius: 60,
              elevation: 5,
            }}
          />
          <View className="flex-row gap-8 items-center" style={{ zIndex: 10 }}>
            {/* Draw Pile */}
            <View className="items-center">
              <Touchable
                onPress={handleDrawCard}
                disabled={!isMyTurn}
              >
                <PlayingCard card={{ suit: "eichel", rank: "7", id: "back" }} faceDown size="large" />
              </Touchable>
              {isMyTurn && (
                <Text style={{ color: "#32CD32", fontSize: 10, fontWeight: "600", marginTop: 4 }}>
                  Ziehen
                </Text>
              )}
            </View>

            {/* Discard Pile */}
            <View className="items-center">
              <View
                style={{
                  shadowColor: topCard?.rank === "7" && gameState.drawChainCount > 0
                    ? "#FFA500"
                    : "transparent",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: topCard?.rank === "7" && gameState.drawChainCount > 0
                    ? Math.min(0.5 + (gameState.drawChainCount * 0.2), 1.0)
                    : 0,
                  shadowRadius: topCard?.rank === "7" && gameState.drawChainCount > 0
                    ? 30 + (gameState.drawChainCount * 10)
                    : 0,
                }}
              >
                <AnimatedDiscardPile card={displayCard} size="large" />
              </View>
              <Text style={{ color: "#9BA1A6", fontSize: 10, marginTop: 4 }}>Ablagestapel</Text>
              
              {displayCard && displayCard.suit === "schellen" && displayCard.rank === "8" && topCard && topCard.id !== displayCard.id && (
                <View style={{ marginTop: 4, backgroundColor: "rgba(50, 205, 50, 0.2)", borderWidth: 1, borderColor: "#32CD32", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: "#32CD32", fontSize: 10, fontWeight: "600" }}>
                    Spiele auf: {topCard.suit === "eichel" ? "🌰" : topCard.suit === "gruen" ? "🍀" : topCard.suit === "rot" ? "❤️" : "🔔"} {topCard.rank.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Player's Hand */}
        <View
          style={{
            backgroundColor: "rgba(20, 20, 20, 0.92)",
            borderColor: isMyTurn ? "#32CD32" : "rgba(51, 65, 85, 0.8)",
            borderWidth: isMyTurn ? 2 : 1,
            borderRadius: 18,
            padding: 12,
            paddingBottom: tabBarHeight + 8,
            shadowColor: isMyTurn ? "#32CD32" : "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: isMyTurn ? 0.5 : 0.3,
            shadowRadius: isMyTurn ? 16 : 8,
            elevation: isMyTurn ? 16 : 4,
          }}
        >
          <View className="flex-row justify-between items-center mb-2">
            <View className="flex-row items-center gap-2">
              {isMyTurn && (
                <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#32CD32" }, pulseStyle]} />
              )}
              <Text style={{ color: isMyTurn ? "#32CD32" : "#E8E8E8", fontWeight: "700", fontSize: 14 }}>
                {isMyTurn ? "DEIN ZUG" : "Deine Hand"}
              </Text>
            </View>
            <Text style={{ color: "#9BA1A6", fontSize: 12 }}>
              Verluste: {currentPlayer.lossPoints} / 7
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ minHeight: 116 }}>
            <View style={{ flexDirection: "row", gap: 4, alignItems: "flex-end", paddingBottom: 4 }}>
              {currentPlayer.hand.map((card) => {
                const isPlayable = topCard && canPlayCard(card, topCard, gameState.currentWishSuit, gameState.drawChainCount).isValid;
                return (
                  <View
                    key={card.id}
                    style={{
                      transform: [{ translateY: isMyTurn && isPlayable ? -10 : 0 }],
                      marginHorizontal: 1,
                    }}
                  >
                    {isMyTurn && isPlayable && (
                      <Animated.View
                        style={[
                          {
                            position: "absolute",
                            top: -2,
                            left: -2,
                            right: -2,
                            bottom: -2,
                            borderRadius: 14,
                            borderWidth: 2,
                            borderColor: "#32CD32",
                            zIndex: -1,
                          },
                          pulseStyle,
                        ]}
                      />
                    )}
                    <PlayingCard
                      card={card}
                      onPress={() => handlePlayCard(card)}
                      disabled={!isMyTurn || !isPlayable}
                      size="medium"
                    />
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Round End Modal */}
      <Modal
        visible={gameState.phase === "round_end"}
        transparent
        animationType="fade"
      >
        <View className="flex-1 bg-black/70 items-center justify-center p-6">
          <View style={{ borderRadius: 20, padding: 24, width: "100%", maxWidth: 380, backgroundColor: "rgba(20, 20, 20, 0.97)", borderWidth: 2, borderColor: "#4A4A4A" }}>
            <Text style={{ color: "#E8E8E8", fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 16 }}>
              🏁 Runde {gameState.roundNumber} beendet!
            </Text>

            <View style={{ backgroundColor: "rgba(0, 0, 0, 0.3)", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <Text style={{ color: "#9BA1A6", fontSize: 12, marginBottom: 8 }}>Verlustpunkte:</Text>
              {gameState.players.map((player) => (
                <View key={player.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 }}>
                  <Text style={{ color: player.isEliminated ? "#666" : "#E8E8E8", textDecorationLine: player.isEliminated ? "line-through" : "none" }}>
                    {player.username}
                  </Text>
                  <Text style={{ fontWeight: "700", color: player.isEliminated ? "#666" : "#FF6B6B" }}>
                    {player.isEliminated ? "❌ RAUS" : `${player.lossPoints} ❌`}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ backgroundColor: "rgba(255, 165, 0, 0.15)", borderWidth: 1, borderColor: "#FFA500", borderRadius: 14, padding: 14 }}>
              <Text style={{ color: "#E8E8E8", textAlign: "center", fontWeight: "600" }}>
                ⏳ Nächste Runde startet in 2 Sekunden...
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Suit Picker Modal */}
      <Modal
        visible={showSuitPicker}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSuitPicker(false);
          setPendingUnterCard(null);
        }}
      >
        <View className="flex-1 bg-black/60 items-center justify-center p-6" pointerEvents="box-none">
          <View style={{ borderRadius: 20, padding: 24, width: "100%", maxWidth: 320, backgroundColor: "rgba(20, 20, 20, 0.97)", borderWidth: 1, borderColor: "#334155" }}>
            <Text style={{ color: "#E8E8E8", fontSize: 20, fontWeight: "800", marginBottom: 16, textAlign: "center" }}>
              Wähle eine Farbe
            </Text>
            <View style={{ gap: 10 }}>
              {(["eichel", "gruen", "rot", "schellen"] as CardSuit[]).map((suit) => {
                const colors: Record<string, string> = {
                  eichel: "#8B4513",
                  gruen: "#228B22",
                  rot: "#DC143C",
                  schellen: "#DAA520",
                };
                const labels: Record<string, string> = {
                  eichel: "🌰 Eichel",
                  gruen: "🍀 Gras",
                  rot: "❤️ Herz",
                  schellen: "🔔 Schellen",
                };
                return (
                  <Pressable
                    key={suit}
                    onPress={() => handleSuitChoice(suit)}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? colors[suit] : "rgba(30, 32, 34, 0.8)",
                      borderWidth: 2,
                      borderColor: colors[suit],
                      borderRadius: 14,
                      padding: 14,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Text style={{ color: "#E8E8E8", fontSize: 18, fontWeight: "700", textAlign: "center" }}>
                      {labels[suit]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => {
                setShowSuitPicker(false);
                setPendingUnterCard(null);
              }}
              style={({ pressed }) => ({
                marginTop: 16,
                padding: 12,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ color: "#9BA1A6", textAlign: "center", fontSize: 14 }}>Abbrechen</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <ComboCounter comboCount={comboCount} playerName={comboPlayer} />
      <DrawChainEscalation drawChainCount={gameState.drawChainCount} />
      <EmoteSystem
        playerName={currentPlayer.username}
        botNames={opponents.filter((p) => p.userId < 0).map((p) => p.username)}
      />
      <BlackbirdAnimation
        visible={showBlackbird}
        loserName={blackbirdLoser}
        winnerName={blackbirdWinner}
        eventType={blackbirdEvent}
        drawChainCount={blackbirdDrawChain}
        wishSuit={blackbirdWishSuit}
        onDone={() => {
          setShowBlackbird(false);
          setBlackbirdLoser(undefined);
          setBlackbirdWinner(undefined);
          setBlackbirdEvent(undefined);
          setBlackbirdDrawChain(undefined);
          setBlackbirdWishSuit(undefined);
          // Nächste Runde starten nachdem Amsel fertig ist (nur bei round_end)
          setGameState((prev) => {
            if (!prev || prev.phase !== "round_end") return prev;
            try {
              return processAction(prev, { type: "NEXT_ROUND" }, prev.players[0].id);
            } catch (e) {
              console.error("Failed to start next round:", e);
              return prev;
            }
          });
        }}
        onStart={playBlackbird}
      />
      <CardFlyAnimation
        card={flyingCard}
        visible={showFlyingCard}
        onDone={() => {
          setShowFlyingCard(false);
          setFlyingCard(null);
        }}
      />
    </DrawChainShakeWrapper>
    </ScreenContainer>
    </ImageBackground>
  );
}
