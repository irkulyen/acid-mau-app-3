import { Touchable } from "@/components/ui/button";
import { useEffect, useState, useRef } from "react";
import { View, Text, ScrollView, Alert, Modal, ImageBackground, Pressable, TextInput, KeyboardAvoidingView, Platform, FlatList } from "react-native";
import { Image } from "expo-image";
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
import { GamePreparationScreen, type PreparationDrawData } from "@/components/game/game-preparation-screen";
import { useAuth } from "@/lib/auth-provider";
import { useSocket, type PreparationData, type BlackbirdEvent } from "@/lib/socket-provider";
import { useGameSounds } from "@/hooks/use-game-sounds";
import type { Card, CardSuit } from "@/shared/game-types";
import { canPlayCard, getEffectiveTopCard } from "@/shared/game-rules";

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

export default function GamePlayScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user } = useAuth();

  const [showSuitPicker, setShowSuitPicker] = useState(false);
  const [pendingUnterCard, setPendingUnterCard] = useState<Card | null>(null);
  const [assFlash, setAssFlash] = useState(false);
  const [showRoundStart, setShowRoundStart] = useState(false);
  const [showBlackbird, setShowBlackbird] = useState(false);
  const [blackbirdLoser, setBlackbirdLoser] = useState<string | undefined>(undefined);
  const [blackbirdWinner, setBlackbirdWinner] = useState<string | undefined>(undefined);
  const [blackbirdEvent, setBlackbirdEvent] = useState<"round_start" | "winner" | "loser" | "draw_chain" | "ass" | "unter" | undefined>(undefined);
  const [blackbirdDrawChain, setBlackbirdDrawChain] = useState<number | undefined>(undefined);
  const [blackbirdWishSuit, setBlackbirdWishSuit] = useState<string | undefined>(undefined);
  const { playCardPlay, playCardDraw, playRoundEnd, playBlackbird } = useGameSounds();
  const [comboCount, setComboCount] = useState(0);
  const [comboPlayer, setComboPlayer] = useState("");
  const [lastPlayerIndex, setLastPlayerIndex] = useState<number | null>(null);
  // Queue for server-sent blackbird events
  const blackbirdQueueRef = useRef<BlackbirdEvent[]>([]);
  const [prevDiscardLength, setPrevDiscardLength] = useState(0);
  const [flyingCard, setFlyingCard] = useState<Card | null>(null);
  const [showFlyingCard, setShowFlyingCard] = useState(false);
  const [showPreparation, setShowPreparation] = useState(false);
  const [prepSeatDraws, setPrepSeatDraws] = useState<PreparationDrawData[]>([]);
  const [prepDealerDraws, setPrepDealerDraws] = useState<PreparationDrawData[]>([]);

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

  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const chatListRef = useRef<FlatList>(null);

  // Process next blackbird event from queue
  const processNextBlackbird = () => {
    if (blackbirdQueueRef.current.length === 0) return;
    const event = blackbirdQueueRef.current.shift()!;
    setBlackbirdEvent(event.type);
    setBlackbirdLoser(event.type === "loser" ? event.playerName : undefined);
    setBlackbirdWinner(event.type === "winner" ? event.playerName : undefined);
    setBlackbirdDrawChain(event.drawChainCount);
    setBlackbirdWishSuit(event.wishSuit);
    setShowBlackbird(true);
    if (event.type === "loser") {
      playRoundEnd();
      setShowRoundStart(true);
      setTimeout(() => setShowRoundStart(false), 2000);
    }
  };

  const { isConnected, gameState, chatMessages, unreadCount, sendAction, sendChatMessage, markChatRead, markChatClosed, sendPreparationDone, setOnPreparation, setOnBlackbirdEvent, setOnError } = useSocket();

  useEffect(() => {
    setOnPreparation((data: PreparationData) => {
      setPrepSeatDraws(data.seatDraws.map(d => ({ playerId: d.playerId, username: d.username, card: d.card })));
      setPrepDealerDraws(data.dealerDraws.map(d => ({ playerId: d.playerId, username: d.username, card: d.card })));
      setShowPreparation(true);
    });
    setOnBlackbirdEvent((event: BlackbirdEvent) => {
      blackbirdQueueRef.current.push(event);
      if (!showBlackbird) {
        processNextBlackbird();
      }
    });
    setOnError((error: string) => {
      Alert.alert("Fehler", error);
    });
    return () => {
      setOnPreparation(null);
      setOnBlackbirdEvent(null);
      setOnError(null);
    };
  }, [setOnPreparation, setOnBlackbirdEvent, setOnError]);

  const handleOpenChat = () => {
    setShowChat(true);
    markChatRead();
  };

  const handleCloseChat = () => {
    setShowChat(false);
    markChatClosed();
  };

  const handleSendChat = () => {
    if (!chatInput.trim() || !gameState || !currentPlayer) return;
    sendChatMessage(gameState.roomId, currentPlayer.userId, currentPlayer.username, chatInput.trim());
    setChatInput("");
  };

  const currentPlayer = gameState?.players.find((p) => p.userId === user?.id);

  const isMyTurn = gameState && currentPlayer && gameState.players[gameState.currentPlayerIndex]?.id === currentPlayer.id;
  // REGEL: Schellen-8 ist transparent - verwende Karte darunter
  const topCard = gameState?.discardPile && gameState.discardPile.length > 0 
    ? getEffectiveTopCard(gameState.discardPile) 
    : undefined;
  // Für UI-Anzeige: zeige die tatsächlich oberste Karte (inkl. Schellen-8)
  const displayCard = gameState?.discardPile[gameState.discardPile.length - 1];

  useEffect(() => {
    // Redirect to room if game hasn't started
    if (gameState && gameState.phase === "waiting") {
      router.replace(`/lobby/room?code=${code}` as any);
    }

    // Handle game end
    if (gameState && gameState.phase === "game_end") {
      const winner = gameState.players.find((p) => !p.isEliminated);
      Alert.alert(
        "Spiel beendet!",
        winner ? `${winner.username} hat gewonnen!` : "Spiel beendet",
        [{ text: "OK", onPress: () => router.replace("/") }]
      );
    }
  }, [gameState?.phase]);

  // Ass-Flash-Effekt
  useEffect(() => {
    if (topCard?.rank === "ass") {
      setAssFlash(true);
      const timer = setTimeout(() => setAssFlash(false), 400);
      return () => clearTimeout(timer);
    }
  }, [topCard?.id]);

  // Server-sent blackbird events are now handled via onBlackbirdEvent callback in useGameSocket.
  // No client-side detection needed anymore.

  const handlePlayCard = (card: Card) => {
    if (!gameState || !currentPlayer || !isMyTurn) return;

    // If it's an Unter, show suit picker
    if (card.rank === "bube") {
      setPendingUnterCard(card);
      setShowSuitPicker(true);
      return;
    }

    // Fluganimation starten
    setFlyingCard(card);
    setShowFlyingCard(true);
    sendAction(gameState.roomId, currentPlayer.id, {
      type: "PLAY_CARD",
      cardId: card.id,
    });
    playCardPlay();
  };

  // Track combos from server state changes – only for human player
  useEffect(() => {
    if (!gameState || !currentPlayer) return;
    const discardLen = gameState.discardPile.length;
    if (discardLen > prevDiscardLength && prevDiscardLength > 0) {
      const topCard2 = gameState.discardPile[gameState.discardPile.length - 1];
      if (topCard2) {
        // Check if the human player played (their hand no longer has this card)
        const humanPlayed = currentPlayer.hand.every(c => c.id !== topCard2.id) && lastPlayerIndex === currentPlayer.id;
        // Also check if human just played (discard grew and it was their turn before)
        const isHumanCard = !gameState.players.some(p => p.userId < 0 && p.hand.every(c => c.id !== topCard2.id) && p.hand.length < 32);
        
        if (lastPlayerIndex === currentPlayer.id) {
          // Human played consecutively
          setComboCount(prev => prev + 1);
          setComboPlayer(currentPlayer.username);
        } else {
          // Someone else played – reset combo
          setComboCount(0);
        }
        
        // Track who played
        const playedBy = gameState.players.find(p => 
          p.hand.every(c => c.id !== topCard2.id)
        );
        if (playedBy) {
          setLastPlayerIndex(playedBy.id);
        }
      }
    }
    setPrevDiscardLength(discardLen);
  }, [gameState?.discardPile.length]);

  const handleSuitChoice = (suit: CardSuit) => {
    if (!gameState || !currentPlayer || !pendingUnterCard) return;

    // Fluganimation für Unter
    setFlyingCard(pendingUnterCard);
    setShowFlyingCard(true);
    sendAction(gameState.roomId, currentPlayer.id, {
      type: "PLAY_CARD",
      cardId: pendingUnterCard.id,
      wishSuit: suit,
    });
    playCardPlay();

    setShowSuitPicker(false);
    setPendingUnterCard(null);
  };

  const handleDrawCard = () => {
    if (!gameState || !currentPlayer || !isMyTurn) return;

    sendAction(gameState.roomId, currentPlayer.id, {
      type: "DRAW_CARD",
    });
    playCardDraw();
  };

  if (!isConnected || !gameState || !currentPlayer) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <Text className="text-foreground text-lg">Lade Spiel...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (showPreparation) {
    return (
      <GamePreparationScreen
        players={gameState.players}
        serverSeatDraws={prepSeatDraws}
        serverDealerDraws={prepDealerDraws}
        onComplete={() => {
          setShowPreparation(false);
          // Tell server we're done watching the animation
          if (gameState.roomId) {
            sendPreparationDone(gameState.roomId);
          }
        }}
      />
    );
  }

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
          source={require("@/assets/images/acid-mau-logo.png")}
          style={{ width: 300, height: 300 }}
          resizeMode="contain"
        />
      </View>
      
      <ScreenContainer className="p-3" containerClassName="bg-transparent">
      <DrawChainShakeWrapper drawChainCount={gameState?.drawChainCount ?? 0}>
      <View className="flex-1">
        {/* Game Info Header - more compact */}
        <View
          className="rounded-xl px-4 py-3 mb-3 border border-border"
          style={{ backgroundColor: "rgba(30, 32, 34, 0.85)" }}
        >
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-2">
              {isMyTurn && (
                <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#32CD32" }, pulseStyle]} />
              )}
              <Text className="text-muted text-xs">Am Zug:</Text>
              <Text className="text-foreground font-bold text-sm">
                {isMyTurn ? "DU" : currentTurnPlayer?.username}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <Text className="text-foreground text-lg">
                {gameState.direction === "clockwise" ? "↻" : "↺"}
              </Text>
              <Text className="text-muted text-xs">Runde {gameState.roundNumber}</Text>
              {/* Restart Round Button (Host only) */}
              {currentPlayer.userId === gameState.hostUserId && (
                <Pressable
                  onPress={() => {
                    Alert.alert(
                      "Runde neu starten?",
                      "Die aktuelle Runde wird abgebrochen und neu ausgeteilt. Verlustpunkte bleiben erhalten.",
                      [
                        { text: "Abbrechen", style: "cancel" },
                        {
                          text: "Neu starten",
                          style: "destructive",
                          onPress: () => sendAction(gameState.roomId, currentPlayer.id, { type: "RESTART_ROUND" }),
                        },
                      ]
                    );
                  }}
                  style={({ pressed }) => ({
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: pressed ? "rgba(255, 165, 0, 0.3)" : "rgba(255, 165, 0, 0.12)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 165, 0, 0.4)",
                    alignItems: "center",
                    justifyContent: "center",
                  })}
                >
                  <Text style={{ fontSize: 14 }}>🔄</Text>
                </Pressable>
              )}
              {/* Chat Button */}
              <Pressable
                onPress={handleOpenChat}
                style={({ pressed }) => ({
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: pressed ? "rgba(50, 205, 50, 0.3)" : "rgba(50, 205, 50, 0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(50, 205, 50, 0.4)",
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <Text style={{ fontSize: 14 }}>💬</Text>
                {unreadCount > 0 && (
                  <View style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    backgroundColor: "#DC143C",
                    borderRadius: 8,
                    minWidth: 16,
                    height: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 3,
                  }}>
                    <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {gameState.drawChainCount > 0 && (
            <View className="mt-2 bg-error rounded-lg p-2 border-2 border-warning">
              <View className="flex-row items-center justify-center gap-2">
                <Text className="text-3xl">⚠️</Text>
                <View>
                  <Text className="text-background text-center font-bold text-base">
                    ZIEHKETTE
                  </Text>
                  <Text className="text-warning text-center font-extrabold text-xl">
                    +{gameState.drawChainCount} KARTEN
                  </Text>
                </View>
                <Text className="text-3xl">⚠️</Text>
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
                <Text className="text-4xl">
                  {gameState.currentWishSuit === "eichel"
                    ? "🌰"
                    : gameState.currentWishSuit === "gruen"
                    ? "🍀"
                    : gameState.currentWishSuit === "rot"
                    ? "❤️"
                    : "🔔"}
                </Text>
                <Text className="text-white text-center font-extrabold text-lg">
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

        {/* Game Table */}
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
                <AnimatedDiscardPile card={displayCard || null} size="large" />
              </View>
              <Text style={{ color: "#9BA1A6", fontSize: 10, marginTop: 4 }}>Ablagestapel</Text>
              
              {/* Info: Effektive Karte wenn Schellen-8 liegt */}
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
            paddingBottom: 14,
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
                const isPlayable = topCard && canPlayCard(card, topCard, gameState.currentWishSuit).isValid;
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

      {/* Suit Picker Modal */}
      <Modal
        visible={showSuitPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuitPicker(false)}
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

            {/* Loss points */}
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

            {/* Ready status */}
            <View style={{ backgroundColor: "rgba(0, 0, 0, 0.3)", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <Text style={{ color: "#9BA1A6", fontSize: 12, marginBottom: 8 }}>Spieler-Status:</Text>
              {gameState.players.filter(p => !p.isEliminated).map((player) => (
                <View key={player.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 }}>
                  <Text style={{ color: "#E8E8E8" }}>{player.username}</Text>
                  <Text style={{ fontWeight: "600", color: player.isReady ? "#32CD32" : "#FFA500" }}>
                    {player.isReady ? "✅ READY" : "⏳ Wartet..."}
                  </Text>
                </View>
              ))}
            </View>

            {/* READY Button */}
            {!currentPlayer.isEliminated && !currentPlayer.isReady && (
              <Pressable
                onPress={() => sendAction(gameState.roomId, currentPlayer.id, { type: "READY" })}
                style={({ pressed }) => ({
                  backgroundColor: "#228B22",
                  borderRadius: 14,
                  padding: 16,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800", fontSize: 16 }}>
                  ✅ READY für nächste Runde
                </Text>
              </Pressable>
            )}

            {/* Waiting status */}
            {currentPlayer.isReady && (
              <View style={{ backgroundColor: "rgba(255, 165, 0, 0.15)", borderWidth: 1, borderColor: "#FFA500", borderRadius: 14, padding: 14 }}>
                <Text style={{ color: "#E8E8E8", textAlign: "center", fontWeight: "600" }}>
                  ⏳ Warte auf andere Spieler...
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Chat Modal */}
      <Modal
        visible={showChat}
        transparent
        animationType="slide"
        onRequestClose={handleCloseChat}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            {/* Backdrop */}
            <Pressable
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
              onPress={handleCloseChat}
            />
            {/* Chat Sheet */}
            <View style={{
              backgroundColor: "rgba(18, 20, 22, 0.98)",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: "rgba(51, 65, 85, 0.8)",
              height: "55%",
              paddingBottom: Platform.OS === "ios" ? 8 : 12,
              flexDirection: "column",
            }}>
              {/* Header */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(51, 65, 85, 0.5)" }}>
                <Text style={{ color: "#E8E8E8", fontWeight: "700", fontSize: 16 }}>💬 Chat</Text>
                <Pressable onPress={handleCloseChat} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
                  <Text style={{ color: "#9BA1A6", fontSize: 18 }}>✕</Text>
                </Pressable>
              </View>

              {/* Messages */}
              <FlatList
                ref={chatListRef}
                data={chatMessages}
                keyExtractor={(item) => item.id.toString()}
                style={{ flex: 1, minHeight: 0, paddingHorizontal: 12 }}
                contentContainerStyle={{ paddingVertical: 8, gap: 6 }}
                onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
                ListEmptyComponent={
                  <Text style={{ color: "#9BA1A6", textAlign: "center", marginTop: 20, fontSize: 13 }}>
                    Noch keine Nachrichten.
                  </Text>
                }
                renderItem={({ item }) => {
                  const isMe = item.userId === currentPlayer.userId;
                  return (
                    <View style={{
                      alignSelf: isMe ? "flex-end" : "flex-start",
                      maxWidth: "78%",
                      backgroundColor: isMe ? "rgba(50, 205, 50, 0.15)" : "rgba(30, 32, 34, 0.9)",
                      borderRadius: 14,
                      borderTopRightRadius: isMe ? 4 : 14,
                      borderTopLeftRadius: isMe ? 14 : 4,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderWidth: 1,
                      borderColor: isMe ? "rgba(50, 205, 50, 0.3)" : "rgba(51, 65, 85, 0.6)",
                    }}>
                      {!isMe && (
                        <Text style={{ color: "#32CD32", fontSize: 10, fontWeight: "700", marginBottom: 2 }}>
                          {item.username}
                        </Text>
                      )}
                      <Text style={{ color: "#E8E8E8", fontSize: 14 }}>{item.message}</Text>
                      <Text style={{ color: "#9BA1A6", fontSize: 9, marginTop: 2, alignSelf: "flex-end" }}>
                        {new Date(item.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                  );
                }}
              />

              {/* Input */}
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                paddingTop: 8,
                paddingBottom: 4,
                gap: 8,
                borderTopWidth: 1,
                borderTopColor: "rgba(51, 65, 85, 0.5)",
                flexShrink: 0,
              }}>
                <TextInput
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Nachricht..."
                  placeholderTextColor="#687076"
                  style={{
                    flex: 1,
                    backgroundColor: "rgba(30, 32, 34, 0.9)",
                    borderRadius: 20,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    color: "#E8E8E8",
                    fontSize: 14,
                    borderWidth: 1,
                    borderColor: "rgba(51, 65, 85, 0.6)",
                  }}
                  returnKeyType="send"
                  onSubmitEditing={handleSendChat}
                  maxLength={200}
                />
                <Pressable
                  onPress={handleSendChat}
                  style={({ pressed }) => ({
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: chatInput.trim() ? (pressed ? "#228B22" : "#32CD32") : "rgba(51, 65, 85, 0.4)",
                    alignItems: "center",
                    justifyContent: "center",
                  })}
                >
                  <Text style={{ fontSize: 16 }}>➤</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Round Start Modal */}
      <Modal
        visible={showRoundStart}
        transparent
        animationType="fade"
      >
        <View className="flex-1 bg-black/70 items-center justify-center">
          <View style={{ borderRadius: 20, padding: 32, borderWidth: 3, borderColor: "#32CD32", backgroundColor: "rgba(20, 20, 20, 0.97)" }}>
            <Text style={{ color: "#E8E8E8", fontSize: 28, fontWeight: "800", textAlign: "center" }}>
              🎮 Runde {gameState?.roundNumber}
            </Text>
          </View>
        </View>
      </Modal>
      <ComboCounter comboCount={comboCount} playerName={comboPlayer} />
      <DrawChainEscalation drawChainCount={gameState?.drawChainCount ?? 0} />
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
          // Process next queued event after a short delay
          setTimeout(() => {
            if (blackbirdQueueRef.current.length > 0) {
              processNextBlackbird();
            }
          }, 300);
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
