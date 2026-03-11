import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Dimensions, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { Card, Player } from "@/shared/game-types";
import { createDeck, shuffleDeck, getSuitSymbol } from "@/shared/deck-utils";
import { getHighestCard, getLowestCard, compareCards } from "@/shared/card-comparison";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const RANK_DISPLAY: Record<string, string> = {
  "7": "7", "8": "8", "9": "9", "10": "10",
  bube: "B", dame: "D", konig: "K", ass: "A",
};

const SUIT_COLORS: Record<string, string> = {
  eichel: "#8B4513", gruen: "#228B22", rot: "#DC143C", schellen: "#DAA520",
};

export interface PreparationDrawData {
  playerId: number;
  username: string;
  card: Card;
}

interface GamePreparationScreenProps {
  players: Player[];
  onComplete: (sortedPlayers: Player[], dealerIndex: number) => void;
  /** Server-provided seat draws (for online mode) */
  serverSeatDraws?: PreparationDrawData[];
  /** Server-provided dealer draws (for online mode) */
  serverDealerDraws?: PreparationDrawData[];
}

interface DrawnCard {
  player: Player;
  card: Card;
}

/** Single animated card that flips from back to front (cross-fade + scale, works on all platforms) */
function AnimatedCard({
  card,
  index,
  totalCards,
  delay,
  isHighlighted,
  highlightColor,
  label,
}: {
  card: Card;
  index: number;
  totalCards: number;
  delay: number;
  isHighlighted: boolean;
  highlightColor: string;
  label?: string;
}) {
  const scaleValue = useSharedValue(0.3);
  const backOpacity = useSharedValue(1);
  const frontOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const flipScale = useSharedValue(1);

  useEffect(() => {
    // Card appears from small
    scaleValue.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 100 }));
    // Flip: squeeze → swap → unsqueeze
    flipScale.value = withDelay(
      delay + 400,
      withSequence(
        withTiming(0, { duration: 180, easing: Easing.in(Easing.ease) }),
        withTiming(1, { duration: 180, easing: Easing.out(Easing.ease) }),
      )
    );
    // Swap opacity at midpoint
    backOpacity.value = withDelay(delay + 580, withTiming(0, { duration: 60 }));
    frontOpacity.value = withDelay(delay + 580, withTiming(1, { duration: 60 }));
  }, []);

  useEffect(() => {
    if (isHighlighted) {
      glowOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
      scaleValue.value = withDelay(200, withSpring(1.1, { damping: 10 }));
    }
  }, [isHighlighted]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scaleValue.value },
      { scaleX: flipScale.value },
    ],
  }));

  const frontStyle = useAnimatedStyle(() => ({ opacity: frontOpacity.value }));
  const backStyle = useAnimatedStyle(() => ({ opacity: backOpacity.value }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  const suitColor = SUIT_COLORS[card.suit];

  return (
    <View style={styles.cardContainer}>
      <Animated.View style={[styles.cardWrapper, cardStyle]}>
        {/* Back of card */}
        <Animated.View style={[styles.card, styles.cardBack, backStyle]}>
          <View style={styles.cardBackInner}>
            <Text style={styles.cardBackText}>?</Text>
          </View>
        </Animated.View>

        {/* Front of card */}
        <Animated.View style={[styles.card, styles.cardFront, frontStyle]}>
          {isHighlighted && (
            <Animated.View style={[styles.cardGlow, { borderColor: highlightColor }, glowStyle]} />
          )}
          <Text style={[styles.cardRank, { color: suitColor }]}>
            {RANK_DISPLAY[card.rank]}
          </Text>
          <Text style={styles.cardSuit}>{getSuitSymbol(card.suit)}</Text>
        </Animated.View>
      </Animated.View>

      {label && (
        <Text style={[styles.cardLabel, isHighlighted && { color: highlightColor, fontWeight: "700" }]}>
          {label}
        </Text>
      )}
    </View>
  );
}

export function GamePreparationScreen({ players, onComplete, serverSeatDraws, serverDealerDraws }: GamePreparationScreenProps) {
  const [phase, setPhase] = useState<"seat_selection" | "dealer_selection" | "done">("seat_selection");
  const [seatCards, setSeatCards] = useState<DrawnCard[]>([]);
  const [dealerCards, setDealerCards] = useState<DrawnCard[]>([]);
  const [seatWinner, setSeatWinner] = useState<number | null>(null);
  const [dealerWinner, setDealerWinner] = useState<number | null>(null);
  const [sortedPlayers, setSortedPlayers] = useState<Player[]>([]);
  const [showTitle, setShowTitle] = useState(true);

  const titleOpacity = useSharedValue(1);
  const phaseTextOpacity = useSharedValue(0);

  // Helper: convert server draws to DrawnCard[]
  // IMPORTANT: Always use d.username from server draws as authoritative source,
  // because gameState.players may have stale usernames from auto-rejoin race condition
  const serverDrawsToDrawnCards = (draws: PreparationDrawData[], playerList: Player[]): DrawnCard[] => {
    return draws.map((d) => {
      const existingPlayer = playerList.find((p) => p.id === d.playerId);
      const player: Player = {
        id: d.playerId,
        userId: existingPlayer?.userId ?? 0,
        username: d.username, // Always use server-provided username
        hand: existingPlayer?.hand ?? [],
        lossPoints: existingPlayer?.lossPoints ?? 0,
        isEliminated: existingPlayer?.isEliminated ?? false,
        isReady: existingPlayer?.isReady ?? false,
      };
      return { player, card: d.card };
    });
  };

  // Phase 1: Seat Selection
  useEffect(() => {
    let drawn: DrawnCard[];

    if (serverSeatDraws && serverSeatDraws.length > 0) {
      // Online mode: use server-provided cards
      drawn = serverDrawsToDrawnCards(serverSeatDraws, players);
    } else {
      // Practice mode: generate locally
      const deck = shuffleDeck(createDeck());
      drawn = players.map((player, i) => ({
        player,
        card: deck[i],
      }));
    }
    setSeatCards(drawn);

    // After cards are revealed, highlight the winner
    const revealTime = 400 + players.length * 300 + 600 + 800;
    const timer = setTimeout(() => {
      const highest = getHighestCard(drawn.map((d) => d.card));
      if (highest) {
        const winnerIdx = drawn.findIndex((d) => d.card.id === highest.id);
        setSeatWinner(winnerIdx);
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, revealTime);

    // Move to dealer selection
    const nextTimer = setTimeout(() => {
      // Sort players by card rank (highest first for seat selection)
      const sorted = [...drawn]
        .sort((a, b) => compareCards(b.card, a.card))
        .map((d, index) => ({
          ...d.player,
          seatPosition: index,
        }));
      setSortedPlayers(sorted);
      setPhase("dealer_selection");
    }, revealTime + 2500);

    return () => {
      clearTimeout(timer);
      clearTimeout(nextTimer);
    };
  }, []);

  // Phase 2: Dealer Selection
  useEffect(() => {
    if (phase !== "dealer_selection") return;

    let drawn: DrawnCard[];

    if (serverDealerDraws && serverDealerDraws.length > 0) {
      // Online mode: use server-provided cards (map to sorted players)
      // Always use d.username from server draws as authoritative source
      drawn = serverDealerDraws.map((d) => {
        const existingPlayer = sortedPlayers.find((p) => p.id === d.playerId);
        const player: Player = {
          id: d.playerId,
          userId: existingPlayer?.userId ?? 0,
          username: d.username, // Always use server-provided username
          hand: existingPlayer?.hand ?? [],
          lossPoints: existingPlayer?.lossPoints ?? 0,
          isEliminated: existingPlayer?.isEliminated ?? false,
          isReady: existingPlayer?.isReady ?? false,
        };
        return { player, card: d.card };
      });
    } else {
      // Practice mode: generate locally
      const deck = shuffleDeck(createDeck());
      drawn = sortedPlayers.map((player, i) => ({
        player,
        card: deck[i],
      }));
    }
    setDealerCards(drawn);

    const revealTime = 400 + sortedPlayers.length * 300 + 600 + 800;
    const timer = setTimeout(() => {
      const lowest = getLowestCard(drawn.map((d) => d.card));
      if (lowest) {
        const winnerIdx = drawn.findIndex((d) => d.card.id === lowest.id);
        setDealerWinner(winnerIdx);
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, revealTime);

    // Complete preparation
    const completeTimer = setTimeout(() => {
      const lowest = getLowestCard(drawn.map((d) => d.card));
      if (lowest) {
        const dealerIdx = drawn.findIndex((d) => d.card.id === lowest.id);
        setPhase("done");
        onComplete(sortedPlayers, dealerIdx);
      }
    }, revealTime + 2500);

    return () => {
      clearTimeout(timer);
      clearTimeout(completeTimer);
    };
  }, [phase]);

  const currentCards = phase === "seat_selection" ? seatCards : dealerCards;
  const currentWinner = phase === "seat_selection" ? seatWinner : dealerWinner;

  return (
    <View style={styles.container}>
      {/* Background overlay */}
      <View style={styles.overlay} />

      {/* Phase Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.phaseTitle}>
          {phase === "seat_selection" ? "Platzwahl" : phase === "dealer_selection" ? "Dealerwahl" : ""}
        </Text>
        <Text style={styles.phaseSubtitle}>
          {phase === "seat_selection"
            ? "Höchste Karte wählt zuerst den Platz"
            : phase === "dealer_selection"
            ? "Niedrigste Karte gibt"
            : ""}
        </Text>
      </View>

      {/* Cards */}
      <View style={styles.cardsRow}>
        {currentCards.map((drawn, index) => (
          <AnimatedCard
            key={`${phase}-${drawn.player.id}`}
            card={drawn.card}
            index={index}
            totalCards={currentCards.length}
            delay={index * 300}
            isHighlighted={currentWinner === index}
            highlightColor={phase === "seat_selection" ? "#FFD700" : "#00FF88"}
            label={drawn.player.username}
          />
        ))}
      </View>

      {/* Result text */}
      {currentWinner !== null && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>
            {phase === "seat_selection"
              ? `${currentCards[currentWinner]?.player.username} hat die höchste Karte!`
              : `${currentCards[currentWinner]?.player.username} gibt!`}
          </Text>
          {phase === "seat_selection" && (
            <View style={styles.seatOrderContainer}>
              <Text style={styles.seatOrderTitle}>Sitzreihenfolge:</Text>
              {[...seatCards]
                .sort((a, b) => {
                  const cardA = a.card;
                  const cardB = b.card;
                  const highest = getHighestCard([cardA, cardB]);
                  return highest?.id === cardA.id ? -1 : 1;
                })
                .map((d, i) => (
                  <Text key={d.player.id} style={styles.seatOrderItem}>
                    {i + 1}. {d.player.username}
                  </Text>
                ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.85)",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  phaseTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 255, 136, 0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    letterSpacing: 2,
  },
  phaseSubtitle: {
    fontSize: 14,
    color: "#9BA1A6",
    marginTop: 8,
    letterSpacing: 1,
  },
  cardsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 20,
  },
  cardContainer: {
    alignItems: "center",
    width: 70,
  },
  cardWrapper: {
    width: 60,
    height: 88,
  },
  card: {
    position: "absolute",
    width: 60,
    height: 88,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backfaceVisibility: "hidden",
  },
  cardBack: {
    backgroundColor: "#1a3a5c",
    borderWidth: 2,
    borderColor: "#2a5a8c",
  },
  cardBackInner: {
    width: 48,
    height: 76,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#3a6a9c",
    backgroundColor: "#1e4a7a",
    justifyContent: "center",
    alignItems: "center",
  },
  cardBackText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#4a8abc",
  },
  cardFront: {
    backgroundColor: "#FFFEF5",
    borderWidth: 2,
    borderColor: "#D4D0C0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    borderWidth: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 8,
  },
  cardRank: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 2,
  },
  cardSuit: {
    fontSize: 18,
  },
  cardLabel: {
    marginTop: 8,
    fontSize: 11,
    color: "#CCCCCC",
    fontWeight: "500",
    textAlign: "center",
  },
  resultContainer: {
    marginTop: 40,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "rgba(0, 255, 136, 0.15)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 255, 136, 0.3)",
  },
  resultText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#00FF88",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  seatOrderContainer: {
    marginTop: 12,
    alignItems: "center",
  },
  seatOrderTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9BA1A6",
    marginBottom: 4,
  },
  seatOrderItem: {
    fontSize: 14,
    fontWeight: "500",
    color: "#ECEDEE",
    lineHeight: 20,
  },
});
