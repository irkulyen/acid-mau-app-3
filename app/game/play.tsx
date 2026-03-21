import { Touchable } from "@/components/ui/button";
import { useEffect, useState, useRef, useCallback } from "react";
import { View, Text, ScrollView, Alert, Modal, ImageBackground, Pressable, TextInput, KeyboardAvoidingView, Platform, FlatList, Vibration, useWindowDimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, cancelAnimation } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { PlayingCard } from "@/components/game/playing-card";
import { BlackbirdAnimation } from "@/components/game/blackbird-animation";
import { DiscardImpactBurst, SuitWishBurst, RoundStartGlow, SpecialCardActionFx } from "@/components/game/blackbird-event-fx";
import { ComboCounter } from "@/components/game/combo-counter";
import { DrawChainEscalation, DrawChainShakeWrapper } from "@/components/game/draw-chain-escalation";
import { CardFlyAnimation } from "@/components/game/card-fly-animation";
import { DrawCardAnimation } from "@/components/game/draw-card-animation";
import { GamePreparationScreen, type PreparationDrawData } from "@/components/game/game-preparation-screen";
import { useAuth } from "@/lib/auth-provider";
import {
  useSocket,
  type PreparationData,
  type BlackbirdEvent,
  type CardPlayFxEvent,
  type DrawCardFxEvent,
  type GameFxEvent,
  type ReactionEmoji,
  type ReactionEvent,
} from "@/lib/socket-provider";
import { useGameSounds } from "@/hooks/use-game-sounds";
import { getBotProfileByName } from "@/lib/bot-profiles";
import { hashString, pickBySeed } from "@/lib/deterministic";
import { getGameFxCueSpec } from "@/lib/game-fx-cue-spec";
import {
  getQueueLagMs,
  getStartDriftMs,
  shouldWarnQueueDepth,
  shouldWarnQueueLag,
  shouldWarnStartDrift,
} from "@/lib/game-fx-performance-budget";
import { getGameFxUiPlan } from "@/lib/game-fx-ui-plan";
import { getGamePriorityPills, getPlayableCount, shouldShowSecondaryGameBanner } from "@/lib/ux-status";
import type { Card, CardSuit, GameState } from "@/shared/game-types";

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
            backgroundColor: "#1a3a5c",
            borderRadius: 4,
            borderWidth: 1,
            borderColor: "#2a5a8c",
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
              borderColor: "#3a6a9c",
              backgroundColor: "#1e4a7a",
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
          <Text style={{ color: "#E2EAF1", fontSize: fontSize + 1, fontWeight: "800" }}>+{count - maxShow}</Text>
        </View>
      )}
    </View>
  );
}

function PlayerAvatar({ name, avatarUrl, active, isBot = false, size = 56 }: { name: string; avatarUrl?: string; active?: boolean; isBot?: boolean; size?: number }) {
  const botProfile = isBot ? getBotProfileByName(name) : undefined;
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
    avatarUrl && !remoteAvatarFailed
      ? { uri: avatarUrl }
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
        shadowColor: active ? "#3ED47A" : "#000",
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
        <Text style={{ color: "#E8E8E8", fontSize: Math.floor(frameSize * 0.38), fontWeight: "800" }}>{initial}</Text>
      )}
    </View>
  );
}

const DESIGN = {
  tableBase: "#0B3D2E",
  tableDark: "#072E22",
  tableLight: "#14533C",
  bgTint: "rgba(6, 24, 18, 0.22)",
  hudGlass: "#1A1F25",
  panelGlass: "rgba(17, 24, 32, 0.94)",
  accentPrimary: "#FF9D1A",
  accentSecondary: "#3ED47A",
  textMain: "#F3F7FB",
  textMuted: "#AFC0CF",
  lineSoft: "rgba(109, 142, 173, 0.35)",
  lineStrong: "rgba(46, 224, 128, 0.65)",
};

const QUICK_REACTIONS: Array<{ emoji: ReactionEmoji; label: string }> = [
  { emoji: "😈", label: "Schadenfreude" },
  { emoji: "😤", label: "Druck" },
  { emoji: "😂", label: "Lachen" },
  { emoji: "🐦", label: "Amsel" },
  { emoji: "👀", label: "Beobachten" },
  { emoji: "⚡", label: "Impact" },
];

type ActiveReaction = ReactionEvent & { localKey: string };

export default function GamePlayScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
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
    "round_start" | "winner" | "loser" | "draw_chain" | "seven_played" | "direction_shift" | "ass" | "unter" | "invalid" | "mvp" | undefined
  >(undefined);
  const [blackbirdEventId, setBlackbirdEventId] = useState<string | undefined>(undefined);
  const [blackbirdDrawChain, setBlackbirdDrawChain] = useState<number | undefined>(undefined);
  const [blackbirdWishSuit, setBlackbirdWishSuit] = useState<string | undefined>(undefined);
  const [blackbirdIntensity, setBlackbirdIntensity] = useState<1 | 2 | 3 | 4 | 5 | undefined>(undefined);
  const [blackbirdSpotlight, setBlackbirdSpotlight] = useState<string | undefined>(undefined);
  const [blackbirdStatsText, setBlackbirdStatsText] = useState<string | undefined>(undefined);
  const [blackbirdVariant, setBlackbirdVariant] = useState<string | undefined>(undefined);
  const [blackbirdPhrase, setBlackbirdPhrase] = useState<string | undefined>(undefined);
  const {
    playCardPlay,
    playCardDraw,
    playRoundEnd,
    playBlackbird,
    playClutchCallout,
    playRivalryCallout,
    playTurnShift,
    playDrawChainAlert,
    playRoundTransition,
    playInvalidAction,
    playAmselSignature,
  } = useGameSounds();
  const [comboCount, setComboCount] = useState(0);
  const [comboPlayer, setComboPlayer] = useState("");
  const [lastPlayerIndex, setLastPlayerIndex] = useState<number | null>(null);
  // Queue for server-sent blackbird events
  const blackbirdQueueRef = useRef<BlackbirdEvent[]>([]);
  const showBlackbirdRef = useRef(false);
  const [prevDiscardLength, setPrevDiscardLength] = useState(0);
  const [flyingCard, setFlyingCard] = useState<Card | null>(null);
  const [showFlyingCard, setShowFlyingCard] = useState(false);
  const [showDrawFly, setShowDrawFly] = useState(false);
  const [drawFlyFx, setDrawFlyFx] = useState<{ targetX: number; targetY: number; drawCount: number; playerName?: string } | null>(null);
  const drawFlyFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [discardImpactKey, setDiscardImpactKey] = useState(0);
  const [discardImpactIntensity, setDiscardImpactIntensity] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [showDiscardImpact, setShowDiscardImpact] = useState(false);
  const [specialCardFxKey, setSpecialCardFxKey] = useState(0);
  const [showSpecialCardFx, setShowSpecialCardFx] = useState(false);
  const [specialCardFxRank, setSpecialCardFxRank] = useState<"7" | "ass" | "bube" | "8" | undefined>(undefined);
  const [specialCardFxWishSuit, setSpecialCardFxWishSuit] = useState<string | undefined>(undefined);
  const [specialCardFxDirection, setSpecialCardFxDirection] = useState<"clockwise" | "counterclockwise" | undefined>(undefined);
  const [specialCardFxDrawChain, setSpecialCardFxDrawChain] = useState<number | undefined>(undefined);
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
  const blackbirdDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blackbirdNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blackbirdVisibilityGuardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameFxQueueRef = useRef<GameFxEvent[]>([]);
  const pendingGameFxRef = useRef<GameFxEvent[]>([]);
  const gameFxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameFxCompletionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const activeGameFxRef = useRef<GameFxEvent | null>(null);
  const hasUnifiedGameFxRef = useRef(false);
  const seenGameFxRef = useRef<Map<string, number>>(new Map());
  const seenBlackbirdEventsRef = useRef<Map<string, number>>(new Map());
  const lastProcessedGameFxSequenceRef = useRef(0);
  const highestQueuedGameFxSequenceRef = useRef(0);
  const activeGameFxRoomIdRef = useRef<number | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const processNextGameFxRef = useRef<() => void>(() => {});
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
  const [momentBanner, setMomentBanner] = useState<string | null>(null);
  const momentBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingSinceRef = useRef<number | null>(null);
  const loaderEscalatedRef = useRef(false);
  const lastRecoverAttemptAtRef = useRef(0);
  const [loaderMessage, setLoaderMessage] = useState("Lade Spiel...");
  const lastInvalidBlackbirdAtRef = useRef(0);
  const lastTurnCueRef = useRef<string>("");
  const gameFxPerfWarnRef = useRef<{ depthAt: number; lagAt: number; driftAt: number }>({
    depthAt: 0,
    lagAt: 0,
    driftAt: 0,
  });
  const lastSpecialHapticAtRef = useRef(0);
  const recentSpecialCueRef = useRef<{ seven: number; ass: number; unter: number; eight: number; drawChain: number }>({
    seven: 0,
    ass: 0,
    unter: 0,
    eight: 0,
    drawChain: 0,
  });

  // Pulsing glow animation for active player
  const glowOpacity = useSharedValue(0.4);
  const turnProgress = useSharedValue(0);
  const dangerPulse = useSharedValue(0.55);
  const turnChipPulse = useSharedValue(0);
  useEffect(() => {
    glowOpacity.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    dangerPulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    turnChipPulse.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));
  const dangerPulseStyle = useAnimatedStyle(() => ({
    opacity: dangerPulse.value,
    transform: [{ scale: 0.98 + dangerPulse.value * 0.04 }],
  }));
  const turnBarStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: turnProgress.value }],
  }));
  const turnChipPulseStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.25 + turnChipPulse.value * 0.35,
    transform: [{ scale: 0.99 + turnChipPulse.value * 0.02 }],
  }));
  const discardPop = useSharedValue(0);
  const discardPopStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + discardPop.value * 0.08 }, { rotate: `${discardPop.value * 1.8}deg` }],
  }));

  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const chatListRef = useRef<FlatList>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [activeReactions, setActiveReactions] = useState<ActiveReaction[]>([]);
  const [reactionCooldownActive, setReactionCooldownActive] = useState(false);
  const [selectedReactionTargetUserId, setSelectedReactionTargetUserId] = useState<number | null>(null);
  const reactionExpiryTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const reactionCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenReactionEventIdsRef = useRef<Map<string, number>>(new Map());
  const lastReactionAmselCueAtRef = useRef(0);
  const pendingManualAmselEventsRef = useRef<BlackbirdEvent[]>([]);
  const pendingReactionEventsRef = useRef<ReactionEvent[]>([]);
  const recoverSessionRef = useRef<(() => void | Promise<void>) | null>(null);

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
      if (blackbirdDelayTimerRef.current) {
        clearTimeout(blackbirdDelayTimerRef.current);
        blackbirdDelayTimerRef.current = null;
      }
      if (blackbirdNextTimerRef.current) {
        clearTimeout(blackbirdNextTimerRef.current);
        blackbirdNextTimerRef.current = null;
      }
      if (blackbirdVisibilityGuardTimerRef.current) {
        clearTimeout(blackbirdVisibilityGuardTimerRef.current);
        blackbirdVisibilityGuardTimerRef.current = null;
      }
      if (clutchBannerTimerRef.current) {
        clearTimeout(clutchBannerTimerRef.current);
        clutchBannerTimerRef.current = null;
      }
      if (rivalryBannerTimerRef.current) {
        clearTimeout(rivalryBannerTimerRef.current);
        rivalryBannerTimerRef.current = null;
      }
      if (gameFxTimerRef.current) {
        clearTimeout(gameFxTimerRef.current);
        gameFxTimerRef.current = null;
      }
      if (momentBannerTimerRef.current) {
        clearTimeout(momentBannerTimerRef.current);
        momentBannerTimerRef.current = null;
      }
      if (drawFlyFallbackTimerRef.current) {
        clearTimeout(drawFlyFallbackTimerRef.current);
        drawFlyFallbackTimerRef.current = null;
      }
      if (reactionCooldownTimerRef.current) {
        clearTimeout(reactionCooldownTimerRef.current);
        reactionCooldownTimerRef.current = null;
      }
      reactionExpiryTimersRef.current.forEach((timer) => clearTimeout(timer));
      reactionExpiryTimersRef.current.clear();
      gameFxCompletionTimersRef.current.forEach(clearTimeout);
      gameFxCompletionTimersRef.current = [];
    };
  }, []);

  const playBlackbirdFeedback = useCallback((event: BlackbirdEvent) => {
    if (Platform.OS === "web") return;
    // Special-card peaks are handled by the authoritative special_card/draw_chain FX path.
    // Keep blackbird haptics only for top-level outcome/errors to avoid duplicate vibration stacks.
    if (event.type === "seven_played" || event.type === "draw_chain" || event.type === "ass" || event.type === "unter" || event.type === "direction_shift") {
      return;
    }
    if (event.type === "invalid") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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

  const playSpecialCardHaptic = useCallback((rank: "7" | "ass" | "bube" | "8", drawChainCount?: number) => {
    if (Platform.OS === "web") return;
    const now = Date.now();
    if (now - lastSpecialHapticAtRef.current < 220) return;
    lastSpecialHapticAtRef.current = now;

    if (rank === "7") {
      const chain = Math.max(2, drawChainCount ?? 2);
      if (chain >= 4) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Vibration.vibrate([120, 55, 150, 55, 180]);
      } else {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      return;
    }
    if (rank === "ass") {
      void Haptics.impactAsync((Haptics.ImpactFeedbackStyle as any).Rigid ?? Haptics.ImpactFeedbackStyle.Heavy);
      Vibration.vibrate([64, 36, 28]);
      return;
    }
    if (rank === "bube") {
      void Haptics.impactAsync((Haptics.ImpactFeedbackStyle as any).Soft ?? Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Vibration.vibrate([46, 38, 46]);
  }, []);

  const getBlackbirdDedupKey = useCallback((event: BlackbirdEvent) => {
    if (event.id) return event.id;
    return [
      event.type,
      event.startAt ?? 0,
      event.playerName ?? "",
      event.spotlightPlayerName ?? "",
      event.drawChainCount ?? 0,
      event.wishSuit ?? "",
      event.variant ?? "",
      event.phrase ?? "",
    ].join("|");
  }, []);

  const shouldProcessBlackbirdEvent = useCallback((event: BlackbirdEvent) => {
    const seen = seenBlackbirdEventsRef.current;
    const now = Date.now();
    for (const [key, at] of seen.entries()) {
      if (now - at > 30_000) seen.delete(key);
    }
    const dedupKey = getBlackbirdDedupKey(event);
    if (seen.has(dedupKey)) return false;
    seen.set(dedupKey, now);
    return true;
  }, [getBlackbirdDedupKey]);

  const triggerBlackbirdFx = useCallback((event: BlackbirdEvent) => {
    const now = Date.now();
    if (event.type === "seven_played") {
      if (now - recentSpecialCueRef.current.seven < 2200) {
        return;
      }
      const chain = event.drawChainCount ?? 0;
      if (chain >= 4) {
        // Escalation peak is handled by authoritative draw_chain FX path.
        return;
      }
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
      if (now - recentSpecialCueRef.current.ass < 2200) {
        return;
      }
      setAssFlash(true);
      setTimeout(() => setAssFlash(false), 420);
      return;
    }

    if (event.type === "unter") {
      if (now - recentSpecialCueRef.current.unter < 2200) {
        return;
      }
      setWishFxSuit(event.wishSuit);
      setWishFxKey((k) => k + 1);
      setShowWishFx(true);
      return;
    }

    if (event.type === "direction_shift") {
      if (now - recentSpecialCueRef.current.eight < 2200) {
        return;
      }
      setDiscardImpactIntensity(Math.min(4, Math.max(2, event.intensity ?? 3)) as 1 | 2 | 3 | 4 | 5);
      setDiscardImpactKey((k) => k + 1);
      setShowDiscardImpact(true);
      return;
    }

    if (event.type === "invalid") {
      setAssFlash(true);
      setTimeout(() => setAssFlash(false), 260);
      return;
    }

    if (event.type === "round_start") {
      setRoundGlowKey((k) => k + 1);
      setShowRoundGlow(true);
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

  const activateBlackbirdEvent = useCallback((event: BlackbirdEvent) => {
    showBlackbirdRef.current = true;
    if (blackbirdVisibilityGuardTimerRef.current) {
      clearTimeout(blackbirdVisibilityGuardTimerRef.current);
    }
    triggerBlackbirdFx(event);
    setBlackbirdEventId(event.id ?? `${event.type}-${event.startAt ?? Date.now()}`);
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
    blackbirdVisibilityGuardTimerRef.current = setTimeout(() => {
      blackbirdVisibilityGuardTimerRef.current = null;
      if (!showBlackbirdRef.current) return;
      // Safety valve: never let a stalled animation block the FX queue indefinitely.
      showBlackbirdRef.current = false;
      setShowBlackbird(false);
      setBlackbirdEventId(undefined);
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
      const active = activeGameFxRef.current;
      if (active?.type === "blackbird") {
        lastProcessedGameFxSequenceRef.current = Math.max(
          lastProcessedGameFxSequenceRef.current,
          active.sequence,
        );
        activeGameFxRef.current = null;
      }
      setTimeout(() => {
        processNextGameFxRef.current();
      }, 16);
    }, 10_000);
    if ((event.intensity ?? 0) >= 4 && event.type !== "loser") {
      playRoundEnd();
    }
    if (event.type === "loser") {
      playRoundEnd();
      setShowRoundStart(true);
      setTimeout(() => setShowRoundStart(false), 2000);
    }
  }, [playBlackbirdFeedback, playRoundEnd, triggerBlackbirdFx]);

  // Process next legacy blackbird event from queue
  const processNextBlackbird = useCallback(() => {
    if (showBlackbirdRef.current) return;
    if (blackbirdQueueRef.current.length === 0) return;
    const event = blackbirdQueueRef.current.shift()!;

    const delay = Math.max(0, (event.startAt ?? Date.now()) - Date.now());
    if (delay > 0) {
      if (blackbirdDelayTimerRef.current) {
        clearTimeout(blackbirdDelayTimerRef.current);
      }
      blackbirdDelayTimerRef.current = setTimeout(() => {
        blackbirdDelayTimerRef.current = null;
        activateBlackbirdEvent(event);
      }, delay);
    } else {
      activateBlackbirdEvent(event);
    }
  }, [activateBlackbirdEvent]);

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

  const showMomentBanner = useCallback((text: string, duration = 1800) => {
    setMomentBanner(text);
    if (momentBannerTimerRef.current) clearTimeout(momentBannerTimerRef.current);
    momentBannerTimerRef.current = setTimeout(() => {
      setMomentBanner(null);
      momentBannerTimerRef.current = null;
    }, duration);
  }, []);

  const triggerSpecialCardFx = useCallback((params: {
    rank: "7" | "ass" | "bube" | "8";
    wishSuit?: string;
    direction?: "clockwise" | "counterclockwise";
    drawChainCount?: number;
  }) => {
    setSpecialCardFxRank(params.rank);
    setSpecialCardFxWishSuit(params.wishSuit);
    setSpecialCardFxDirection(params.direction);
    setSpecialCardFxDrawChain(params.drawChainCount);
    setSpecialCardFxKey((prev) => prev + 1);
    setShowSpecialCardFx(true);
  }, []);

  const playBlackbirdForEvent = useCallback(
    (eventType?: "round_start" | "winner" | "loser" | "draw_chain" | "seven_played" | "direction_shift" | "ass" | "unter" | "invalid" | "mvp", intensity: 1 | 2 | 3 | 4 | 5 = 3) => {
      const now = Date.now();
      switch (eventType) {
        case "winner":
          playAmselSignature("WIN", intensity);
          return;
        case "loser":
          playAmselSignature("ELIMINATION", intensity);
          return;
        case "draw_chain":
          if (now - recentSpecialCueRef.current.drawChain < 1600) return;
          playDrawChainAlert(Math.max(2, blackbirdDrawChain ?? intensity));
          return;
        case "seven_played":
          if ((blackbirdDrawChain ?? 0) >= 4) return;
          if (now - recentSpecialCueRef.current.seven < 1600) return;
          playDrawChainAlert(Math.max(2, blackbirdDrawChain ?? intensity));
          return;
        case "ass":
          if (now - recentSpecialCueRef.current.ass < 1600) return;
          playAmselSignature("SPECIAL_A", intensity);
          return;
        case "unter":
          if (now - recentSpecialCueRef.current.unter < 1600) return;
          playAmselSignature("SPECIAL_U", intensity);
          return;
        case "direction_shift":
          if (now - recentSpecialCueRef.current.eight < 1600) return;
          playAmselSignature("SPECIAL_8", intensity);
          return;
        case "invalid":
          playAmselSignature("ERROR_INVALID", intensity);
          return;
        default:
          playBlackbird(intensity);
      }
    },
    [blackbirdDrawChain, playAmselSignature, playBlackbird, playDrawChainAlert],
  );

  const resolveDrawFxTarget = useCallback((playerId?: number) => {
    const fallback = { x: 0.5, y: 0.26, isSelf: false };
    const state = gameStateRef.current;
    if (!state || !playerId) return fallback;
    const me = state.players.find((p) => p.userId === user?.id);
    const target = state.players.find((p) => p.id === playerId);
    if (!me || !target) return fallback;

    const totalPlayers = Math.max(2, state.players.length);
    const mySeat = me.seatPosition ?? state.players.findIndex((p) => p.id === me.id);
    const targetSeat = target.seatPosition ?? state.players.findIndex((p) => p.id === target.id);
    const relativeSeat = ((targetSeat - mySeat) + totalPlayers) % totalPlayers;

    if (relativeSeat === 0) {
      return { x: 0.5, y: 0.8, isSelf: true };
    }

    const ringByOpponents: Record<number, Array<{ x: number; y: number }>> = {
      1: [{ x: 0.5, y: 0.24 }],
      2: [
        { x: 0.79, y: 0.52 },
        { x: 0.21, y: 0.52 },
      ],
      3: [
        { x: 0.79, y: 0.62 },
        { x: 0.5, y: 0.23 },
        { x: 0.21, y: 0.62 },
      ],
      4: [
        { x: 0.82, y: 0.65 },
        { x: 0.8, y: 0.4 },
        { x: 0.2, y: 0.4 },
        { x: 0.18, y: 0.65 },
      ],
    };
    const opponents = Math.max(1, totalPlayers - 1);
    const lane = ringByOpponents[Math.min(4, opponents)] ?? ringByOpponents[4];
    const laneIndex = Math.min(lane.length - 1, Math.max(0, relativeSeat - 1));
    return { ...lane[laneIndex], isSelf: false };
  }, [user?.id]);

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
    const state = gameStateRef.current;
    const seed = hashString(
      `${state?.roomId ?? "room"}:${state?.roundNumber ?? 0}:${state?.discardPile.length ?? 0}:${player.userId}:${normalized}`,
    );

    if (player.userId < 0) {
      const candidate = botLines[normalized];
      if (candidate?.length) {
        return pickBySeed(candidate, seed, 1);
      }
    }

    const generic = [
      `🔥 ${player.username}: Letzte Karte!`,
      `🔥 ${player.username} ist im Clutch! Nur noch eine Karte.`,
      `🔥 Matchpoint fur ${player.username}!`,
    ];
    return pickBySeed(generic, seed, 2);
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

  const completeActiveGameFx = useCallback((expectedId?: string) => {
    const active = activeGameFxRef.current;
    if (!active) return;
    if (expectedId && active.id !== expectedId) return;
    lastProcessedGameFxSequenceRef.current = Math.max(
      lastProcessedGameFxSequenceRef.current,
      active.sequence,
    );
    activeGameFxRef.current = null;
    setTimeout(() => {
      processNextGameFxRef.current();
    }, 16);
  }, []);

  const clearGameFxCompletionTimers = useCallback(() => {
    if (gameFxCompletionTimersRef.current.length === 0) return;
    gameFxCompletionTimersRef.current.forEach(clearTimeout);
    gameFxCompletionTimersRef.current = [];
  }, []);

  const scheduleGameFxCompletion = useCallback((eventId: string, delayMs: number) => {
    const timer = setTimeout(() => {
      gameFxCompletionTimersRef.current = gameFxCompletionTimersRef.current.filter((entry) => entry !== timer);
      completeActiveGameFx(eventId);
    }, delayMs);
    gameFxCompletionTimersRef.current.push(timer);
  }, [completeActiveGameFx]);

  const processNextGameFx = useCallback(() => {
    if (activeGameFxRef.current) return;
    if (showFlyingCard) return;
    if (showDrawFly) return;
    if (showBlackbirdRef.current) return;
    const next = gameFxQueueRef.current.shift();
    if (!next) return;

    const start = () => {
      gameFxTimerRef.current = null;
      const startDriftMs = getStartDriftMs(next);
      if (shouldWarnStartDrift(startDriftMs)) {
        const warnRef = gameFxPerfWarnRef.current;
        if (Date.now() - warnRef.driftAt > 1200) {
          warnRef.driftAt = Date.now();
          console.warn(
            `[game-fx] start drift high sequence=${next.sequence} type=${next.type} driftMs=${startDriftMs}`,
          );
        }
      }
      activeGameFxRef.current = next;
      switch (next.type) {
        case "card_play": {
          if (next.card) {
            const intensity = next.card.rank === "7" ? 4 : next.card.rank === "bube" || next.card.rank === "ass" ? 3 : 2;
            playCardPlay(intensity as 1 | 2 | 3 | 4 | 5);
            if (next.card.rank !== "7" && next.card.rank !== "ass" && next.card.rank !== "bube" && next.card.rank !== "8") {
              playAmselSignature("CARD_PLAY", 2);
            }
            lastAnimatedDiscardCardIdRef.current = next.card.id;
            setFlyingCard(next.card);
            setShowFlyingCard(true);
            trackRivalryFromPlay(next.playerId);
            return;
          }
          completeActiveGameFx(next.id);
          return;
        }
        case "draw_card": {
          const drawCount = Math.max(1, next.drawCount ?? 1);
          const drawTarget = resolveDrawFxTarget(next.playerId);
          playCardDraw(drawCount, drawTarget.isSelf);
          playAmselSignature("DRAW", drawCount >= 4 ? 3 : 2);
          setDrawFlyFx({
            targetX: drawTarget.x,
            targetY: drawTarget.y,
            drawCount,
            playerName: next.playerName,
          });
          setShowDrawFly(true);
          if (drawFlyFallbackTimerRef.current) {
            clearTimeout(drawFlyFallbackTimerRef.current);
          }
          drawFlyFallbackTimerRef.current = setTimeout(() => {
            drawFlyFallbackTimerRef.current = null;
            if (activeGameFxRef.current?.id === next.id) {
              setShowDrawFly(false);
              setDrawFlyFx(null);
              completeActiveGameFx(next.id);
            }
          }, 900);
          return;
        }
        case "special_card": {
          const cue = getGameFxCueSpec(next);
          if (next.specialRank === "7") {
            const chain = Math.max(2, next.drawChainCount ?? gameStateRef.current?.drawChainCount ?? 2);
            recentSpecialCueRef.current.seven = Date.now();
            playAmselSignature("SPECIAL_7", chain >= 5 ? 5 : chain >= 3 ? 4 : 3);
            playSpecialCardHaptic("7", chain);
            triggerSpecialCardFx({
              rank: "7",
              drawChainCount: chain,
            });
            showMomentBanner(`🂧 ${next.playerName || "Spieler"} startet die Ziehkette`, 1200);
            scheduleGameFxCompletion(next.id, cue.completionMs);
            return;
          }
          if (next.specialRank === "ass") {
            recentSpecialCueRef.current.ass = Date.now();
            playAmselSignature("SPECIAL_A", 4);
            playSpecialCardHaptic("ass");
            triggerSpecialCardFx({ rank: "ass" });
            setAssFlash(true);
            setTimeout(() => setAssFlash(false), 420);
            showMomentBanner(`🂡 ${next.playerName || "Spieler"} spielt Ass`, 1200);
            scheduleGameFxCompletion(next.id, cue.completionMs);
            return;
          }
          if (next.specialRank === "bube") {
            recentSpecialCueRef.current.unter = Date.now();
            playAmselSignature("SPECIAL_U", 4);
            playSpecialCardHaptic("bube");
            triggerSpecialCardFx({ rank: "bube", wishSuit: next.wishSuit });
            setWishFxSuit(next.wishSuit);
            setWishFxKey((k) => k + 1);
            setShowWishFx(true);
            showMomentBanner(
              `🂫 ${next.playerName || "Spieler"} wunscht ${next.wishSuit || "eine Farbe"}`,
              1400,
            );
            scheduleGameFxCompletion(next.id, cue.completionMs);
            return;
          }
          if (next.specialRank === "8") {
            recentSpecialCueRef.current.eight = Date.now();
            playAmselSignature("SPECIAL_8", 3);
            playSpecialCardHaptic("8");
            triggerSpecialCardFx({
              rank: "8",
              direction: next.direction ?? gameStateRef.current?.direction,
            });
            showMomentBanner(`🂨 ${next.playerName || "Spieler"} dreht die Richtung`, 1300);
            scheduleGameFxCompletion(next.id, cue.completionMs);
            return;
          }
          completeActiveGameFx(next.id);
          return;
        }
        case "draw_chain": {
          const cue = getGameFxCueSpec(next);
          const chain = Math.max(2, next.drawChainCount ?? 2);
          recentSpecialCueRef.current.drawChain = Date.now();
          playDrawChainAlert(chain);
          const intensity = chain >= 5 ? 5 : chain >= 4 ? 4 : chain >= 3 ? 3 : 2;
          setDiscardImpactIntensity(intensity as 1 | 2 | 3 | 4 | 5);
          setDiscardImpactKey((k) => k + 1);
          setShowDiscardImpact(true);
          showMomentBanner(`💥 Ziehkette x${chain}`, 1400);
          scheduleGameFxCompletion(next.id, cue.completionMs);
          return;
        }
        case "blackbird": {
          if (next.blackbird) {
            const now = Date.now();
            // Defensive dedupe: if escalation visuals just ran via authoritative
            // special_card/draw_chain FX, drop stale or duplicate draw_chain blackbird cues.
            if (
              next.blackbird.type === "draw_chain" &&
              now - recentSpecialCueRef.current.drawChain < 2500
            ) {
              completeActiveGameFx(next.id);
              return;
            }
            activateBlackbirdEvent(next.blackbird);
            return;
          }
          completeActiveGameFx(next.id);
          return;
        }
        case "turn_transition": {
          const cue = getGameFxCueSpec(next);
          const myTurn = next.userId === user?.id;
          playTurnShift(myTurn);
          if (myTurn && Platform.OS !== "web") {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          showMomentBanner(myTurn ? "🎯 Du bist am Zug" : `👉 ${next.playerName || "Spieler"} ist am Zug`, 850);
          scheduleGameFxCompletion(next.id, cue.completionMs);
          return;
        }
        case "elimination": {
          const plan = getGameFxUiPlan(next);
          if (plan?.sound === "elimination") {
            playAmselSignature("ELIMINATION", 5);
          }
          if (plan?.banner) {
            showMomentBanner(plan.banner, plan.bannerDurationMs);
          }
          scheduleGameFxCompletion(next.id, plan?.completionMs ?? getGameFxCueSpec(next).completionMs);
          return;
        }
        case "round_transition": {
          const cue = getGameFxCueSpec(next);
          playRoundTransition();
          setRoundGlowKey((k) => k + 1);
          setShowRoundGlow(true);
          showMomentBanner(`🎮 Runde ${next.roundNumber ?? "?"} startet`, 1400);
          scheduleGameFxCompletion(next.id, cue.completionMs);
          return;
        }
        case "match_result": {
          const plan = getGameFxUiPlan(next);
          if (plan?.banner) {
            showMomentBanner(plan.banner, plan.bannerDurationMs);
          }
          if (plan?.sound === "victory") {
            playAmselSignature("WIN", 5);
          }
          scheduleGameFxCompletion(next.id, plan?.completionMs ?? getGameFxCueSpec(next).completionMs);
          return;
        }
        default: {
          completeActiveGameFx(next.id);
        }
      }
    };

    const delay = Math.max(0, (next.startAt ?? Date.now()) - Date.now());
    if (delay > 0) {
      if (gameFxTimerRef.current) clearTimeout(gameFxTimerRef.current);
      gameFxTimerRef.current = setTimeout(start, delay);
      return;
    }
    start();
  }, [
    activateBlackbirdEvent,
    completeActiveGameFx,
    playCardDraw,
    playCardPlay,
    playDrawChainAlert,
    playRoundTransition,
    playSpecialCardHaptic,
    playTurnShift,
    playAmselSignature,
    resolveDrawFxTarget,
    scheduleGameFxCompletion,
    showDrawFly,
    showFlyingCard,
    showMomentBanner,
    trackRivalryFromPlay,
    triggerSpecialCardFx,
    user?.id,
  ]);

  useEffect(() => {
    processNextGameFxRef.current = processNextGameFx;
  }, [processNextGameFx]);

  const enqueueUnifiedGameFx = useCallback((event: GameFxEvent) => {
    if (!event?.id) return;
    if (!hasUnifiedGameFxRef.current) {
      hasUnifiedGameFxRef.current = true;
      // Drop legacy queue to avoid race duplicates between legacy and unified streams.
      blackbirdQueueRef.current = [];
      if (blackbirdDelayTimerRef.current) {
        clearTimeout(blackbirdDelayTimerRef.current);
        blackbirdDelayTimerRef.current = null;
      }
    }
    if (event.type === "blackbird" && event.blackbird && !shouldProcessBlackbirdEvent(event.blackbird)) {
      return;
    }
    const seen = seenGameFxRef.current;
    const now = Date.now();
    for (const [id, at] of seen.entries()) {
      if (now - at > 25_000) seen.delete(id);
    }
    if (seen.has(event.id)) return;
    if (event.sequence <= lastProcessedGameFxSequenceRef.current) return;
    const highestSeenSequence = Math.max(
      lastProcessedGameFxSequenceRef.current,
      highestQueuedGameFxSequenceRef.current,
    );
    if (!event.replay && event.sequence > highestSeenSequence + 1) {
      console.warn(
        `[game-fx] Sequence gap detected roomId=${event.roomId} expected>${highestSeenSequence} got=${event.sequence}. Trigger recover.`,
      );
      void recoverSessionRef.current?.();
    }
    seen.set(event.id, now);

    gameFxQueueRef.current.push(event);
    gameFxQueueRef.current.sort((a, b) => {
      if (a.sequence !== b.sequence) return a.sequence - b.sequence;
      return (a.startAt ?? 0) - (b.startAt ?? 0);
    });
    const queueDepth = gameFxQueueRef.current.length;
    if (shouldWarnQueueDepth(queueDepth)) {
      const warnRef = gameFxPerfWarnRef.current;
      if (now - warnRef.depthAt > 1200) {
        warnRef.depthAt = now;
        console.warn(`[game-fx] queue depth high roomId=${event.roomId} depth=${queueDepth}`);
      }
    }
    const queueLagMs = getQueueLagMs(event, now);
    if (shouldWarnQueueLag(queueLagMs)) {
      const warnRef = gameFxPerfWarnRef.current;
      if (now - warnRef.lagAt > 1200) {
        warnRef.lagAt = now;
        console.warn(
          `[game-fx] queue lag high roomId=${event.roomId} sequence=${event.sequence} lagMs=${queueLagMs}`,
        );
      }
    }
    highestQueuedGameFxSequenceRef.current = Math.max(
      highestQueuedGameFxSequenceRef.current,
      event.sequence,
    );
    processNextGameFxRef.current();
  }, [shouldProcessBlackbirdEvent]);

  useEffect(() => {
    if (showBlackbird || showDrawFly || showFlyingCard || showSpecialCardFx) return;
    if (!activeGameFxRef.current) {
      processNextGameFxRef.current();
    }
    if (!hasUnifiedGameFxRef.current && blackbirdQueueRef.current.length > 0 && !showBlackbirdRef.current) {
      processNextBlackbird();
    }
  }, [showBlackbird, showDrawFly, showFlyingCard, showSpecialCardFx, processNextBlackbird]);

  const {
    isConnected,
    gameState: socketGameState,
    chatMessages,
    unreadCount,
    sendAction,
    sendChatMessage,
    sendReaction,
    markChatRead,
    markChatClosed,
    sendPreparationDone,
    chooseSeat,
    recoverSession,
    setOnPreparation,
    setOnBlackbirdEvent,
    setOnCardPlayFx,
    setOnDrawCardFx,
    setOnGameFx,
    setOnReactionEvent,
    setOnError,
  } = useSocket();
  const expectedRoomCode = (code || "").trim().toUpperCase();
  const gameState =
    socketGameState && expectedRoomCode && socketGameState.roomCode.toUpperCase() !== expectedRoomCode
      ? null
      : socketGameState;
  const currentPlayer = gameState?.players.find((p) => p.userId === user?.id);

  useEffect(() => {
    recoverSessionRef.current = recoverSession;
  }, [recoverSession]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const roomId = gameState?.roomId ?? null;
    if (activeGameFxRoomIdRef.current === roomId) return;
    activeGameFxRoomIdRef.current = roomId;
    hasUnifiedGameFxRef.current = false;
    gameFxQueueRef.current = [];
    blackbirdQueueRef.current = [];
    activeGameFxRef.current = null;
    seenBlackbirdEventsRef.current.clear();
    showBlackbirdRef.current = false;
    setShowBlackbird(false);
    setShowDrawFly(false);
    setDrawFlyFx(null);
    setShowSpecialCardFx(false);
    setSpecialCardFxRank(undefined);
    setSpecialCardFxWishSuit(undefined);
    setSpecialCardFxDirection(undefined);
    setSpecialCardFxDrawChain(undefined);
    setShowReactionPicker(false);
    setActiveReactions([]);
    setReactionCooldownActive(false);
    setSelectedReactionTargetUserId(null);
    seenReactionEventIdsRef.current.clear();
    lastReactionAmselCueAtRef.current = 0;
    pendingManualAmselEventsRef.current = [];
    pendingReactionEventsRef.current = [];
    seenGameFxRef.current.clear();
    lastProcessedGameFxSequenceRef.current = 0;
    highestQueuedGameFxSequenceRef.current = 0;
    if (gameFxTimerRef.current) {
      clearTimeout(gameFxTimerRef.current);
      gameFxTimerRef.current = null;
    }
    if (drawFlyFallbackTimerRef.current) {
      clearTimeout(drawFlyFallbackTimerRef.current);
      drawFlyFallbackTimerRef.current = null;
    }
    if (blackbirdDelayTimerRef.current) {
      clearTimeout(blackbirdDelayTimerRef.current);
      blackbirdDelayTimerRef.current = null;
    }
    if (blackbirdNextTimerRef.current) {
      clearTimeout(blackbirdNextTimerRef.current);
      blackbirdNextTimerRef.current = null;
    }
    if (blackbirdVisibilityGuardTimerRef.current) {
      clearTimeout(blackbirdVisibilityGuardTimerRef.current);
      blackbirdVisibilityGuardTimerRef.current = null;
    }
    if (reactionCooldownTimerRef.current) {
      clearTimeout(reactionCooldownTimerRef.current);
      reactionCooldownTimerRef.current = null;
    }
    reactionExpiryTimersRef.current.forEach((timer) => clearTimeout(timer));
    reactionExpiryTimersRef.current.clear();
    const now = Date.now();
    pendingGameFxRef.current = pendingGameFxRef.current.filter(
      (event) => now - event.emittedAt <= 15_000,
    );
    clearGameFxCompletionTimers();
  }, [gameState?.roomId, clearGameFxCompletionTimers]);

  useEffect(() => {
    const roomId = gameState?.roomId;
    if (!roomId || pendingGameFxRef.current.length === 0) return;

    const now = Date.now();
    const flush: GameFxEvent[] = [];
    const keep: GameFxEvent[] = [];
    for (const event of pendingGameFxRef.current) {
      if (now - event.emittedAt > 15_000) continue;
      if (event.roomId === roomId) {
        flush.push(event);
      } else {
        keep.push(event);
      }
    }
    pendingGameFxRef.current = keep;
    if (flush.length === 0) return;
    flush.sort((a, b) => {
      if (a.sequence !== b.sequence) return a.sequence - b.sequence;
      return (a.startAt ?? 0) - (b.startAt ?? 0);
    });
    flush.forEach((event) => enqueueUnifiedGameFx(event));
  }, [gameState?.roomId, enqueueUnifiedGameFx]);

  const consumeReactionEvent = useCallback((event: ReactionEvent) => {
    const now = Date.now();
    const seen = seenReactionEventIdsRef.current;
    for (const [id, at] of seen.entries()) {
      if (now - at > 25_000) {
        seen.delete(id);
      }
    }
    const canonicalId = event.id ? event.id.replace(/-replay-[^-]+-\d+$/, "") : "";
    if (canonicalId && seen.has(canonicalId)) {
      return;
    }
    if (canonicalId) {
      seen.set(canonicalId, now);
    }

    const localKey = String(event.userId);
    const ttlMs = Math.max(320, Math.min(2_500, (event.expiresAt ?? Date.now() + 1_600) - Date.now()));

    const existingTimer = reactionExpiryTimersRef.current.get(localKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      reactionExpiryTimersRef.current.delete(localKey);
    }

    setActiveReactions((prev) => {
      const now = Date.now();
      const remaining = prev.filter((entry) => entry.localKey !== localKey && entry.expiresAt > now);
      return [...remaining, { ...event, localKey }].slice(-8);
    });

    const removeTimer = setTimeout(() => {
      reactionExpiryTimersRef.current.delete(localKey);
      setActiveReactions((prev) => prev.filter((entry) => entry.localKey !== localKey));
    }, ttlMs);
    reactionExpiryTimersRef.current.set(localKey, removeTimer);

    if (event.replay) {
      return;
    }

    const isPeakSocialEvent =
      event.source === "special_7" ||
      event.source === "special_ass" ||
      event.source === "elimination" ||
      event.source === "win";
    const isManualTargeted = event.source === "manual" && Boolean(event.targetUsername);

    if ((isPeakSocialEvent || isManualTargeted) && event.targetUsername) {
      if (loserPulseTimerRef.current) {
        clearTimeout(loserPulseTimerRef.current);
      }
      setLoserPulseName(event.targetUsername);
      loserPulseTimerRef.current = setTimeout(() => {
        setLoserPulseName(undefined);
        loserPulseTimerRef.current = null;
      }, isPeakSocialEvent ? 1_050 : 820);
      if (momentBannerTimerRef.current) {
        clearTimeout(momentBannerTimerRef.current);
      }
      setMomentBanner(`${isPeakSocialEvent ? "🐦" : event.emoji} ${event.username} → ${event.targetUsername}`);
      momentBannerTimerRef.current = setTimeout(() => {
        setMomentBanner(null);
        momentBannerTimerRef.current = null;
      }, isPeakSocialEvent ? 950 : 760);
    }

    if (
      isManualTargeted &&
      Date.now() - lastReactionAmselCueAtRef.current > 1_350
    ) {
      lastReactionAmselCueAtRef.current = Date.now();
      const manualIntensity: 1 | 2 | 3 = event.emoji === "⚡" || event.emoji === "😈" || event.emoji === "🐦" ? 3 : 2;
      const manualVariant =
        event.emoji === "😈"
          ? "taunt"
          : event.emoji === "😤"
            ? "pressure"
            : event.emoji === "😂"
              ? "laugh"
              : event.emoji === "👀"
                ? "focus"
                : event.emoji === "⚡"
                  ? "impact"
                  : "social";
      const socialAmselEvent: BlackbirdEvent = {
        type: "mvp",
        intensity: manualIntensity,
        startAt: Date.now(),
        spotlightUserId: event.targetUserId,
        spotlightPlayerName: event.targetUsername,
        phrase: `${event.emoji} ${event.username} vs ${event.targetUsername}`,
        statsText: "Spieler-Reaktion",
        variant: manualVariant,
      };
      if (showBlackbirdRef.current) {
        // Preserve social visibility: queue social Amsel cues while a peak FX is active.
        pendingManualAmselEventsRef.current.push(socialAmselEvent);
        if (pendingManualAmselEventsRef.current.length > 4) {
          pendingManualAmselEventsRef.current = pendingManualAmselEventsRef.current.slice(-4);
        }
      } else {
        activateBlackbirdEvent(socialAmselEvent);
      }
    }

    if (event.source === "special_7") {
      playAmselSignature("SPECIAL_7", 3);
      return;
    }
    if (event.source === "special_ass") {
      playAmselSignature("SPECIAL_A", 3);
      return;
    }
    if (event.source === "elimination") {
      playAmselSignature("ELIMINATION", 3);
      return;
    }
    if (event.source === "win") {
      playAmselSignature("WIN", 3);
      return;
    }
    if (event.source === "manual") {
      playAmselSignature("CARD_PLAY", event.emoji === "⚡" || event.emoji === "😈" ? 3 : 2);
    }
  }, [activateBlackbirdEvent, playAmselSignature]);

  useEffect(() => {
    if (showBlackbird) return;
    const pending = pendingManualAmselEventsRef.current.shift();
    if (!pending) return;
    activateBlackbirdEvent({
      ...pending,
      startAt: Date.now(),
    });
  }, [activateBlackbirdEvent, showBlackbird]);

  useEffect(() => {
    const roomId = gameState?.roomId;
    if (!roomId || pendingReactionEventsRef.current.length === 0) return;
    const now = Date.now();
    const flush: ReactionEvent[] = [];
    const keep: ReactionEvent[] = [];
    for (const event of pendingReactionEventsRef.current) {
      if (now - event.createdAt > 15_000) continue;
      if (event.roomId === roomId) {
        flush.push(event);
      } else {
        keep.push(event);
      }
    }
    pendingReactionEventsRef.current = keep;
    flush.sort((a, b) => a.createdAt - b.createdAt);
    flush.forEach((event) => consumeReactionEvent(event));
  }, [consumeReactionEvent, gameState?.roomId]);

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
    setOnGameFx((event: GameFxEvent) => {
      if (!event?.id) return;
      const currentState = gameStateRef.current;
      if (!currentState) {
        const now = Date.now();
        pendingGameFxRef.current.push(event);
        pendingGameFxRef.current = pendingGameFxRef.current
          .filter((entry) => now - entry.emittedAt <= 15_000)
          .slice(-120);
        return;
      }
      if (event.roomId !== currentState.roomId) {
        return;
      }
      enqueueUnifiedGameFx(event);
    });
    setOnBlackbirdEvent((event: BlackbirdEvent) => {
      if (hasUnifiedGameFxRef.current) return;
      if (!shouldProcessBlackbirdEvent(event)) return;
      blackbirdQueueRef.current.push(event);
      if (!showBlackbirdRef.current) {
        processNextBlackbird();
      }
    });
    setOnCardPlayFx((event: CardPlayFxEvent) => {
      if (hasUnifiedGameFxRef.current) return;
      enqueueCardPlayFx(event);
      trackRivalryFromPlay(event.playerId);
    });
    setOnDrawCardFx((event: DrawCardFxEvent) => {
      if (hasUnifiedGameFxRef.current) return;
      const delay = Math.max(0, (event.startAt ?? Date.now()) - Date.now());
      setTimeout(() => {
        const drawCount = Math.max(1, event.drawCount ?? 1);
        const target = resolveDrawFxTarget(event.playerId);
        playCardDraw(drawCount, target.isSelf);
      }, delay);
    });
    setOnReactionEvent((event: ReactionEvent) => {
      const currentState = gameStateRef.current;
      if (!currentState) {
        const now = Date.now();
        pendingReactionEventsRef.current.push(event);
        pendingReactionEventsRef.current = pendingReactionEventsRef.current
          .filter((entry) => now - entry.createdAt <= 15_000)
          .slice(-80);
        return;
      }
      if (event.roomId !== currentState.roomId) return;
      consumeReactionEvent(event);
    });
    setOnError((error: string) => {
      if (/Karte passt nicht|gleiche Farbe oder Rang erforderlich|Ungültiger Zug|Ungueltiger Zug|Invalid move|not playable/i.test(error)) {
        // Keep gameplay fluid: these are expected server-side validations in race conditions.
        const now = Date.now();
        if (now - lastInvalidBlackbirdAtRef.current > 1_800) {
          lastInvalidBlackbirdAtRef.current = now;
          activateBlackbirdEvent({
            type: "invalid",
            intensity: 1,
            phrase: "Nicht spielbar.",
            startAt: now,
          });
        } else {
          playInvalidAction();
        }
        setShowFlyingCard(false);
        setFlyingCard(null);
        const activeFx = activeGameFxRef.current;
        if (activeFx?.type === "card_play") {
          completeActiveGameFx(activeFx.id);
        }
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
      setOnGameFx(null);
      setOnBlackbirdEvent(null);
      setOnCardPlayFx(null);
      setOnDrawCardFx(null);
      setOnReactionEvent(null);
      setOnError(null);
    };
  }, [
    setOnPreparation,
    setOnGameFx,
    setOnBlackbirdEvent,
    setOnCardPlayFx,
    setOnDrawCardFx,
    setOnReactionEvent,
    setOnError,
    processNextBlackbird,
    enqueueCardPlayFx,
    trackRivalryFromPlay,
    playCardDraw,
    consumeReactionEvent,
    resolveDrawFxTarget,
    completeActiveGameFx,
    playInvalidAction,
    activateBlackbirdEvent,
    shouldProcessBlackbirdEvent,
    recoverSession,
    enqueueUnifiedGameFx,
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

  useEffect(() => {
    if (!gameState || !currentPlayer) {
      setSelectedReactionTargetUserId(null);
      return;
    }
    const availableTargets = gameState.players.filter(
      (player) => !player.isEliminated && player.userId !== currentPlayer.userId,
    );
    if (availableTargets.length === 0) {
      setSelectedReactionTargetUserId(null);
      return;
    }
    const currentlyValid = availableTargets.some((player) => player.userId === selectedReactionTargetUserId);
    if (currentlyValid) return;

    const turnUserId = gameState.players[gameState.currentPlayerIndex]?.userId;
    const preferred =
      typeof turnUserId === "number" && turnUserId !== currentPlayer.userId
        ? turnUserId
        : availableTargets[0].userId;
    setSelectedReactionTargetUserId(preferred);
  }, [
    gameState,
    currentPlayer,
    selectedReactionTargetUserId,
  ]);

  const handleOpenChat = () => {
    setShowReactionPicker(false);
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

  const handleSendReaction = useCallback((emoji: ReactionEmoji) => {
    if (!gameState || !currentPlayer || reactionCooldownActive) return;
    const availableTargets = gameState.players.filter(
      (player) => !player.isEliminated && player.userId !== currentPlayer.userId,
    );
    const selectedTargetIsValid =
      selectedReactionTargetUserId != null &&
      availableTargets.some((player) => player.userId === selectedReactionTargetUserId);
    const targetUserId = selectedTargetIsValid
      ? selectedReactionTargetUserId ?? undefined
      : (availableTargets.find((player) => player.userId === gameState.players[gameState.currentPlayerIndex]?.userId)?.userId
          ?? availableTargets[0]?.userId);
    sendReaction(gameState.roomId, emoji, targetUserId);
    setShowReactionPicker(false);
    setReactionCooldownActive(true);
    if (reactionCooldownTimerRef.current) {
      clearTimeout(reactionCooldownTimerRef.current);
    }
    reactionCooldownTimerRef.current = setTimeout(() => {
      reactionCooldownTimerRef.current = null;
      setReactionCooldownActive(false);
    }, 1_150);
  }, [currentPlayer, gameState, reactionCooldownActive, selectedReactionTargetUserId, sendReaction]);

  const isMyTurn = Boolean(gameState && currentPlayer && gameState.players[gameState.currentPlayerIndex]?.id === currentPlayer.id);
  const playableCardIds = new Set(gameState?.playableCardIds ?? []);
  const playableCount = gameState && currentPlayer
    ? getPlayableCount({
        state: gameState,
        currentPlayer,
        isMyTurn,
      })
    : 0;
  const decisionPills = gameState && currentPlayer
    ? getGamePriorityPills({
        state: gameState,
        currentPlayer,
        isMyTurn,
      })
    : [];
  const hasNoPlayableCards = isMyTurn && playableCount === 0;
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
      playInvalidAction();
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
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
    if (hasUnifiedGameFxRef.current) return;
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

  useEffect(() => {
    if (hasUnifiedGameFxRef.current) return;
    if (!gameState || gameState.phase !== "playing") {
      lastTurnCueRef.current = "";
      return;
    }
    const turnPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!turnPlayer) return;
    const cueKey = `${gameState.roomId}:${gameState.roundNumber}:${gameState.currentPlayerIndex}:${gameState.discardPile.length}`;
    if (!lastTurnCueRef.current) {
      lastTurnCueRef.current = cueKey;
      return;
    }
    if (lastTurnCueRef.current === cueKey) return;
    lastTurnCueRef.current = cueKey;

    const myTurn = turnPlayer.userId === user?.id;
    playTurnShift(myTurn);
    if (myTurn && Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    showMomentBanner(myTurn ? "🎯 Du bist am Zug" : `👉 ${turnPlayer.username} ist am Zug`, 900);
  }, [
    gameState?.roomId,
    gameState?.phase,
    gameState?.roundNumber,
    gameState?.currentPlayerIndex,
    gameState?.discardPile.length,
    gameState?.players,
    playTurnShift,
    showMomentBanner,
    user?.id,
  ]);

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
  const reactionTargetPlayers = gameState.players.filter(
    (player) => !player.isEliminated && player.userId !== currentPlayer.userId,
  );
  const reactionAutoTarget = (() => {
    const turnUserId = gameState.players[gameState.currentPlayerIndex]?.userId;
    if (typeof turnUserId === "number" && turnUserId !== currentPlayer.userId) {
      const turnTarget = reactionTargetPlayers.find((player) => player.userId === turnUserId);
      if (turnTarget) return turnTarget;
    }
    return reactionTargetPlayers[0];
  })();
  const selectedReactionTarget =
    selectedReactionTargetUserId == null
      ? reactionAutoTarget
      : reactionTargetPlayers.find((player) => player.userId === selectedReactionTargetUserId) ?? reactionAutoTarget;
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
  const now = Date.now();
  const visibleReactions = activeReactions.filter((reaction) => reaction.expiresAt > now);
  const reactionsBySenderId = new Map<number, ActiveReaction>();
  const reactionTargetsByPlayerId = new Map<number, ActiveReaction>();
  for (const reaction of visibleReactions) {
    if (typeof reaction.playerId === "number") {
      reactionsBySenderId.set(reaction.playerId, reaction);
    }
    if (typeof reaction.targetPlayerId === "number") {
      reactionTargetsByPlayerId.set(reaction.targetPlayerId, reaction);
    }
  }
  const currentPlayerReaction = reactionsBySenderId.get(currentPlayer.id);
  const currentPlayerTargetedReaction = reactionTargetsByPlayerId.get(currentPlayer.id);
  const wishSuitLabel = gameState.currentWishSuit
    ? `${gameState.currentWishSuit === "eichel" ? "🌰 Eichel" : gameState.currentWishSuit === "gruen" ? "🍀 Grün" : gameState.currentWishSuit === "rot" ? "❤️ Rot" : "🔔 Schellen"} oder Unter`
    : "";
  const pillPalette: Record<string, { bg: string; border: string; text: string }> = {
    success: {
      bg: "rgba(26, 110, 70, 0.86)",
      border: "rgba(90, 230, 160, 0.9)",
      text: "#E9FFF4",
    },
    warning: {
      bg: "rgba(120, 72, 14, 0.9)",
      border: "rgba(255, 196, 87, 0.9)",
      text: "#FFF3D6",
    },
    danger: {
      bg: "rgba(120, 26, 26, 0.9)",
      border: "rgba(255, 110, 110, 0.9)",
      text: "#FFE8E8",
    },
    neutral: {
      bg: "rgba(16, 26, 34, 0.9)",
      border: "rgba(128, 164, 191, 0.65)",
      text: "#E3EEF7",
    },
  };
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
  const handPanelBottom = Math.max(2, insets.bottom - 2);
  const getRoundStartCards = (lossPoints: number) => Math.max(1, lossPoints + 1);
  const hasActivePriorityFx = showBlackbird || showDrawFly || showFlyingCard || showWishFx || showRoundGlow || showSpecialCardFx;
  const showSecondaryBanners = shouldShowSecondaryGameBanner({
    isCompactHeight,
    drawChainCount: gameState.drawChainCount,
    hasWishSuit: Boolean(gameState.currentWishSuit),
    hasNoPlayableCards,
    hasActiveFx: hasActivePriorityFx,
  });
  const showClutchOrRivalryBanner = showSecondaryBanners && Boolean(clutchBanner || rivalryBanner);
  const showMomentStatusBanner = showSecondaryBanners && Boolean(momentBanner);

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
        imageStyle={{ opacity: 0.03, tintColor: "#DDEBDF" }}
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
          opacity: hasActivePriorityFx ? 0.04 : 0.08,
        }}
      >
        <Image
          source={require("@/assets/images/acid-mau-logo.png")}
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
          backgroundColor: "rgba(80,200,120,0.09)",
          borderRadius: 9999,
          shadowColor: "#66D092",
          shadowOpacity: 0.08,
          shadowRadius: 70,
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
                    backgroundColor: isMyTurn ? DESIGN.accentPrimary : "rgba(19, 30, 40, 0.95)",
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 7,
                    marginLeft: 8,
                    borderWidth: 1.2,
                    borderColor: isMyTurn ? "rgba(255, 186, 94, 0.95)" : "rgba(141, 171, 194, 0.52)",
                    shadowColor: isMyTurn ? "#ff9d1a" : "#0b1722",
                    shadowOpacity: isMyTurn ? 0.35 : 0.2,
                    shadowRadius: isMyTurn ? 16 : 10,
                    elevation: isMyTurn ? 8 : 4,
                  },
                  isMyTurn ? turnChipPulseStyle : null,
                ]}
              >
                <Animated.View
                  style={[
                    {
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: isMyTurn ? "#fff" : "rgba(171, 196, 215, 0.85)",
                    },
                    isMyTurn ? pulseStyle : null,
                  ]}
                />
                <PlayerAvatar
                  name={currentTurnPlayer?.username ?? "-"}
                  avatarUrl={currentTurnPlayer?.avatarUrl}
                  active={isMyTurn}
                  isBot={Boolean(currentTurnPlayer?.userId != null && currentTurnPlayer.userId < 0)}
                  size={34}
                />
                <View style={{ marginRight: 4 }}>
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14, letterSpacing: 0.2 }}>
                    {isMyTurn ? "DEIN ZUG" : (currentTurnPlayer?.username ?? "-")}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.84)", fontWeight: "700", fontSize: 11 }}>
                    {isMyTurn ? "Karte spielen oder ziehen" : "ist jetzt am Zug"}
                  </Text>
                </View>
                <View
                  style={{
                    marginLeft: 2,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.24)",
                    backgroundColor: "rgba(8, 15, 22, 0.42)",
                    paddingHorizontal: 7,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ color: "rgba(255,255,255,0.96)", fontWeight: "800", fontSize: 11 }}>
                    R{gameState.roundNumber}
                  </Text>
                  <Text style={{ color: "rgba(224,240,252,0.86)", fontWeight: "700", fontSize: 10 }}>
                    {gameState.players.length}/{gameState.maxPlayers ?? gameState.players.length}
                  </Text>
                </View>
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
              <View style={{ position: "absolute", right: 10, top: 10, alignItems: "flex-end", gap: 8 }}>
                <View style={{ flexDirection: "row", gap: 10 }}>
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
                      accessibilityRole="button"
                      accessibilityLabel="Runde neu starten"
                      accessibilityHint="Startet die aktuelle Runde neu und behält Verlustpunkte."
                      style={({ pressed }) => ({
                        minWidth: 88,
                        height: 40,
                        borderRadius: 14,
                        backgroundColor: pressed ? "rgba(255,157,26,0.34)" : "rgba(10, 19, 28, 0.85)",
                        borderWidth: 1.2,
                        borderColor: "rgba(255,157,26,0.8)",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 10,
                      })}
                    >
                      <Text style={{ color: "#FFD89A", fontSize: 12, fontWeight: "800" }}>Runde neu</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => setShowReactionPicker((prev) => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel="Reaktionen öffnen"
                    accessibilityHint="Schnelle Reaktion an alle Spieler senden."
                    style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: pressed ? "rgba(60,120,95,0.92)" : "rgba(10, 19, 28, 0.85)",
                      borderWidth: 1.2,
                      borderColor: "rgba(110, 240, 175, 0.55)",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: reactionCooldownActive ? 0.56 : 1,
                    })}
                    disabled={reactionCooldownActive}
                  >
                    <Text style={{ fontSize: 16 }}>⚡</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleOpenChat}
                    accessibilityRole="button"
                    accessibilityLabel="Chat öffnen"
                    accessibilityHint="Öffnet den Raum-Chat."
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
                    {unreadCount > 0 && (
                      <View
                        style={{
                          position: "absolute",
                          top: -4,
                          right: -2,
                          minWidth: 16,
                          height: 16,
                          borderRadius: 8,
                          backgroundColor: "#DC2626",
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.8)",
                          alignItems: "center",
                          justifyContent: "center",
                          paddingHorizontal: 3,
                        }}
                      >
                        <Text style={{ color: "#FFF", fontSize: 9, fontWeight: "800" }}>{Math.min(99, unreadCount)}</Text>
                      </View>
                    )}
                  </Pressable>
                </View>

                {showReactionPicker && (
                  <View
                    style={{
                      gap: 8,
                      maxWidth: 236,
                      backgroundColor: "rgba(6, 16, 24, 0.96)",
                      borderWidth: 1,
                      borderColor: "rgba(100, 220, 165, 0.42)",
                      borderRadius: 14,
                      paddingHorizontal: 8,
                      paddingVertical: 8,
                    }}
                  >
                    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 6 }}>
                      <Pressable
                        onPress={() => setSelectedReactionTargetUserId(null)}
                        style={({ pressed }) => ({
                          minHeight: 24,
                          borderRadius: 999,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderWidth: 1,
                          borderColor: selectedReactionTargetUserId == null ? "rgba(255, 209, 126, 0.9)" : "rgba(142, 181, 208, 0.45)",
                          backgroundColor:
                            selectedReactionTargetUserId == null
                              ? "rgba(123, 77, 24, 0.92)"
                              : (pressed ? "rgba(33, 56, 70, 0.92)" : "rgba(19, 33, 42, 0.88)"),
                        })}
                      >
                        <Text style={{ color: "#F6EDD8", fontSize: 10, fontWeight: "800" }}>AUTO</Text>
                      </Pressable>
                      {reactionTargetPlayers.map((player) => (
                        <Pressable
                          key={player.id}
                          onPress={() => setSelectedReactionTargetUserId(player.userId)}
                          style={({ pressed }) => ({
                            minHeight: 24,
                            borderRadius: 999,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderWidth: 1,
                            borderColor:
                              selectedReactionTargetUserId === player.userId
                                ? "rgba(255, 209, 126, 0.9)"
                                : "rgba(142, 181, 208, 0.45)",
                            backgroundColor:
                              selectedReactionTargetUserId === player.userId
                                ? "rgba(123, 77, 24, 0.92)"
                                : (pressed ? "rgba(33, 56, 70, 0.92)" : "rgba(19, 33, 42, 0.88)"),
                          })}
                        >
                          <Text style={{ color: "#E5F6FF", fontSize: 10, fontWeight: "800" }}>
                            {player.username.slice(0, 8)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={{ color: "#BDE7D1", fontSize: 10, fontWeight: "700", textAlign: "right", paddingRight: 2 }}>
                      Ziel: {selectedReactionTarget?.username ?? "kein Ziel"}
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 6 }}>
                    {QUICK_REACTIONS.map((reaction) => (
                      <Pressable
                        key={reaction.emoji}
                        onPress={() => handleSendReaction(reaction.emoji)}
                        style={({ pressed }) => ({
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          backgroundColor: pressed ? "rgba(72, 153, 112, 0.45)" : "rgba(19, 33, 42, 0.88)",
                          borderWidth: 1,
                          borderColor: "rgba(156, 239, 197, 0.45)",
                          alignItems: "center",
                          justifyContent: "center",
                        })}
                        accessibilityRole="button"
                        accessibilityLabel={`Reaktion ${reaction.label}`}
                      >
                        <Text style={{ fontSize: 18 }}>{reaction.emoji}</Text>
                      </Pressable>
                    ))}
                    </View>
                  </View>
                )}
              </View>
            </View>

            <View style={{ marginTop: 12, marginBottom: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {decisionPills.map((pill) => {
                const palette = pillPalette[pill.tone] ?? pillPalette.neutral;
                return (
                  <View
                    key={pill.key}
                    style={{
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: palette.border,
                      backgroundColor: palette.bg,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: palette.text, fontSize: 12, fontWeight: "800" }}>
                      {pill.label}
                    </Text>
                  </View>
                );
              })}
            </View>
            {gameState.currentWishSuit && (
              <Text style={{ color: "rgba(226, 244, 236, 0.9)", fontSize: 11, fontWeight: "700", marginTop: -3, marginBottom: 6 }}>
                Aktiv: {wishSuitLabel}
              </Text>
            )}
            {showClutchOrRivalryBanner && (
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
                    <Text style={{ color: "#FFD89A", fontWeight: "800", fontSize: 12 }}>{clutchBanner}</Text>
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
                    <Text style={{ color: "#FFB3B3", fontWeight: "800", fontSize: 12 }}>{rivalryBanner}</Text>
                  </View>
                )}
              </View>
            )}
            {showMomentStatusBanner && (
              <View style={{ alignItems: "center", marginTop: 6, marginBottom: 6 }}>
                <View
                  style={{
                    backgroundColor: "rgba(8, 15, 24, 0.95)",
                    borderWidth: 1,
                    borderColor: "rgba(90, 240, 170, 0.8)",
                    borderRadius: 13,
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                  }}
                >
                  <Text style={{ color: "#E6FFF3", fontWeight: "800", fontSize: 12 }}>{momentBanner}</Text>
                </View>
              </View>
            )}

            <View style={{ height: arenaHeight, marginTop: isCompactHeight ? 16 : 20, marginBottom: isCompactHeight ? 2 : 4, position: "relative" }}>
              <RoundStartGlow
                visible={showRoundGlow}
                eventKey={roundGlowKey}
                onDone={() => setShowRoundGlow(false)}
              />
              <SuitWishBurst
                visible={showWishFx && !showSpecialCardFx}
                eventKey={wishFxKey}
                wishSuit={wishFxSuit}
                onDone={() => {
                  setShowWishFx(false);
                  setWishFxSuit(undefined);
                }}
              />
              <SpecialCardActionFx
                visible={showSpecialCardFx}
                eventKey={specialCardFxKey}
                rank={specialCardFxRank}
                wishSuit={specialCardFxWishSuit}
                direction={specialCardFxDirection}
                drawChainCount={specialCardFxDrawChain}
                onDone={() => {
                  setShowSpecialCardFx(false);
                  setSpecialCardFxRank(undefined);
                  setSpecialCardFxWishSuit(undefined);
                  setSpecialCardFxDirection(undefined);
                  setSpecialCardFxDrawChain(undefined);
                }}
              />
              {seatAwareOpponents.map((player, idx) => {
                const anchor = anchorsForOpponents[idx] ?? { top: 8, left: arenaInset + idx * 20 };
                const isActive = gameState.players[gameState.currentPlayerIndex]?.id === player.id;
                const isLoserPulse = loserPulseName === player.username;
                const senderReaction = reactionsBySenderId.get(player.id);
                const targetReaction = reactionTargetsByPlayerId.get(player.id);
                const isTargeted = Boolean(targetReaction);
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
                      overflow: "visible",
                      shadowColor: isActive ? "#FFD200" : "#000",
                      shadowOpacity: isActive ? 0.32 : 0.15,
                      shadowRadius: isActive ? 10 : 7,
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
                      <Text style={{ color: "#D9FBE7", fontSize: 10, fontWeight: "800" }}>
                        S {getRoundStartCards(player.lossPoints)}
                      </Text>
                    </View>
                    {isActive && (
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
                            shadowColor: "#FFD200",
                            shadowOpacity: 0.45,
                            shadowRadius: 12,
                          },
                          pulseStyle,
                        ]}
                      />
                    )}
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
                    {isTargeted && (
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          {
                            position: "absolute",
                            top: -2,
                            left: -2,
                            right: -2,
                            bottom: -2,
                            borderRadius: 14,
                            borderWidth: 1.8,
                            borderColor: "rgba(255, 174, 66, 0.86)",
                            backgroundColor: "rgba(190, 92, 12, 0.16)",
                          },
                          dangerPulseStyle,
                        ]}
                      />
                    )}
                    {targetReaction && (
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          top: -42,
                          zIndex: 41,
                          borderRadius: 999,
                          backgroundColor: "rgba(43, 21, 10, 0.95)",
                          borderWidth: 1,
                          borderColor: "rgba(255, 193, 107, 0.84)",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Text style={{ color: "#FFE9C8", fontSize: 9, fontWeight: "900" }} numberOfLines={1}>
                          {targetReaction.emoji} von {targetReaction.username}
                        </Text>
                      </View>
                    )}
                    {senderReaction && (
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          top: -24,
                          zIndex: 40,
                          borderRadius: 999,
                          backgroundColor: "rgba(6, 16, 24, 0.95)",
                          borderWidth: 1,
                          borderColor: "rgba(148, 228, 190, 0.75)",
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Text style={{ fontSize: 16 }}>{senderReaction.emoji}</Text>
                        {senderReaction.targetUsername ? (
                          <Text style={{ color: "#D8FEEA", fontSize: 9, fontWeight: "800" }} numberOfLines={1}>
                            → {senderReaction.targetUsername}
                          </Text>
                        ) : null}
                      </View>
                    )}
                    <PlayerAvatar name={player.username} avatarUrl={player.avatarUrl} active={isActive} isBot={Boolean(player.userId != null && player.userId < 0)} size={48} />
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
                  zIndex: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: isCompactHeight ? 24 : 28,
                  backgroundColor: "rgba(7, 16, 22, 0.48)",
                  borderWidth: 1,
                  borderColor: "rgba(142, 181, 208, 0.28)",
                  borderRadius: 18,
                  paddingHorizontal: isCompactHeight ? 12 : 14,
                  paddingVertical: isCompactHeight ? 10 : 11,
                  shadowColor: "#02060a",
                  shadowOpacity: 0.34,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 8,
                }}
              >
                <View className="items-center">
                  <Touchable
                    onPress={handleDrawCard}
                    disabled={!isMyTurn}
                  >
                    <Animated.View
                      style={{
                        width: 58,
                        height: 85,
                        shadowColor: hasNoPlayableCards ? DESIGN.accentPrimary : "#000",
                        shadowOffset: { width: 0, height: hasNoPlayableCards ? 2 : 6 },
                        shadowOpacity: hasNoPlayableCards ? 0.62 : 0.28,
                        shadowRadius: hasNoPlayableCards ? 22 : 14,
                        elevation: hasNoPlayableCards ? 12 : 8,
                        transform: [{ scale: hasNoPlayableCards ? 1.06 : 1.02 }],
                      }}
                    >
                      {hasNoPlayableCards && (
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            {
                              position: "absolute",
                              top: -6,
                              left: -6,
                              right: -6,
                              bottom: -6,
                              borderRadius: 14,
                              borderWidth: 2,
                              borderColor: "rgba(255, 196, 87, 0.95)",
                              backgroundColor: "rgba(120, 72, 14, 0.2)",
                            },
                            dangerPulseStyle,
                          ]}
                        />
                      )}
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
                    </Animated.View>
                  </Touchable>
                  {isMyTurn && (
                    <Text
                      style={{
                        color: hasNoPlayableCards ? "#FFE9B8" : DESIGN.accentSecondary,
                        fontSize: 11,
                        fontWeight: "900",
                        marginTop: 5,
                        letterSpacing: hasNoPlayableCards ? 0.4 : 0,
                      }}
                    >
                      {hasNoPlayableCards ? "JETZT ZIEHEN" : "Ziehen"}
                    </Text>
                  )}
                </View>

                <View className="items-center">
                  <View
                    style={{
                      shadowColor: effectiveDiscardCard?.rank === "7" && gameState.drawChainCount > 0
                        ? DESIGN.accentPrimary
                        : "#000",
                      shadowOffset: effectiveDiscardCard?.rank === "7" && gameState.drawChainCount > 0
                        ? { width: 0, height: 0 }
                        : { width: 0, height: 6 },
                      shadowOpacity: effectiveDiscardCard?.rank === "7" && gameState.drawChainCount > 0
                        ? Math.min(0.5 + (gameState.drawChainCount * 0.2), 1.0)
                        : 0.25,
                      shadowRadius: effectiveDiscardCard?.rank === "7" && gameState.drawChainCount > 0
                        ? 30 + (gameState.drawChainCount * 10)
                        : 16,
                      elevation: 10,
                      transform: [{ scale: 1.03 }],
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
                  <Text style={{ color: DESIGN.textMain, fontSize: 11, fontWeight: "700", marginTop: 5 }}>Ablagestapel</Text>
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
                bottom: handPanelBottom,
                backgroundColor: "rgba(20, 30, 38, 0.95)",
                borderColor: isCurrentPlayerLoserPulse ? "rgba(255,88,88,0.95)" : (isMyTurn ? DESIGN.lineStrong : DESIGN.lineSoft),
                borderWidth: isMyTurn ? 1.8 : 1,
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingTop: 11,
                paddingBottom: isCompactHeight ? 10 : 12,
                shadowColor: isMyTurn ? DESIGN.accentSecondary : "#03070a",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: isMyTurn ? 0.45 : 0.28,
                shadowRadius: isMyTurn ? 18 : 9,
                elevation: isMyTurn ? 13 : 5,
                minHeight: isMyTurn ? (isCompactHeight ? 144 : 166) : 100,
                zIndex: 22,
              }}
            >
              {currentPlayerReaction && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: -24,
                    alignSelf: "center",
                    zIndex: 30,
                    borderRadius: 999,
                    backgroundColor: "rgba(6, 16, 24, 0.95)",
                    borderWidth: 1,
                    borderColor: "rgba(148, 228, 190, 0.75)",
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{currentPlayerReaction.emoji}</Text>
                  {currentPlayerReaction.targetUsername ? (
                    <Text style={{ color: "#D8FEEA", fontSize: 10, fontWeight: "800" }} numberOfLines={1}>
                      → {currentPlayerReaction.targetUsername}
                    </Text>
                  ) : null}
                </View>
              )}
              {currentPlayerTargetedReaction && (
                <>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      {
                        position: "absolute",
                        top: -1,
                        left: -1,
                        right: -1,
                        bottom: -1,
                        borderRadius: 19,
                        borderWidth: 2,
                        borderColor: "rgba(255,174,66,0.9)",
                      },
                      dangerPulseStyle,
                    ]}
                  />
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: -42,
                      alignSelf: "center",
                      zIndex: 32,
                      borderRadius: 999,
                      backgroundColor: "rgba(43, 21, 10, 0.95)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 193, 107, 0.84)",
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={{ color: "#FFE9C8", fontSize: 10, fontWeight: "900" }} numberOfLines={1}>
                      {currentPlayerTargetedReaction.emoji} von {currentPlayerTargetedReaction.username}
                    </Text>
                  </View>
                </>
              )}
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
                  <PlayerAvatar name={currentPlayer.username} avatarUrl={currentPlayer.avatarUrl} active={isMyTurn} isBot={Boolean(currentPlayer.userId != null && currentPlayer.userId < 0)} size={48} />
                  {isMyTurn && (
                    <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: DESIGN.accentSecondary }, pulseStyle]} />
                  )}
                  <Text style={{ color: isMyTurn ? DESIGN.accentSecondary : DESIGN.textMain, fontWeight: "800", fontSize: 14 }}>
                    {isMyTurn ? "DEIN ZUG" : "Deine Hand"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: "#D9FBE7", fontSize: 11, fontWeight: "800" }}>
                    🂠 {currentPlayer.hand.length} Karten
                  </Text>
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
              {isMyTurn && (
                <View
                  style={{
                    marginBottom: 6,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: hasNoPlayableCards ? "rgba(255, 196, 87, 0.72)" : "rgba(90, 230, 160, 0.6)",
                    backgroundColor: hasNoPlayableCards ? "rgba(120, 72, 14, 0.34)" : "rgba(26, 110, 70, 0.32)",
                    paddingHorizontal: 8,
                    paddingVertical: 5,
                    alignSelf: "flex-start",
                  }}
                >
                  <Text
                    style={{
                      color: hasNoPlayableCards ? "#FFE9B8" : "#DDFBEF",
                      fontSize: 11,
                      fontWeight: "800",
                    }}
                  >
                    {hasNoPlayableCards ? "🂠 Ziehstapel aktiv" : `${playableCount} spielbar`}
                  </Text>
                </View>
              )}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ minHeight: isMyTurn ? (isCompactHeight ? 86 : 98) : 62 }}
                contentContainerStyle={{ paddingHorizontal: 2, paddingTop: 4, paddingBottom: 8 }}
              >
                <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-end" }}>
                  {currentPlayer.hand.map((card, index) => {
                    const disabledByServerHint = isMyTurn && Boolean(gameState.playableCardIds) && !playableCardIds.has(card.id);
                    const centerIndex = (currentPlayer.hand.length - 1) / 2;
                    const offset = index - centerIndex;
                    const fanSpread = currentPlayer.hand.length <= 5 ? 10 : 7;
                    const isPlayable = !disabledByServerHint && isMyTurn;
                    const arcLift = Math.max(0, 8 - Math.abs(offset) * 1.8);
                    return (
                      <View
                        key={card.id}
                        style={{
                          transform: [
                            { rotate: `${offset * fanSpread}deg` },
                            { translateY: 9 - arcLift + (isPlayable ? -5 : 0) },
                          ],
                          marginHorizontal: -1,
                          zIndex: 1000 - Math.abs(offset) * 10,
                          shadowColor: isPlayable ? DESIGN.accentSecondary : "#000",
                          shadowOpacity: isPlayable ? 0.38 : 0,
                          shadowRadius: isPlayable ? 10 : 0,
                          elevation: isPlayable ? 6 : 0,
                          opacity: disabledByServerHint ? (hasNoPlayableCards ? 0.34 : 0.43) : (isMyTurn ? 1 : 0.92),
                        }}
                      >
                        {isPlayable && (
                          <View
                            pointerEvents="none"
                            style={{
                              position: "absolute",
                              top: -18,
                              alignSelf: "center",
                              zIndex: 30,
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: "rgba(90,230,160,0.95)",
                              backgroundColor: "rgba(26,110,70,0.9)",
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                            }}
                          >
                            <Text style={{ color: "#EAFFF5", fontSize: isCompactHeight ? 10 : 9, fontWeight: "900", letterSpacing: isCompactHeight ? 0 : 0.4 }}>
                              {isCompactHeight ? "✓" : "SPIELBAR"}
                            </Text>
                          </View>
                        )}
                        {disabledByServerHint && (
                          <View
                            pointerEvents="none"
                            style={{
                              position: "absolute",
                              top: 2,
                              right: 2,
                              zIndex: 25,
                              width: 16,
                              height: 16,
                              borderRadius: 8,
                              backgroundColor: "rgba(40, 12, 12, 0.88)",
                              borderWidth: 1,
                              borderColor: "rgba(255,115,115,0.8)",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ color: "#FFB4B4", fontWeight: "900", fontSize: 10 }}>×</Text>
                          </View>
                        )}
                        <PlayingCard
                          card={card}
                          onPress={() => handlePlayCard(card)}
                          disabled={!isMyTurn || disabledByServerHint}
                          size="small"
                        />
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
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
      <BlackbirdAnimation
        visible={showBlackbird}
        eventId={blackbirdEventId}
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
          const activeFx = activeGameFxRef.current;
          showBlackbirdRef.current = false;
          if (blackbirdVisibilityGuardTimerRef.current) {
            clearTimeout(blackbirdVisibilityGuardTimerRef.current);
            blackbirdVisibilityGuardTimerRef.current = null;
          }
          setShowBlackbird(false);
          setBlackbirdEventId(undefined);
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
          if (activeFx?.type === "blackbird") {
            completeActiveGameFx(activeFx.id);
            return;
          }
          // Process next queued event after a short delay
          if (blackbirdNextTimerRef.current) {
            clearTimeout(blackbirdNextTimerRef.current);
          }
          blackbirdNextTimerRef.current = setTimeout(() => {
            blackbirdNextTimerRef.current = null;
            if (blackbirdQueueRef.current.length > 0) {
              processNextBlackbird();
            }
          }, 300);
        }}
        onStart={() => playBlackbirdForEvent(blackbirdEvent, blackbirdIntensity ?? 3)}
      />
      <DrawCardAnimation
        visible={showDrawFly}
        drawCount={drawFlyFx?.drawCount ?? 1}
        playerName={drawFlyFx?.playerName}
        targetX={drawFlyFx?.targetX ?? 0.5}
        targetY={drawFlyFx?.targetY ?? 0.26}
        onDone={() => {
          if (drawFlyFallbackTimerRef.current) {
            clearTimeout(drawFlyFallbackTimerRef.current);
            drawFlyFallbackTimerRef.current = null;
          }
          const activeFx = activeGameFxRef.current;
          setShowDrawFly(false);
          setDrawFlyFx(null);
          if (activeFx?.type === "draw_card") {
            completeActiveGameFx(activeFx.id);
          }
        }}
      />
      <CardFlyAnimation
        card={flyingCard}
        visible={showFlyingCard}
        onDone={() => {
          const activeFx = activeGameFxRef.current;
          setShowFlyingCard(false);
          setFlyingCard(null);
          if (activeFx?.type === "card_play") {
            completeActiveGameFx(activeFx.id);
            return;
          }
          setTimeout(() => {
            processNextCardPlayFx();
          }, 50);
        }}
      />
    </View>
  );
}
