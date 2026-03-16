import { Touchable } from "@/components/ui/button";
import { useEffect, useState, useRef, useCallback } from "react";
import { View, Text, ScrollView, Alert, Modal, ImageBackground, Pressable, TextInput, KeyboardAvoidingView, Platform, FlatList, Vibration, useWindowDimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, cancelAnimation } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { PlayingCard } from "@/components/game/playing-card";
import { BlackbirdAnimation } from "@/components/game/blackbird-animation";
import { DiscardImpactBurst, SuitWishBurst, RoundStartGlow } from "@/components/game/blackbird-event-fx";
import { ComboCounter } from "@/components/game/combo-counter";
import { EmoteSystem } from "@/components/game/emote-system";
import { DrawChainEscalation, DrawChainShakeWrapper } from "@/components/game/draw-chain-escalation";
import { CardFlyAnimation } from "@/components/game/card-fly-animation";
import { GamePreparationScreen, type PreparationDrawData } from "@/components/game/game-preparation-screen";
import { useAuth } from "@/lib/auth-provider";
import { useSocket, type PreparationData, type BlackbirdEvent, type CardPlayFxEvent, type DrawCardFxEvent } from "@/lib/socket-provider";
import { useGameSounds } from "@/hooks/use-game-sounds";
import { getBotAvatarSource, getBotProfileById, getBotProfileByName } from "@/lib/bot-profiles";
import { FALLBACK_CORE_TOKENS, GAME_UI_TOKENS, withAlpha } from "@/lib/design-tokens";
import type { Card, CardSuit } from "@/shared/game-types";

/** Mini card backs for opponent hand display */
function MiniCardFan({ count, maxShow = 6, compact = false }: { count: number; maxShow?: number; compact?: boolean }) {
  const shown = Math.min(count, maxShow);
  const cardWidth = compact ? 14 : 18;
  const cardHeight = compact ? 22 : 26;
  const overlap = compact ? -6 : -8;
  const fontSize = compact ? 9 : 10;
  return (
    <View style={{ flexDirection: "row", marginTop: compact ? 2 : 4 }}>
      {Array.from({ length: shown }).map((_, i) => (
        <View
          key={i}
          style={{
            width: cardWidth,
            height: cardHeight,
            backgroundColor: GAME_UI_TOKENS.MINI_CARD_BG,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: GAME_UI_TOKENS.MINI_CARD_BORDER,
            marginLeft: i === 0 ? 0 : overlap,
            transform: [{ rotate: `${(i - (shown - 1) / 2) * 5}deg` }],
          }}
        >
          <View
            style={{
              flex: 1,
              margin: 2,
              borderRadius: 2,
              borderWidth: 0.5,
              borderColor: GAME_UI_TOKENS.MINI_CARD_INNER_BORDER,
              backgroundColor: GAME_UI_TOKENS.MINI_CARD_INNER_BG,
            }}
          />
        </View>
      ))}
      {count > maxShow && (
        <View
          style={{
            marginLeft: 5,
            alignSelf: "center",
            backgroundColor: "rgba(4, 10, 16, 0.82)",
            borderRadius: 999,
            borderWidth: 1,
            borderColor: "rgba(157, 182, 209, 0.55)",
            paddingHorizontal: 5,
            paddingVertical: 1,
          }}
        >
          <Text style={{ color: GAME_UI_TOKENS.MINI_CARD_TEXT, fontSize: fontSize + 1, fontWeight: "800" }}>+{count - maxShow}</Text>
        </View>
      )}
    </View>
  );
}

function PlayerAvatar({
  name,
  avatarUrl,
  botId,
  userId,
  active,
  isBot = false,
  size = 56,
}: {
  name: string;
  avatarUrl?: string;
  botId?: string;
  userId?: number;
  active?: boolean;
  isBot?: boolean;
  size?: number;
}) {
  const botProfile = isBot ? getBotProfileById(botId) ?? getBotProfileByName(name) : undefined;
  const initial = (botProfile?.fallbackInitial || (name || "?").charAt(0)).toUpperCase();
  const [remoteAvatarFailed, setRemoteAvatarFailed] = useState(false);
  const frameSize = Math.max(44, Math.min(64, size));
  const imageSize = Math.max(40, frameSize - 8);
  const avatarRadius = frameSize / 2;

  useEffect(() => {
    setRemoteAvatarFailed(false);
  }, [avatarUrl, name, isBot]);

  const handleAvatarError = useCallback(() => {
    setRemoteAvatarFailed(true);
  }, []);

  const source =
    !remoteAvatarFailed
      ? getBotAvatarSource({
          botId,
          botName: name,
          userId,
          avatarUrl,
          preferLocalFallback: isBot,
        })
      : botProfile?.imagePath;

  return (
    <View
      style={{
        width: frameSize,
        height: frameSize,
        borderRadius: avatarRadius,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: active ? "rgba(62, 212, 122, 0.9)" : "rgba(255,255,255,0.18)",
        backgroundColor: "rgba(10, 20, 18, 0.95)",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: active ? FALLBACK_CORE_TOKENS.SECONDARY_NEON : PLAY_COLORS.BLACK,
        shadowOpacity: active ? 0.36 : 0.14,
        shadowRadius: active ? 10 : 5,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      {source ? (
        <Image
          source={source}
          style={{ width: imageSize, height: imageSize, borderRadius: imageSize / 2 }}
          contentFit="cover"
          onError={handleAvatarError}
        />
      ) : (
        <Text style={{ color: GAME_UI_TOKENS.PLAYER_AVATAR_TEXT, fontSize: Math.floor(frameSize * 0.38), fontWeight: "800" }}>{initial}</Text>
      )}
    </View>
  );
}

const PLAY_COLORS = {
  BLACK: GAME_UI_TOKENS.BLACK,
  PURE_WHITE: GAME_UI_TOKENS.PURE_WHITE,
  TABLE_DARK: GAME_UI_TOKENS.TABLE_DARK,
  TABLE_LIGHT: GAME_UI_TOKENS.TABLE_LIGHT,
  BG_TINT: "rgba(6, 24, 18, 0.22)",
  LINE_SOFT: "rgba(109, 142, 173, 0.35)",
  LINE_STRONG: "rgba(46, 224, 128, 0.65)",
  FIELD_TINT: "rgba(80,200,120,0.12)",
  FIELD_MARK: GAME_UI_TOKENS.FIELD_MARK,
  TURN_CHIP_GLOW: GAME_UI_TOKENS.TURN_CHIP_GLOW,
  CLUTCH_BORDER: "rgba(255, 200, 80, 0.8)",
  RIVALRY_BORDER: "rgba(255, 95, 95, 0.7)",
} as const;

const DESIGN = {
  PRIMARY_TABLE: FALLBACK_CORE_TOKENS.PRIMARY_TABLE,
  SECONDARY_NEON: FALLBACK_CORE_TOKENS.SECONDARY_NEON,
  SURFACE_1: FALLBACK_CORE_TOKENS.SURFACE_1,
  SURFACE_2: FALLBACK_CORE_TOKENS.SURFACE_2,
  TEXT_MAIN: FALLBACK_CORE_TOKENS.TEXT_MAIN,
  TEXT_MUTED: FALLBACK_CORE_TOKENS.TEXT_MUTED,
  TEXT_INVERSE: FALLBACK_CORE_TOKENS.TEXT_INVERSE,
  STATE_SUCCESS: FALLBACK_CORE_TOKENS.STATE_SUCCESS,
  STATE_WARNING: FALLBACK_CORE_TOKENS.STATE_WARNING,
  STATE_DANGER: FALLBACK_CORE_TOKENS.STATE_DANGER,
  tableBase: FALLBACK_CORE_TOKENS.PRIMARY_TABLE,
  tableDark: PLAY_COLORS.TABLE_DARK,
  tableLight: PLAY_COLORS.TABLE_LIGHT,
  bgTint: PLAY_COLORS.BG_TINT,
  hudGlass: FALLBACK_CORE_TOKENS.SURFACE_1,
  panelGlass: withAlpha(FALLBACK_CORE_TOKENS.SURFACE_2, 0.94),
  accentPrimary: FALLBACK_CORE_TOKENS.STATE_WARNING,
  accentSecondary: FALLBACK_CORE_TOKENS.SECONDARY_NEON,
  textMain: FALLBACK_CORE_TOKENS.TEXT_MAIN,
  textMuted: FALLBACK_CORE_TOKENS.TEXT_MUTED,
  lineSoft: PLAY_COLORS.LINE_SOFT,
  lineStrong: PLAY_COLORS.LINE_STRONG,
};

export default function GamePlayScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user } = useAuth();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();

  const [showSuitPicker, setShowSuitPicker] = useState(false);
  const [pendingUnterCard, setPendingUnterCard] = useState<Card | null>(null);
  const [assFlash, setAssFlash] = useState(false);
  const [showRoundStart, setShowRoundStart] = useState(false);
  const [roundGlowKey, setRoundGlowKey] = useState(0);
  const [showRoundGlow, setShowRoundGlow] = useState(false);
  const [showBlackbird, setShowBlackbird] = useState(false);
  const [blackbirdLoser, setBlackbirdLoser] = useState<string | undefined>(undefined);
  const [blackbirdWinner, setBlackbirdWinner] = useState<string | undefined>(undefined);
  const [blackbirdEvent, setBlackbirdEvent] = useState<
    | "round_start"
    | "winner"
    | "loser"
    | "draw_chain"
    | "seven_played"
    | "ass"
    | "unter"
    | "mvp"
    | "elimination"
    | "chaos"
    | "guide"
    | undefined
  >(undefined);
  const [blackbirdDrawChain, setBlackbirdDrawChain] = useState<number | undefined>(undefined);
  const [blackbirdWishSuit, setBlackbirdWishSuit] = useState<string | undefined>(undefined);
  const [blackbirdIntensity, setBlackbirdIntensity] = useState<1 | 2 | 3 | 4 | 5 | undefined>(undefined);
  const [blackbirdSpotlight, setBlackbirdSpotlight] = useState<string | undefined>(undefined);
  const [blackbirdStatsText, setBlackbirdStatsText] = useState<string | undefined>(undefined);
  const [blackbirdVariant, setBlackbirdVariant] = useState<string | undefined>(undefined);
  const [blackbirdPhrase, setBlackbirdPhrase] = useState<string | undefined>(undefined);
  const { playCardPlay, playCardDraw, playRoundEnd, playBlackbird, playClutchCallout, playRivalryCallout } = useGameSounds();
  const [comboCount, setComboCount] = useState(0);
  const [comboPlayer, setComboPlayer] = useState("");
  const [lastPlayerIndex, setLastPlayerIndex] = useState<number | null>(null);
  // Queue for server-sent blackbird events
  const blackbirdQueueRef = useRef<BlackbirdEvent[]>([]);
  const showBlackbirdRef = useRef(false);
  const [prevDiscardLength, setPrevDiscardLength] = useState(0);
  const [flyingCard, setFlyingCard] = useState<Card | null>(null);
  const [showFlyingCard, setShowFlyingCard] = useState(false);
  const [discardImpactKey, setDiscardImpactKey] = useState(0);
  const [discardImpactIntensity, setDiscardImpactIntensity] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [showDiscardImpact, setShowDiscardImpact] = useState(false);
  const [wishFxKey, setWishFxKey] = useState(0);
  const [showWishFx, setShowWishFx] = useState(false);
  const [wishFxSuit, setWishFxSuit] = useState<string | undefined>(undefined);
  const [loserPulseName, setLoserPulseName] = useState<string | undefined>(undefined);
  const loserPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPreparation, setShowPreparation] = useState(false);
  const [prepSeatDraws, setPrepSeatDraws] = useState<PreparationDrawData[]>([]);
  const [prepDealerDraws, setPrepDealerDraws] = useState<PreparationDrawData[]>([]);
  const [prepPhase, setPrepPhase] = useState<"seat_selection" | "dealer_selection">("seat_selection");
  const [prepSeatOrder, setPrepSeatOrder] = useState<number[]>([]);
  const [prepSeatChoices, setPrepSeatChoices] = useState<Array<{ userId: number; seatPosition: number }>>([]);
  const [prepCurrentPicker, setPrepCurrentPicker] = useState<number | null>(null);
  const lastAnimatedDiscardCardIdRef = useRef<string | null>(null);
  const discardAnimationHydratedRef = useRef(false);
  const cardPlayFxQueueRef = useRef<CardPlayFxEvent[]>([]);
  const cardPlayFxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevHandCountByPlayerRef = useRef<Record<number, number>>({});
  const playerNameByIdRef = useRef<Record<number, string>>({});
  const rivalryTrackRef = useRef<{ pair?: string; lastPlayerId?: number; alternations: number; lastShownAt: number }>({
    pair: undefined,
    lastPlayerId: undefined,
    alternations: 0,
    lastShownAt: 0,
  });
  const [clutchBanner, setClutchBanner] = useState<string | null>(null);
  const clutchBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rivalryBanner, setRivalryBanner] = useState<string | null>(null);
  const rivalryBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingSinceRef = useRef<number | null>(null);
  const loaderEscalatedRef = useRef(false);
  const lastRecoverAttemptAtRef = useRef(0);
  const [loaderMessage, setLoaderMessage] = useState("Lade Spiel...");

  // Pulsing glow animation for active player
  const turnProgress = useSharedValue(0);
  const dangerPulse = useSharedValue(0.55);
  useEffect(() => {
    dangerPulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);
  const dangerPulseStyle = useAnimatedStyle(() => ({
    opacity: dangerPulse.value,
    transform: [{ scale: 0.98 + dangerPulse.value * 0.04 }],
  }));
  const turnBarStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: turnProgress.value }],
  }));
  const discardPop = useSharedValue(0);
  const discardPopStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + discardPop.value * 0.08 }, { rotate: `${discardPop.value * 1.8}deg` }],
  }));

  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const chatListRef = useRef<FlatList>(null);

  useEffect(() => {
    showBlackbirdRef.current = showBlackbird;
  }, [showBlackbird]);

  useEffect(() => {
    return () => {
      if (loserPulseTimerRef.current) {
        clearTimeout(loserPulseTimerRef.current);
        loserPulseTimerRef.current = null;
      }
      if (cardPlayFxTimerRef.current) {
        clearTimeout(cardPlayFxTimerRef.current);
        cardPlayFxTimerRef.current = null;
      }
      if (clutchBannerTimerRef.current) {
        clearTimeout(clutchBannerTimerRef.current);
        clutchBannerTimerRef.current = null;
      }
      if (rivalryBannerTimerRef.current) {
        clearTimeout(rivalryBannerTimerRef.current);
        rivalryBannerTimerRef.current = null;
      }
    };
  }, []);

  const playBlackbirdFeedback = useCallback((event: BlackbirdEvent) => {
    if (Platform.OS === "web") return;

    const chain = event.drawChainCount ?? 0;
    if (event.type === "seven_played") {
      if (chain >= 4) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        // Extreme chain warning pattern (explosion-like)
        Vibration.vibrate([200, 80, 200, 80, 400]);
      } else if (chain >= 3) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Vibration.vibrate([120, 60, 140, 60, 220]);
      } else {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Vibration.vibrate(80);
      }
      return;
    }

    if (event.type === "draw_chain" && chain >= 4) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Vibration.vibrate([160, 70, 170, 70, 260]);
      return;
    }
    if (event.type === "chaos") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Vibration.vibrate([120, 60, 160, 60, 220]);
      return;
    }
    if (event.type === "elimination") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Vibration.vibrate([180, 80, 220]);
      return;
    }
    if (event.type === "winner") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    if (event.type === "loser") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, []);

  const triggerBlackbirdFx = useCallback((event: BlackbirdEvent) => {
    if (event.type === "seven_played") {
      const chain = event.drawChainCount ?? 0;
      const intensity = chain >= 4 ? 5 : chain >= 3 ? 4 : chain >= 2 ? 3 : 2;
      setDiscardImpactIntensity(intensity);
      setDiscardImpactKey((k) => k + 1);
      setShowDiscardImpact(true);
      return;
    }

    if (event.type === "draw_chain" && (event.drawChainCount ?? 0) >= 4) {
      setDiscardImpactIntensity(Math.min(5, Math.max(3, event.intensity ?? 4)) as 1 | 2 | 3 | 4 | 5);
      setDiscardImpactKey((k) => k + 1);
      setShowDiscardImpact(true);
      return;
    }

    if (event.type === "ass") {
      setAssFlash(true);
      setTimeout(() => setAssFlash(false), 420);
      return;
    }

    if (event.type === "unter") {
      setWishFxSuit(event.wishSuit);
      setWishFxKey((k) => k + 1);
      setShowWishFx(true);
      return;
    }

    if (event.type === "round_start") {
      setRoundGlowKey((k) => k + 1);
      setShowRoundGlow(true);
      return;
    }

    if (event.type === "chaos") {
      setRoundGlowKey((k) => k + 1);
      setShowRoundGlow(true);
      setShowDiscardImpact(true);
      return;
    }

    if (event.type === "elimination" && event.playerName) {
      if (loserPulseTimerRef.current) clearTimeout(loserPulseTimerRef.current);
      setLoserPulseName(event.playerName);
      loserPulseTimerRef.current = setTimeout(() => {
        setLoserPulseName(undefined);
        loserPulseTimerRef.current = null;
      }, 1700);
      return;
    }

    if (event.type === "loser" && event.playerName) {
      if (loserPulseTimerRef.current) clearTimeout(loserPulseTimerRef.current);
      setLoserPulseName(event.playerName);
      loserPulseTimerRef.current = setTimeout(() => {
        setLoserPulseName(undefined);
        loserPulseTimerRef.current = null;
      }, 1500);
    }
  }, []);

  // Process next blackbird event from queue
  const processNextBlackbird = useCallback(() => {
    if (showBlackbirdRef.current) return;
    if (blackbirdQueueRef.current.length === 0) return;
    const event = blackbirdQueueRef.current.shift()!;
    const activate = () => {
      triggerBlackbirdFx(event);
      setBlackbirdEvent(event.type);
      setBlackbirdLoser(event.type === "loser" ? event.playerName : undefined);
      setBlackbirdWinner(event.type === "winner" ? event.playerName : undefined);
      setBlackbirdDrawChain(event.drawChainCount);
      setBlackbirdWishSuit(event.wishSuit);
      setBlackbirdIntensity(event.intensity);
      setBlackbirdSpotlight(event.spotlightPlayerName || event.playerName);
      setBlackbirdStatsText(event.statsText);
      setBlackbirdVariant(event.variant);
      setBlackbirdPhrase(event.phrase);
      playBlackbirdFeedback(event);
      setShowBlackbird(true);
      if ((event.intensity ?? 0) >= 4 && event.type !== "loser") {
        playRoundEnd();
      }
      if (event.type === "loser") {
        playRoundEnd();
        setShowRoundStart(true);
        setTimeout(() => setShowRoundStart(false), 2000);
      }
    };

    const delay = Math.max(0, (event.startAt ?? Date.now()) - Date.now());
    if (delay > 0) {
      setTimeout(activate, delay);
    } else {
      activate();
    }
  }, [playBlackbirdFeedback, playRoundEnd, triggerBlackbirdFx]);

  const processNextCardPlayFx = useCallback(() => {
    if (showFlyingCard) return;
    if (cardPlayFxQueueRef.current.length === 0) return;
    const next = cardPlayFxQueueRef.current.shift();
    if (!next?.card) return;
    playCardPlay();
    lastAnimatedDiscardCardIdRef.current = next.card.id;
    setFlyingCard(next.card);
    setShowFlyingCard(true);
  }, [showFlyingCard, playCardPlay]);

  const showClutchBanner = useCallback((text: string) => {
    setClutchBanner(text);
    playClutchCallout();
    if (clutchBannerTimerRef.current) clearTimeout(clutchBannerTimerRef.current);
    clutchBannerTimerRef.current = setTimeout(() => {
      setClutchBanner(null);
      clutchBannerTimerRef.current = null;
    }, 1600);
  }, [playClutchCallout]);

  const showRivalryBanner = useCallback((text: string) => {
    setRivalryBanner(text);
    playRivalryCallout();
    if (rivalryBannerTimerRef.current) clearTimeout(rivalryBannerTimerRef.current);
    rivalryBannerTimerRef.current = setTimeout(() => {
      setRivalryBanner(null);
      rivalryBannerTimerRef.current = null;
    }, 1800);
  }, [playRivalryCallout]);

  const buildClutchCallout = useCallback((player: { username: string; userId: number }) => {
    const normalized = (player.username || "")
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]/g, "");
    const botLines: Record<string, string[]> = {
      alf: [
        "🔥 Alf hat nur noch eine Karte! Kein Katzenfutter in Sicht.",
        "🔥 Alf im Clutch-Modus. Eine Karte trennt ihn vom Ziel.",
      ],
      yoda: [
        "🔥 Eine Karte Yoda hat. Vorsicht du sein musst.",
        "🔥 Fast durch ist Yoda. Kontern du jetzt musst.",
      ],
      gollum: [
        "🔥 Gollum hat nur noch eine... sein Schatz!",
        "🔥 Letzte Karte, mein Schatz! Gollum wird wild.",
      ],
      gizmo: [
        "🔥 Gizmo ist im Finale. Nur noch eine Karte!",
        "🔥 Mogwai-Alarm! Gizmo hat die letzte Karte.",
      ],
      pumuckl: [
        "🔥 Pumuckl hat nur noch eine Karte. Schabernack incoming!",
        "🔥 Pumuckl im Endspurt: eine Karte ubrig.",
      ],
      pumuckel: [
        "🔥 Pumuckl hat nur noch eine Karte. Schabernack incoming!",
        "🔥 Pumuckl im Endspurt: eine Karte ubrig.",
      ],
    };

    if (player.userId < 0) {
      const candidate = botLines[normalized];
      if (candidate?.length) {
        return candidate[Math.floor(Math.random() * candidate.length)];
      }
    }

    const generic = [
      `🔥 ${player.username}: Letzte Karte!`,
      `🔥 ${player.username} ist im Clutch! Nur noch eine Karte.`,
      `🔥 Matchpoint fur ${player.username}!`,
    ];
    return generic[Math.floor(Math.random() * generic.length)];
  }, []);

  const trackRivalryFromPlay = useCallback((playerId?: number) => {
    if (!playerId) return;
    const track = rivalryTrackRef.current;
    const prevPlayerId = track.lastPlayerId;
    track.lastPlayerId = playerId;
    if (!prevPlayerId || prevPlayerId === playerId) return;

    const pairIds = [prevPlayerId, playerId].sort((a, b) => a - b);
    const pairKey = `${pairIds[0]}:${pairIds[1]}`;
    if (track.pair === pairKey) {
      track.alternations += 1;
    } else {
      track.pair = pairKey;
      track.alternations = 1;
    }

    const now = Date.now();
    if (track.alternations >= 4 && now - track.lastShownAt > 12_000) {
      const aName = playerNameByIdRef.current[pairIds[0]] || `P${pairIds[0]}`;
      const bName = playerNameByIdRef.current[pairIds[1]] || `P${pairIds[1]}`;
      showRivalryBanner(`⚔️ Rivalität: ${aName} vs ${bName}`);
      track.lastShownAt = now;
      track.alternations = 0;
    }
  }, [showRivalryBanner]);

  const enqueueCardPlayFx = useCallback((event: CardPlayFxEvent) => {
    if (!event?.card) return;
    if (lastAnimatedDiscardCardIdRef.current === event.card.id) return;
    const activate = () => {
      cardPlayFxQueueRef.current.push(event);
      processNextCardPlayFx();
    };
    const delay = Math.max(0, (event.startAt ?? Date.now()) - Date.now());
    if (delay > 0) {
      if (cardPlayFxTimerRef.current) {
        clearTimeout(cardPlayFxTimerRef.current);
      }
      cardPlayFxTimerRef.current = setTimeout(activate, delay);
    } else {
      activate();
    }
  }, [processNextCardPlayFx]);

  const {
    isConnected,
    gameState: socketGameState,
    chatMessages,
    unreadCount,
    sendAction,
    sendChatMessage,
    markChatRead,
    markChatClosed,
    sendPreparationDone,
    chooseSeat,
    recoverSession,
    setOnPreparation,
    setOnBlackbirdEvent,
    setOnCardPlayFx,
    setOnDrawCardFx,
    setOnError,
  } = useSocket();
  const expectedRoomCode = (code || "").trim().toUpperCase();
  const gameState =
    socketGameState && expectedRoomCode && socketGameState.roomCode.toUpperCase() !== expectedRoomCode
      ? null
      : socketGameState;
  const currentPlayer = gameState?.players.find((p) => p.userId === user?.id);

  useEffect(() => {
    setOnPreparation((data: PreparationData) => {
      setPrepSeatDraws(data.seatDraws.map(d => ({ playerId: d.playerId, username: d.username, card: d.card })));
      setPrepDealerDraws(data.dealerDraws.map(d => ({ playerId: d.playerId, username: d.username, card: d.card })));
      setPrepPhase(data.phase ?? "seat_selection");
      setPrepSeatOrder(data.seatPickOrderUserIds ?? []);
      setPrepSeatChoices(data.seatChoices ?? []);
      setPrepCurrentPicker(data.currentPickerUserId ?? null);
      setShowPreparation(true);
    });
    setOnBlackbirdEvent((event: BlackbirdEvent) => {
      console.log("[blackbird][client] enqueue", {
        type: event.type,
        id: event.id,
        replay: event.replay === true,
        startAt: event.startAt,
      });
      blackbirdQueueRef.current.push(event);
      if (!showBlackbirdRef.current) {
        processNextBlackbird();
      }
    });
    setOnCardPlayFx((event: CardPlayFxEvent) => {
      enqueueCardPlayFx(event);
      trackRivalryFromPlay(event.playerId);
    });
    setOnDrawCardFx((event: DrawCardFxEvent) => {
      const delay = Math.max(0, (event.startAt ?? Date.now()) - Date.now());
      setTimeout(() => {
        playCardDraw();
      }, delay);
    });
    setOnError((error: string) => {
      if (/Karte passt nicht|gleiche Farbe oder Rang erforderlich|Ungültiger Zug|Ungueltiger Zug|Invalid move|not playable/i.test(error)) {
        // Keep gameplay fluid: these are expected server-side validations in race conditions.
        setShowFlyingCard(false);
        setFlyingCard(null);
        return;
      }
      if (/No active session found|Player not found in game|Failed to reconnect|Session temporarily unavailable/i.test(error)) {
        void recoverSession();
        return;
      }
      if (/Game no longer exists/i.test(error)) {
        router.replace("/lobby/join" as any);
        return;
      }
      Alert.alert("Fehler", error);
    });
    return () => {
      setOnPreparation(null);
      setOnBlackbirdEvent(null);
      setOnCardPlayFx(null);
      setOnDrawCardFx(null);
      setOnError(null);
    };
  }, [
    setOnPreparation,
    setOnBlackbirdEvent,
    setOnCardPlayFx,
    setOnDrawCardFx,
    setOnError,
    processNextBlackbird,
    enqueueCardPlayFx,
    trackRivalryFromPlay,
    playCardDraw,
    recoverSession,
    router,
  ]);

  useEffect(() => {
    if (!isConnected) {
      void recoverSession();
    }
  }, [isConnected, recoverSession]);

  useEffect(() => {
    const waitingForGame = !gameState || !currentPlayer;
    if (!waitingForGame) {
      loadingSinceRef.current = null;
      loaderEscalatedRef.current = false;
      setLoaderMessage("Lade Spiel...");
      return;
    }

    if (loadingSinceRef.current === null) {
      loadingSinceRef.current = Date.now();
      loaderEscalatedRef.current = false;
      lastRecoverAttemptAtRef.current = 0;
    }

    const interval = setInterval(() => {
      const startedAt = loadingSinceRef.current ?? Date.now();
      const elapsedMs = Date.now() - startedAt;
      const elapsedSec = Math.floor(elapsedMs / 1000);

      if (!isConnected) {
        setLoaderMessage("Verbindung wird wiederhergestellt...");
      } else {
        setLoaderMessage(`Lade Spiel... (${Math.min(elapsedSec, 12)}s)`);
        const now = Date.now();
        if (now - lastRecoverAttemptAtRef.current > 2500) {
          lastRecoverAttemptAtRef.current = now;
          void recoverSession();
        }
      }

      if (elapsedMs >= 12000 && !loaderEscalatedRef.current) {
        loaderEscalatedRef.current = true;
        Alert.alert(
          "Verbindung wiederherstellen fehlgeschlagen",
          "Spielzustand konnte nicht geladen werden. Du wirst zurück in den Raum geleitet.",
        );
        if (expectedRoomCode) {
          router.replace(`/lobby/room?code=${expectedRoomCode}` as any);
        } else {
          router.replace("/lobby/join" as any);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentPlayer, expectedRoomCode, gameState, isConnected, recoverSession, router]);

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

  const isMyTurn = Boolean(gameState && currentPlayer && gameState.players[gameState.currentPlayerIndex]?.id === currentPlayer.id);
  const playableCardIds = new Set(gameState?.playableCardIds ?? []);
  const displayCard = gameState?.discardPile[gameState.discardPile.length - 1];

  useEffect(() => {
    if (!gameState?.players) return;
    const map: Record<number, string> = {};
    for (const p of gameState.players) map[p.id] = p.username;
    playerNameByIdRef.current = map;
  }, [gameState?.players]);

  useEffect(() => {
    if (!gameState?.players) return;
    const prev = prevHandCountByPlayerRef.current;
    const next: Record<number, number> = {};
    for (const p of gameState.players) {
      next[p.id] = p.hand.length;
      const prevCount = prev[p.id];
      if (typeof prevCount === "number" && prevCount > 1 && p.hand.length === 1 && !p.isEliminated) {
        showClutchBanner(buildClutchCallout({ username: p.username, userId: p.userId }));
      }
    }
    prevHandCountByPlayerRef.current = next;
  }, [gameState?.discardPile.length, gameState?.players, showClutchBanner, buildClutchCallout]);
  const underneathDiscardCard = gameState && gameState.discardPile.length >= 2
    ? gameState.discardPile[gameState.discardPile.length - 2]
    : null;
  const isSchellenEightOnTop = Boolean(displayCard?.id === "schellen-8" && underneathDiscardCard);
  const effectiveDiscardCard = isSchellenEightOnTop ? underneathDiscardCard : displayCard;
  const isEventPhase =
    showBlackbird ||
    showDiscardImpact ||
    showWishFx ||
    showRoundGlow ||
    assFlash ||
    (gameState?.drawChainCount ?? 0) > 0;

  useEffect(() => {
    if (!isMyTurn) {
      cancelAnimation(turnProgress);
      turnProgress.value = withTiming(0, { duration: 180 });
      return;
    }
    turnProgress.value = 1;
    turnProgress.value = withRepeat(
      withTiming(0, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );
  }, [isMyTurn, turnProgress]);

  useEffect(() => {
    const len = gameState?.discardPile.length ?? 0;
    if (len <= 1) return;
    discardPop.value = 0;
    discardPop.value = withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) }, () => {
      discardPop.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    });
  }, [gameState?.discardPile.length, discardPop]);

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

  // Server-sent blackbird events are now handled via onBlackbirdEvent callback in useGameSocket.
  // No client-side detection needed anymore.

  const handlePlayCard = (card: Card) => {
    if (!gameState || !currentPlayer || !isMyTurn) return;
    if (gameState.playableCardIds && !playableCardIds.has(card.id)) {
      Alert.alert("Ungültiger Zug", "Diese Karte ist aktuell nicht spielbar.");
      return;
    }

    // If it's an Unter, show suit picker
    if (card.rank === "bube") {
      setPendingUnterCard(card);
      setShowSuitPicker(true);
      return;
    }

    sendAction(gameState.roomId, currentPlayer.id, {
      type: "PLAY_CARD",
      cardId: card.id,
    });
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

    sendAction(gameState.roomId, currentPlayer.id, {
      type: "PLAY_CARD",
      cardId: pendingUnterCard.id,
      wishSuit: suit,
    });

    setShowSuitPicker(false);
    setPendingUnterCard(null);
  };

  const handleDrawCard = () => {
    if (!gameState || !currentPlayer || !isMyTurn) return;

    sendAction(gameState.roomId, currentPlayer.id, {
      type: "DRAW_CARD",
    });
  };

  // Keep discard fly animation synchronized from authoritative server state for all clients.
  useEffect(() => {
    if (!gameState || gameState.discardPile.length === 0) return;
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];
    if (!topCard) return;

    if (!discardAnimationHydratedRef.current) {
      discardAnimationHydratedRef.current = true;
      lastAnimatedDiscardCardIdRef.current = topCard.id;
      return;
    }

    if (lastAnimatedDiscardCardIdRef.current === topCard.id) return;
    if (showFlyingCard) return;
    cardPlayFxQueueRef.current.push({ card: topCard });
    processNextCardPlayFx();
  }, [gameState?.discardPile.length, showFlyingCard, processNextCardPlayFx]);

  if (!isConnected || !gameState || !currentPlayer) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: DESIGN.tableBase }}>
        <View className="flex-1 items-center justify-center">
          <Text style={{ color: DESIGN.textMain, fontSize: 18, fontWeight: "700" }}>{loaderMessage}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (showPreparation) {
    return (
      <GamePreparationScreen
        players={gameState.players}
        serverSeatDraws={prepSeatDraws}
        serverDealerDraws={prepDealerDraws}
        preparationPhase={prepPhase}
        seatPickOrderUserIds={prepSeatOrder}
        seatChoices={prepSeatChoices}
        currentPickerUserId={prepCurrentPicker}
        myUserId={currentPlayer.userId}
        myUsername={currentPlayer.username}
        onChooseSeat={(seatPosition, pickerUserId) => {
          if (!gameState?.roomId) return;
          chooseSeat(gameState.roomId, seatPosition, pickerUserId ?? currentPlayer.userId);
        }}
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
  const playerCount = gameState.players.length;
  const mySeat = currentPlayer.seatPosition ?? gameState.players.findIndex((p) => p.id === currentPlayer.id);
  const seatAwareOpponents = [...opponents].sort((a, b) => {
    const aSeat = a.seatPosition ?? gameState.players.findIndex((p) => p.id === a.id);
    const bSeat = b.seatPosition ?? gameState.players.findIndex((p) => p.id === b.id);
    const aRel = ((aSeat - mySeat) + playerCount) % playerCount;
    const bRel = ((bSeat - mySeat) + playerCount) % playerCount;
    return aRel - bRel;
  });
  const isCompactHeight = viewportHeight < 790;
  const isNarrowWidth = viewportWidth < 390;
  const isSmallPhone = viewportWidth <= 393;
  const opponentChipWidth = isSmallPhone ? 102 : 108;
  const opponentChipMinHeight = isCompactHeight ? 82 : 88;
  const arenaHeight = isCompactHeight ? 360 : 404;
  const arenaInset = isNarrowWidth ? 8 : 14;
  const arenaUsableWidth = Math.max(260, viewportWidth - arenaInset * 2);
  const tableCenterX = arenaInset + arenaUsableWidth / 2;
  const playerCircleRadius = 320;
  const leftX = arenaInset;
  const rightX = arenaInset + arenaUsableWidth - opponentChipWidth;
  const centerX = tableCenterX - opponentChipWidth / 2;
  const yTop = isCompactHeight ? 2 : 4;
  const yUpper = isCompactHeight ? 68 : 82;
  const yMiddle = Math.min(isCompactHeight ? 138 : 156, Math.round(playerCircleRadius * 0.48));
  const yLower = Math.min(isCompactHeight ? 286 : 324, arenaHeight - opponentChipMinHeight - 2);
  const anchorMap: Record<number, Array<{ left: number; top: number }>> = {
    1: [{ left: centerX, top: yTop + 10 }],
    2: [
      { left: rightX, top: yMiddle },
      { left: leftX, top: yMiddle },
    ],
    3: [
      { left: rightX, top: yLower - 12 },
      { left: centerX, top: yTop },
      { left: leftX, top: yLower - 12 },
    ],
    4: [
      { left: rightX, top: yLower },
      { left: rightX, top: yUpper },
      { left: leftX, top: yUpper },
      { left: leftX, top: yLower },
    ],
    5: [
      { left: rightX, top: yLower },
      { left: rightX, top: yUpper },
      { left: centerX, top: yTop },
      { left: leftX, top: yUpper },
      { left: leftX, top: yLower },
    ],
  };
  const fallbackAnchors = anchorMap[5];
  const anchorsForOpponents = seatAwareOpponents.map((_, idx) => {
    const proposed = (anchorMap[seatAwareOpponents.length] ?? fallbackAnchors)[idx] ?? fallbackAnchors[idx % fallbackAnchors.length];
    const clampedLeft = Math.max(arenaInset, Math.min(arenaInset + arenaUsableWidth - opponentChipWidth, proposed.left));
    const clampedTop = Math.max(2, Math.min(arenaHeight - opponentChipMinHeight - 4, proposed.top));
    return { left: clampedLeft, top: clampedTop };
  });
  const wishSuitLabel = gameState.currentWishSuit
    ? `${gameState.currentWishSuit === "eichel" ? "🌰 Eichel" : gameState.currentWishSuit === "gruen" ? "🍀 Grün" : gameState.currentWishSuit === "rot" ? "❤️ Rot" : "🔔 Schellen"} oder Unter`
    : "";
  const stateChips: Array<{ key: string; text: string; tone: "warning" | "success" | "danger" }> = [];
  if (gameState.drawChainCount > 0) {
    stateChips.push({
      key: "draw-chain",
      text: `⚠️ Ziehkette +${gameState.drawChainCount}`,
      tone: "warning",
    });
  }
  if (gameState.currentWishSuit) {
    stateChips.push({
      key: "wish-suit",
      text: `🎯 Wunsch: ${wishSuitLabel}`,
      tone: "success",
    });
  }
  if (gameState.skipNextPlayer) {
    stateChips.push({
      key: "skip-next",
      text: "⏭️ Nächster Spieler setzt aus",
      tone: "danger",
    });
  }
  const stateToneColor: Record<"warning" | "success" | "danger", string> = {
    warning: DESIGN.STATE_WARNING,
    success: DESIGN.STATE_SUCCESS,
    danger: DESIGN.STATE_DANGER,
  };
  const playableCount = isMyTurn
    ? currentPlayer.hand.filter((card) => playableCardIds.has(card.id)).length
    : 0;
  const suitIcon: Record<CardSuit, string> = {
    eichel: "🌰",
    gruen: "🍀",
    rot: "❤️",
    schellen: "🔔",
  };
  const rankLabel: Record<Card["rank"], string> = {
    "7": "7",
    "8": "8",
    "9": "9",
    "10": "10",
    bube: "B",
    dame: "D",
    konig: "K",
    ass: "A",
  };
  const effectiveDiscardLabel = effectiveDiscardCard ? `${suitIcon[effectiveDiscardCard.suit]} ${rankLabel[effectiveDiscardCard.rank]}` : "";
  const discardTopRotation = (((gameState.discardPile.length + 2) % 7) - 3) * 2.5;
  const isCurrentPlayerLoserPulse = loserPulseName === currentPlayer.username;
  const centerSpotSize = isSmallPhone ? 280 : 320;
  const centerSpotTop = isCompactHeight ? 268 : 292;
  const tableLogoSize = isSmallPhone ? 132 : 156;
  const tableLogoTop = centerSpotTop + centerSpotSize / 2 - tableLogoSize / 2;
  const getRoundStartCards = (lossPoints: number) => Math.max(1, lossPoints + 1);

  return (
    <View style={{ flex: 1, backgroundColor: DESIGN.tableBase }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: DESIGN.tableBase,
        }}
      />
      <ImageBackground
        source={require("@/assets/images/table-felt.png")}
        resizeMode="repeat"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        imageStyle={{ opacity: 0.03, tintColor: PLAY_COLORS.FIELD_MARK }}
      />
      <View
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backgroundColor: DESIGN.bgTint,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          alignSelf: "center",
          top: tableLogoTop,
          width: tableLogoSize,
          height: tableLogoSize,
          opacity: isEventPhase ? 0.09 : 0.07,
        }}
      >
        <Image
          source={require("@/assets/images/icon.png")}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: centerSpotSize,
          height: centerSpotSize,
          alignSelf: "center",
          top: centerSpotTop,
          backgroundColor: isEventPhase ? "rgba(80,200,120,0.16)" : "rgba(80,200,120,0.07)",
          borderRadius: 9999,
          shadowColor: PLAY_COLORS.TURN_CHIP_GLOW,
          shadowOpacity: isEventPhase ? 0.12 : 0.05,
          shadowRadius: isEventPhase ? 92 : 56,
        }}
      />

      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        <View className={isCompactHeight ? "px-2 pt-2 pb-0 flex-1" : "px-3 pt-3 pb-0 flex-1"}>
        <DrawChainShakeWrapper drawChainCount={gameState?.drawChainCount ?? 0}>
          <View className="flex-1" style={{ position: "relative" }}>
            <View style={{ minHeight: 68, marginBottom: 8, paddingTop: 2 }}>
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 16,
                  backgroundColor: DESIGN.hudGlass,
                  borderWidth: 1,
                  borderColor: "rgba(96, 112, 126, 0.6)",
                }}
              />
              <Animated.View
                style={[
                  {
                    alignSelf: "flex-start",
                    backgroundColor: isMyTurn ? DESIGN.accentSecondary : DESIGN.accentPrimary,
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 7,
                    marginLeft: 8,
                    shadowColor: isMyTurn ? DESIGN.accentSecondary : DESIGN.accentPrimary,
                    shadowOpacity: 0.25,
                    shadowRadius: 10,
                  },
                ]}
              >
                <Text style={{ color: DESIGN.TEXT_INVERSE, fontWeight: "800", fontSize: 16 }}>
                  {isMyTurn ? "Dein Zug" : `Am Zug: ${currentTurnPlayer?.username}`}
                </Text>
                <Text style={{ color: withAlpha(DESIGN.TEXT_INVERSE, 0.84), fontWeight: "700", fontSize: 13 }}>
                  R{gameState.roundNumber} · {gameState.players.length}/{(gameState as any).maxPlayers || gameState.players.length}
                </Text>
              </Animated.View>
              <View
                style={{
                  position: "absolute",
                  left: 10,
                  right: 10,
                  bottom: 6,
                  height: 4,
                  borderRadius: 999,
                  overflow: "hidden",
                  backgroundColor: "rgba(255,255,255,0.18)",
                }}
              >
                <Animated.View
                  style={[
                    {
                      height: "100%",
                      borderRadius: 999,
                      backgroundColor: isMyTurn ? DESIGN.accentSecondary : "rgba(255,255,255,0.25)",
                    },
                    turnBarStyle,
                  ]}
                />
              </View>
              <View style={{ position: "absolute", right: 10, top: 10, flexDirection: "row", gap: 10 }}>
                {currentPlayer.userId === gameState.hostUserId && (
                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        "Runde neu starten?",
                        "Die aktuelle Runde wird abgebrochen und neu ausgeteilt. Verlustpunkte bleiben erhalten.",
                        [
                          { text: "Abbrechen", style: "cancel" },
                          { text: "Neu starten", style: "destructive", onPress: () => sendAction(gameState.roomId, currentPlayer.id, { type: "RESTART_ROUND" }) },
                        ]
                      );
                    }}
                    style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: pressed ? "rgba(255,157,26,0.34)" : "rgba(10, 19, 28, 0.85)",
                      borderWidth: 1.2,
                      borderColor: "rgba(255,157,26,0.8)",
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <Text style={{ fontSize: 16 }}>↻</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={handleOpenChat}
                  style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                    backgroundColor: pressed ? "rgba(80,80,80,0.8)" : "rgba(10, 19, 28, 0.85)",
                    borderWidth: 1.2,
                    borderColor: "rgba(255,255,255,0.35)",
                    alignItems: "center",
                    justifyContent: "center",
                  })}
                >
                  <Text style={{ fontSize: 16 }}>💬</Text>
                </Pressable>
              </View>
            </View>

            {stateChips.length > 0 && (
              <View
                style={{
                  marginTop: 24,
                  marginBottom: 12,
                  alignSelf: "center",
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: 8,
                  zIndex: 240,
                }}
              >
                {stateChips.map((chip) => (
                  <View
                    key={chip.key}
                    style={{
                      backgroundColor: withAlpha(DESIGN.SURFACE_1, 0.86),
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderWidth: 1.2,
                      borderColor: withAlpha(stateToneColor[chip.tone], 0.85),
                      shadowColor: stateToneColor[chip.tone],
                      shadowOpacity: 0.2,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 2 },
                    }}
                  >
                    <Text style={{ color: DESIGN.TEXT_MAIN, fontSize: 12, fontWeight: "800" }}>{chip.text}</Text>
                  </View>
                ))}
              </View>
            )}
            {(clutchBanner || rivalryBanner) && (
              <View style={{ alignItems: "center", marginTop: 8, marginBottom: 8, gap: 6 }}>
                {clutchBanner && (
                  <View
                    style={{
                      backgroundColor: "rgba(12, 22, 18, 0.9)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 200, 80, 0.8)",
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                    }}
                  >
                    <Text style={{ color: GAME_UI_TOKENS.CLUTCH_TEXT, fontWeight: "800", fontSize: 12 }}>{clutchBanner}</Text>
                  </View>
                )}
                {rivalryBanner && (
                  <View
                    style={{
                      backgroundColor: "rgba(16, 18, 28, 0.92)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 95, 95, 0.7)",
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                    }}
                  >
                    <Text style={{ color: GAME_UI_TOKENS.RIVALRY_TEXT, fontWeight: "800", fontSize: 12 }}>{rivalryBanner}</Text>
                  </View>
                )}
              </View>
            )}

            <View style={{ height: arenaHeight, marginTop: isCompactHeight ? 16 : 20, marginBottom: isCompactHeight ? 2 : 4, position: "relative" }}>
              <RoundStartGlow
                visible={showRoundGlow}
                eventKey={roundGlowKey}
                onDone={() => setShowRoundGlow(false)}
              />
              <SuitWishBurst
                visible={showWishFx}
                eventKey={wishFxKey}
                wishSuit={wishFxSuit}
                onDone={() => {
                  setShowWishFx(false);
                  setWishFxSuit(undefined);
                }}
              />
              {seatAwareOpponents.map((player, idx) => {
                const anchor = anchorsForOpponents[idx] ?? { top: 8, left: arenaInset + idx * 20 };
                const isActive = gameState.players[gameState.currentPlayerIndex]?.id === player.id;
                const isLoserPulse = loserPulseName === player.username;
                return (
                  <View
                    key={player.id}
                    style={{
                      position: "absolute",
                      top: anchor.top,
                      left: anchor.left,
                      width: opponentChipWidth,
                      height: opponentChipMinHeight,
                      backgroundColor: player.hand.length === 1
                        ? "rgba(10,18,16,0.34)"
                        : (isLoserPulse ? "rgba(130, 24, 24, 0.3)" : "rgba(10,18,16,0.28)"),
                      borderRadius: 14,
                      paddingHorizontal: 7,
                      paddingVertical: 6,
                      borderWidth: isActive ? 1.2 : 1,
                      borderColor: player.hand.length === 0
                        ? "rgba(255,255,255,0.12)"
                        : player.hand.length === 1
                        ? "rgba(236, 195, 78, 0.35)"
                        : (isLoserPulse ? "rgba(255, 88, 88, 0.82)" : "rgba(255,255,255,0.10)"),
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "space-between",
                      overflow: "hidden",
                      shadowColor: PLAY_COLORS.BLACK,
                      shadowOpacity: 0.16,
                      shadowRadius: 7,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 7,
                      opacity: player.hand.length === 0 ? 0.7 : 1,
                        }}
                      >
                    <View
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        backgroundColor: "rgba(3, 12, 9, 0.86)",
                        borderWidth: 1,
                        borderColor: "rgba(75, 214, 139, 0.45)",
                        borderRadius: 999,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ color: GAME_UI_TOKENS.HUD_TEXT_LIGHT, fontSize: 10, fontWeight: "800" }}>
                        S {getRoundStartCards(player.lossPoints)}
                      </Text>
                    </View>
                    {player.hand.length === 1 && (
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          {
                            position: "absolute",
                            top: -1,
                            left: -1,
                            right: -1,
                            bottom: -1,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: "rgba(249,115,22,0.35)",
                          },
                          dangerPulseStyle,
                        ]}
                      />
                    )}
                    {isLoserPulse && (
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          {
                            position: "absolute",
                            top: -1,
                            left: -1,
                            right: -1,
                            bottom: -1,
                            borderRadius: 12,
                            borderWidth: 2.2,
                            borderColor: "rgba(255,76,76,0.96)",
                          },
                          dangerPulseStyle,
                        ]}
                      />
                    )}
                    <PlayerAvatar
                      name={player.username}
                      avatarUrl={player.avatarUrl}
                      botId={player.botId}
                      userId={player.userId}
                      active={isActive}
                      isBot={Boolean(player.userId != null && player.userId < 0)}
                      size={48}
                    />
                    <Text
                      style={{
                        color: isActive ? DESIGN.accentSecondary : DESIGN.textMain,
                        fontWeight: "700",
                      fontSize: 12,
                      flexShrink: 1,
                      marginTop: 2,
                      textAlign: "center",
                    }}
                    numberOfLines={2}
                  >
                    {player.username}
                  </Text>
                    <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700", marginTop: 1 }}>
                      {player.hand.length} Karten
                    </Text>
                  </View>
                );
              })}

              <View
                style={{
                  position: "absolute",
                  alignSelf: "center",
                  top: isCompactHeight ? "45%" : "46%",
                  zIndex: 280,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: isCompactHeight ? 24 : 28,
                  paddingHorizontal: isCompactHeight ? 4 : 6,
                  paddingVertical: isCompactHeight ? 2 : 4,
                }}
              >
                <View className="items-center">
                  <Touchable
                    onPress={handleDrawCard}
                    disabled={!isMyTurn}
                  >
                    <View
                      style={{
                        width: 58,
                        height: 85,
                        shadowColor: PLAY_COLORS.BLACK,
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.28,
                        shadowRadius: 14,
                        elevation: 8,
                      }}
                    >
                      <View style={{ position: "absolute", top: 9, left: 12, opacity: 0.34 }}>
                        <PlayingCard card={{ suit: "eichel", rank: "7", id: "back-stack-3" }} faceDown size="medium" />
                      </View>
                      <View style={{ position: "absolute", top: 7, left: 9, opacity: 0.42 }}>
                        <PlayingCard card={{ suit: "eichel", rank: "7", id: "back-stack-1" }} faceDown size="medium" />
                      </View>
                      <View style={{ position: "absolute", top: 5, left: 6, opacity: 0.54 }}>
                        <PlayingCard card={{ suit: "eichel", rank: "7", id: "back-stack-2b" }} faceDown size="medium" />
                      </View>
                      <View style={{ position: "absolute", top: 2, left: 2, opacity: 0.66 }}>
                        <PlayingCard card={{ suit: "eichel", rank: "7", id: "back-stack-2" }} faceDown size="medium" />
                      </View>
                      <View style={{ position: "absolute", top: 0, left: 0 }}>
                        <PlayingCard card={{ suit: "eichel", rank: "7", id: "back" }} faceDown size="medium" />
                      </View>
                    </View>
                  </Touchable>
                  <Text style={{ color: isMyTurn ? DESIGN.accentSecondary : DESIGN.textMuted, fontSize: 11, fontWeight: "800", marginTop: 5 }}>
                    Ziehen
                  </Text>
                </View>

                <View className="items-center">
                  <View
                    style={{
                      zIndex: 300,
                      shadowColor: effectiveDiscardCard?.rank === "7" && gameState.drawChainCount > 0
                        ? DESIGN.accentPrimary
                        : PLAY_COLORS.BLACK,
                      shadowOffset: effectiveDiscardCard?.rank === "7" && gameState.drawChainCount > 0
                        ? { width: 0, height: 0 }
                        : { width: 0, height: 6 },
                      shadowOpacity: effectiveDiscardCard?.rank === "7" && gameState.drawChainCount > 0
                        ? Math.min(0.34 + (gameState.drawChainCount * 0.08), 0.78)
                        : 0.18,
                      shadowRadius: effectiveDiscardCard?.rank === "7" && gameState.drawChainCount > 0
                        ? 18 + (gameState.drawChainCount * 6)
                        : 12,
                      borderRadius: 12,
                      elevation: 8,
                    }}
                  >
                    <View style={{ width: 58, height: 85 }}>
                      {isSchellenEightOnTop && underneathDiscardCard && (
                        <View style={{ position: "absolute", top: 0, left: 0, opacity: 0.88, transform: [{ rotate: "-3deg" }] }}>
                          <PlayingCard card={underneathDiscardCard} size="medium" />
                        </View>
                      )}
                      <View style={{ position: "absolute", top: isSchellenEightOnTop ? 6 : 0, left: isSchellenEightOnTop ? 8 : 0 }}>
                        {displayCard ? (
                          <PlayingCard card={displayCard} size="medium" />
                        ) : (
                          <View
                            style={{
                              width: 58,
                              height: 85,
                              borderRadius: 10,
                              borderWidth: 1.5,
                              borderStyle: "dashed",
                              borderColor: "rgba(255,255,255,0.28)",
                              backgroundColor: "rgba(10, 18, 16, 0.28)",
                            }}
                          />
                        )}
                      </View>
                      {assFlash && (
                        <View
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            top: -4,
                            left: -4,
                            right: -4,
                            bottom: -4,
                            borderRadius: 12,
                            borderWidth: 2,
                            borderColor: "rgba(255,240,160,0.95)",
                            backgroundColor: "rgba(255, 240, 150, 0.22)",
                          }}
                        />
                      )}
                      <DiscardImpactBurst
                        visible={showDiscardImpact}
                        eventKey={discardImpactKey}
                        intensity={discardImpactIntensity}
                        onDone={() => setShowDiscardImpact(false)}
                      />
                    </View>
                  </View>
                  <Text style={{ color: DESIGN.textMain, fontSize: 11, fontWeight: "700", marginTop: 5 }}>Ablage</Text>
                  {isSchellenEightOnTop && (
                    <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 10, fontWeight: "700", marginTop: 1 }}>
                      Gilt: {effectiveDiscardLabel}
                    </Text>
                  )}

                </View>
              </View>
            </View>

            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: -4,
                zIndex: 290,
                backgroundColor: DESIGN.panelGlass,
                borderColor: isCurrentPlayerLoserPulse ? "rgba(255,88,88,0.95)" : (isMyTurn ? DESIGN.lineStrong : DESIGN.lineSoft),
                borderWidth: isMyTurn ? 1.8 : 1,
                borderRadius: 18,
                padding: 10,
                paddingBottom: isCompactHeight ? 6 : 8,
                shadowColor: isMyTurn ? DESIGN.accentSecondary : withAlpha(PLAY_COLORS.BLACK, 0.98),
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: isMyTurn ? 0.45 : 0.28,
                shadowRadius: isMyTurn ? 18 : 9,
                elevation: isMyTurn ? 13 : 5,
                minHeight: isMyTurn ? (isCompactHeight ? 132 : 148) : 90,
              }}
            >
              {isCurrentPlayerLoserPulse && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      position: "absolute",
                      top: -1,
                      left: -1,
                      right: -1,
                      bottom: -1,
                      borderRadius: 18,
                      borderWidth: 2.2,
                      borderColor: "rgba(255,76,76,0.96)",
                    },
                    dangerPulseStyle,
                  ]}
                />
              )}
              <View className="flex-row justify-between items-center mb-2">
                <View className="flex-row items-center gap-2">
                  <PlayerAvatar
                    name={currentPlayer.username}
                    avatarUrl={currentPlayer.avatarUrl}
                    botId={currentPlayer.botId}
                    userId={currentPlayer.userId}
                    active={isMyTurn}
                    isBot={Boolean(currentPlayer.userId != null && currentPlayer.userId < 0)}
                    size={48}
                  />
                  <Text style={{ color: isMyTurn ? DESIGN.accentSecondary : DESIGN.textMain, fontWeight: "800", fontSize: 14 }}>
                    {isMyTurn ? "DEIN ZUG" : "Deine Hand"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: GAME_UI_TOKENS.HUD_TEXT_LIGHT, fontSize: 11, fontWeight: "800" }}>
                    🂠 {currentPlayer.hand.length} Karten
                  </Text>
                  {isMyTurn && (
                    <Text style={{ color: DESIGN.SECONDARY_NEON, fontSize: 11, fontWeight: "800" }}>
                      Spielbar: {playableCount}/{currentPlayer.hand.length}
                    </Text>
                  )}
                  <Text style={{ color: DESIGN.textMuted, fontSize: 11 }}>
                    Verluste: {currentPlayer.lossPoints} / 7
                  </Text>
                </View>
              </View>
              {!isMyTurn && (
                <Text style={{ color: DESIGN.accentPrimary, fontSize: 12, marginBottom: 4, fontWeight: "700" }}>
                  Warte auf deinen Zug
                </Text>
              )}
              <View
                style={{
                  borderRadius: 14,
                  borderWidth: 1.2,
                  borderColor: withAlpha(DESIGN.TEXT_MUTED, 0.34),
                  backgroundColor: withAlpha(DESIGN.SURFACE_1, 0.1),
                  paddingVertical: 6,
                  paddingHorizontal: 6,
                }}
              >
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ minHeight: isMyTurn ? (isCompactHeight ? 84 : 94) : 68 }}>
                <View style={{ flexDirection: "row", gap: 7, alignItems: "flex-end", paddingBottom: 4, paddingHorizontal: 2 }}>
                  {currentPlayer.hand.map((card, index) => {
                    const disabledByServerHint = isMyTurn && Boolean(gameState.playableCardIds) && !playableCardIds.has(card.id);
                    const centerIndex = (currentPlayer.hand.length - 1) / 2;
                    const offset = index - centerIndex;
                    const fanSpread = currentPlayer.hand.length <= 5 ? 7 : 4;
                    const isPlayable = !disabledByServerHint && isMyTurn;
                    const isDimmed = isMyTurn && disabledByServerHint;
                    const arcLift = Math.max(0, 9 - Math.abs(offset) * 1.6);
                    return (
                      <View
                        key={card.id}
                        style={{
                          transform: [
                            { rotate: `${offset * fanSpread}deg` },
                            { translateY: 8 - arcLift + (isPlayable ? -12 : isDimmed ? 2 : 0) },
                            { scale: isPlayable ? 1.06 : isDimmed ? 0.94 : 1 },
                          ],
                          marginHorizontal: 0,
                          zIndex: 1000 - Math.abs(offset) * 10,
                          padding: 2,
                          borderRadius: 14,
                          borderWidth: isPlayable ? 2 : 1,
                          borderColor: isPlayable
                            ? withAlpha(DESIGN.SECONDARY_NEON, 0.92)
                            : withAlpha(DESIGN.TEXT_MUTED, 0.2),
                          shadowColor: isPlayable ? DESIGN.accentSecondary : PLAY_COLORS.BLACK,
                          shadowOpacity: isPlayable ? 0.52 : isDimmed ? 0.08 : 0.18,
                          shadowRadius: isPlayable ? 12 : 4,
                          elevation: isPlayable ? 9 : 2,
                          opacity: isDimmed ? 0.45 : (isMyTurn ? 1 : 0.92),
                          backgroundColor: isPlayable
                            ? withAlpha(DESIGN.SECONDARY_NEON, 0.08)
                            : "transparent",
                        }}
                      >
                        {isPlayable && (
                          <View
                            pointerEvents="none"
                            style={{
                              position: "absolute",
                              top: -5,
                              right: -2,
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: DESIGN.accentSecondary,
                              shadowColor: DESIGN.accentSecondary,
                              shadowOpacity: 0.7,
                              shadowRadius: 6,
                              shadowOffset: { width: 0, height: 0 },
                              elevation: 5,
                              zIndex: 2,
                            }}
                          />
                        )}
                        <PlayingCard
                          card={card}
                          onPress={() => handlePlayCard(card)}
                          disabled={!isMyTurn || disabledByServerHint}
                          size="small"
                        />
                        {disabledByServerHint && (
                          <View
                            pointerEvents="none"
                            style={{
                              position: "absolute",
                              top: 2,
                              left: 2,
                              right: 2,
                              bottom: 2,
                              borderRadius: 12,
                              backgroundColor: withAlpha(DESIGN.TEXT_INVERSE, 0.2),
                              borderWidth: 1,
                              borderColor: withAlpha(DESIGN.TEXT_MUTED, 0.24),
                            }}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
              </View>
            </View>
          </View>
        </DrawChainShakeWrapper>
        </View>
      </SafeAreaView>

      {/* Suit Picker Modal */}
      <Modal
        visible={showSuitPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuitPicker(false)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center p-6" pointerEvents="box-none">
          <View
            style={{
              borderRadius: 20,
              padding: 24,
              width: "100%",
              maxWidth: 320,
              backgroundColor: withAlpha(DESIGN.SURFACE_1, 0.97),
              borderWidth: 1,
              borderColor: GAME_UI_TOKENS.CHAT_SURFACE_BORDER,
            }}
          >
            <Text style={{ color: DESIGN.TEXT_MAIN, fontSize: 20, fontWeight: "800", marginBottom: 16, textAlign: "center" }}>
              Wähle eine Farbe
            </Text>
            <View style={{ gap: 10 }}>
              {(["eichel", "gruen", "rot", "schellen"] as CardSuit[]).map((suit) => {
                const colors: Record<string, string> = {
                  eichel: GAME_UI_TOKENS.SUIT_EICHEL,
                  gruen: GAME_UI_TOKENS.SUIT_GRUEN,
                  rot: GAME_UI_TOKENS.SUIT_ROT,
                  schellen: GAME_UI_TOKENS.SUIT_SCHELLEN,
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
                    <Text style={{ color: DESIGN.TEXT_MAIN, fontSize: 18, fontWeight: "700", textAlign: "center" }}>
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
              <Text style={{ color: DESIGN.TEXT_MUTED, textAlign: "center", fontSize: 14 }}>Abbrechen</Text>
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
          <View
            style={{
              borderRadius: 20,
              padding: 24,
              width: "100%",
              maxWidth: 380,
              backgroundColor: withAlpha(DESIGN.SURFACE_1, 0.97),
              borderWidth: 2,
              borderColor: withAlpha(DESIGN.TEXT_MUTED, 0.45),
            }}
          >
            <Text style={{ color: DESIGN.TEXT_MAIN, fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 16 }}>
              🏁 Runde {gameState.roundNumber} beendet!
            </Text>

            {/* Loss points */}
            <View style={{ backgroundColor: "rgba(0, 0, 0, 0.3)", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <Text style={{ color: DESIGN.TEXT_MUTED, fontSize: 12, marginBottom: 8 }}>Verlustpunkte:</Text>
              {gameState.players.map((player) => (
                <View key={player.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 }}>
                  <Text style={{ color: player.isEliminated ? GAME_UI_TOKENS.STATE_DISABLED : DESIGN.TEXT_MAIN, textDecorationLine: player.isEliminated ? "line-through" : "none" }}>
                    {player.username}
                  </Text>
                  <Text style={{ fontWeight: "700", color: player.isEliminated ? GAME_UI_TOKENS.STATE_DISABLED : DESIGN.STATE_DANGER }}>
                    {player.isEliminated ? "❌ RAUS" : `${player.lossPoints} ❌`}
                  </Text>
                </View>
              ))}
            </View>

            {/* Ready status */}
            <View style={{ backgroundColor: "rgba(0, 0, 0, 0.3)", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <Text style={{ color: DESIGN.TEXT_MUTED, fontSize: 12, marginBottom: 8 }}>Spieler-Status:</Text>
              {gameState.players.filter(p => !p.isEliminated).map((player) => (
                <View key={player.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 }}>
                  <Text style={{ color: DESIGN.TEXT_MAIN }}>{player.username}</Text>
                  <Text style={{ fontWeight: "600", color: player.isReady ? DESIGN.STATE_SUCCESS : DESIGN.STATE_WARNING }}>
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
                  backgroundColor: DESIGN.STATE_SUCCESS,
                  borderRadius: 14,
                  padding: 16,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: DESIGN.TEXT_INVERSE, textAlign: "center", fontWeight: "800", fontSize: 16 }}>
                  ✅ READY für nächste Runde
                </Text>
              </Pressable>
            )}

            {/* Waiting status */}
            {currentPlayer.isReady && (
              <View style={{ backgroundColor: withAlpha(DESIGN.STATE_WARNING, 0.15), borderWidth: 1, borderColor: DESIGN.STATE_WARNING, borderRadius: 14, padding: 14 }}>
                <Text style={{ color: DESIGN.TEXT_MAIN, textAlign: "center", fontWeight: "600" }}>
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
                <Text style={{ color: DESIGN.TEXT_MAIN, fontWeight: "700", fontSize: 16 }}>💬 Chat</Text>
                <Pressable onPress={handleCloseChat} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
                  <Text style={{ color: DESIGN.TEXT_MUTED, fontSize: 18 }}>✕</Text>
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
                  <Text style={{ color: DESIGN.TEXT_MUTED, textAlign: "center", marginTop: 20, fontSize: 13 }}>
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
                        <Text style={{ color: DESIGN.STATE_SUCCESS, fontSize: 10, fontWeight: "700", marginBottom: 2 }}>
                          {item.username}
                        </Text>
                      )}
                      <Text style={{ color: DESIGN.TEXT_MAIN, fontSize: 14 }}>{item.message}</Text>
                      <Text style={{ color: DESIGN.TEXT_MUTED, fontSize: 9, marginTop: 2, alignSelf: "flex-end" }}>
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
                  placeholderTextColor={GAME_UI_TOKENS.CHAT_PLACEHOLDER}
                  style={{
                    flex: 1,
                    backgroundColor: "rgba(30, 32, 34, 0.9)",
                    borderRadius: 20,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    color: DESIGN.TEXT_MAIN,
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
                    backgroundColor: chatInput.trim() ? (pressed ? DESIGN.STATE_SUCCESS : DESIGN.SECONDARY_NEON) : withAlpha(GAME_UI_TOKENS.CHAT_SURFACE_BORDER, 0.4),
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
          <View style={{ borderRadius: 20, padding: 32, borderWidth: 3, borderColor: DESIGN.SECONDARY_NEON, backgroundColor: withAlpha(DESIGN.SURFACE_1, 0.97) }}>
            <Text style={{ color: DESIGN.TEXT_MAIN, fontSize: 28, fontWeight: "800", textAlign: "center" }}>
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
        intensity={blackbirdIntensity}
        spotlightPlayerName={blackbirdSpotlight}
        statsText={blackbirdStatsText}
        variant={blackbirdVariant}
        phrase={blackbirdPhrase}
        onDone={() => {
          console.log("[blackbird][client] done", {
            type: blackbirdEvent,
            queueRemaining: blackbirdQueueRef.current.length,
          });
          setShowBlackbird(false);
          setBlackbirdLoser(undefined);
          setBlackbirdWinner(undefined);
          setBlackbirdEvent(undefined);
          setBlackbirdDrawChain(undefined);
          setBlackbirdWishSuit(undefined);
          setBlackbirdIntensity(undefined);
          setBlackbirdSpotlight(undefined);
          setBlackbirdStatsText(undefined);
          setBlackbirdVariant(undefined);
          setBlackbirdPhrase(undefined);
          // Process next queued event after a short delay
          setTimeout(() => {
            if (blackbirdQueueRef.current.length > 0) {
              processNextBlackbird();
            }
          }, 300);
        }}
        onStart={() => {
          console.log("[blackbird][client] render-start", {
            type: blackbirdEvent,
            winner: blackbirdWinner,
            loser: blackbirdLoser,
          });
          playBlackbird();
        }}
      />
      <CardFlyAnimation
        card={flyingCard}
        visible={showFlyingCard}
        onDone={() => {
          setShowFlyingCard(false);
          setFlyingCard(null);
          setTimeout(() => {
            processNextCardPlayFx();
          }, 50);
        }}
      />
    </View>
  );
}
