import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { FALLBACK_CORE_TOKENS, withAlpha } from "@/lib/design-tokens";

const EMOTES = [
  { emoji: "👍", label: "GG" },
  { emoji: "😂", label: "LOL" },
  { emoji: "😤", label: "Grr" },
  { emoji: "🤔", label: "Hmm" },
  { emoji: "💀", label: "RIP" },
];

// Bot reaction emotes (subset)
const BOT_REACTIONS = ["👍", "😂", "😤", "🤔", "💀", "😎", "🤷"];

interface EmoteBubble {
  id: number;
  emoji: string;
  playerName: string;
  isBot: boolean;
}

interface EmoteSystemProps {
  onEmote?: (emoji: string) => void;
  playerName: string;
  /** Array of bot names in the game */
  botNames: string[];
  /** Whether to show the emote picker */
  showPicker?: boolean;
}

export function EmoteSystem({ onEmote, playerName, botNames, showPicker = true }: EmoteSystemProps) {
  const [bubbles, setBubbles] = useState<EmoteBubble[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const addBubble = useCallback((emoji: string, name: string, isBot: boolean) => {
    const id = Date.now() + Math.random();
    setBubbles((prev) => [...prev.slice(-4), { id, emoji, playerName: name, isBot }]);
    // Auto-remove after 2.5s
    setTimeout(() => {
      setBubbles((prev) => prev.filter((b) => b.id !== id));
    }, 2500);
  }, []);

  const handleEmote = useCallback((emoji: string) => {
    if (cooldown) return;

    // Show player emote
    addBubble(emoji, playerName, false);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onEmote?.(emoji);
    setPickerOpen(false);

    // Cooldown 3s
    setCooldown(true);
    setTimeout(() => setCooldown(false), 3000);

    // Random bot reaction (30% chance per bot, delayed)
    botNames.forEach((botName) => {
      if (Math.random() < 0.3) {
        const delay = 800 + Math.random() * 2000;
        setTimeout(() => {
          const reaction = BOT_REACTIONS[Math.floor(Math.random() * BOT_REACTIONS.length)];
          addBubble(reaction, botName, true);
        }, delay);
      }
    });
  }, [cooldown, playerName, botNames, addBubble, onEmote]);

  return (
    <>
      {/* Floating bubbles */}
      <View style={styles.bubblesContainer} pointerEvents="none">
        {bubbles.map((bubble, index) => (
          <FloatingBubble
            key={bubble.id}
            emoji={bubble.emoji}
            playerName={bubble.playerName}
            isBot={bubble.isBot}
            index={index}
          />
        ))}
      </View>

      {/* Emote picker trigger */}
      {showPicker && (
        <View style={styles.pickerContainer}>
          {pickerOpen ? (
            <View style={styles.pickerRow}>
              {EMOTES.map((emote) => (
                <Pressable
                  key={emote.emoji}
                  onPress={() => handleEmote(emote.emoji)}
                  style={({ pressed }) => [
                    styles.emoteButton,
                    pressed && styles.emoteButtonPressed,
                    cooldown && styles.emoteButtonDisabled,
                  ]}
                  disabled={cooldown}
                >
                  <Text style={styles.emoteEmoji}>{emote.emoji}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setPickerOpen(false)}
                style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => [styles.triggerButton, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.triggerText}>😀</Text>
            </Pressable>
          )}
        </View>
      )}
    </>
  );
}

function FloatingBubble({
  emoji,
  playerName,
  isBot,
  index,
}: {
  emoji: string;
  playerName: string;
  isBot: boolean;
  index: number;
}) {
  const translateY = useSharedValue(20);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.3);

  useEffect(() => {
    translateY.value = withSequence(
      withTiming(0, { duration: 250, easing: Easing.out(Easing.back(2)) }),
      withDelay(1800, withTiming(-30, { duration: 400 })),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(1800, withTiming(0, { duration: 400 })),
    );
    scale.value = withSequence(
      withTiming(1.2, { duration: 200, easing: Easing.out(Easing.back(3)) }),
      withTiming(1, { duration: 100 }),
      withDelay(1700, withTiming(0.8, { duration: 400 })),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.bubble,
        { bottom: 80 + index * 60 },
        isBot ? styles.bubbleBot : styles.bubblePlayer,
        animStyle,
      ]}
    >
      <Text style={styles.bubbleEmoji}>{emoji}</Text>
      <Text style={[styles.bubbleName, isBot && { color: FALLBACK_CORE_TOKENS.TEXT_MUTED }]}>{playerName}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubblesContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 90,
  },
  bubble: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: FALLBACK_CORE_TOKENS.TEXT_INVERSE,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  bubblePlayer: {
    backgroundColor: "rgba(0, 50, 0, 0.95)",
    borderWidth: 1.5,
    borderColor: FALLBACK_CORE_TOKENS.STATE_SUCCESS,
  },
  bubbleBot: {
    backgroundColor: "rgba(30, 30, 30, 0.95)",
    borderWidth: 1,
    borderColor: withAlpha(FALLBACK_CORE_TOKENS.TEXT_MUTED, 0.55),
  },
  bubbleEmoji: {
    fontSize: 22,
  },
  bubbleName: {
    color: FALLBACK_CORE_TOKENS.STATE_SUCCESS,
    fontSize: 11,
    fontWeight: "700",
  },
  pickerContainer: {
    position: "absolute",
    bottom: 148,
    left: 12,
    zIndex: 80,
  },
  pickerRow: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "rgba(10, 10, 10, 0.95)",
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: withAlpha(FALLBACK_CORE_TOKENS.TEXT_MUTED, 0.45),
  },
  emoteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(50, 50, 50, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  emoteButtonPressed: {
    backgroundColor: "rgba(50, 205, 50, 0.3)",
    transform: [{ scale: 0.9 }],
  },
  emoteButtonDisabled: {
    opacity: 0.4,
  },
  emoteEmoji: {
    fontSize: 22,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  closeText: {
    color: withAlpha(FALLBACK_CORE_TOKENS.TEXT_MUTED, 0.66),
    fontSize: 16,
    fontWeight: "700",
  },
  triggerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(10, 10, 10, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: withAlpha(FALLBACK_CORE_TOKENS.TEXT_MUTED, 0.45),
  },
  triggerText: {
    fontSize: 24,
  },
});
