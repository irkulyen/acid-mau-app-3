import { useEffect } from "react";
import { useAudioPlayer } from "expo-audio";
import { Platform } from "react-native";

/**
 * Hook for playing game sound effects
 */
export function useGameSounds() {
  const cardPlaySound = useAudioPlayer(require("@/assets/sounds/card-play.wav"));
  const cardDrawSound = useAudioPlayer(require("@/assets/sounds/card-draw.wav"));
  const roundEndSound = useAudioPlayer(require("@/assets/sounds/round-end.wav"));
  const blackbirdSound = useAudioPlayer(require("@/assets/sounds/blackbird.mp3"));

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        cardPlaySound.release();
        cardDrawSound.release();
        roundEndSound.release();
        blackbirdSound.release();
      } catch (error) {
        // Ignore cleanup errors
        console.warn("[useGameSounds] Cleanup error:", error);
      }
    };
  }, [cardPlaySound, cardDrawSound, roundEndSound]);

  const playCardPlay = () => {
    if (Platform.OS !== "web") {
      try {
        cardPlaySound.play();
      } catch (error) {
        console.warn("[useGameSounds] Failed to play card-play sound:", error);
      }
    }
  };

  const playCardDraw = () => {
    if (Platform.OS !== "web") {
      try {
        cardDrawSound.play();
      } catch (error) {
        console.warn("[useGameSounds] Failed to play card-draw sound:", error);
      }
    }
  };

  const playRoundEnd = () => {
    if (Platform.OS !== "web") {
      try {
        roundEndSound.play();
      } catch (error) {
        console.warn("[useGameSounds] Failed to play round-end sound:", error);
      }
    }
  };

  const playBlackbird = () => {
    if (Platform.OS !== "web") {
      try {
        blackbirdSound.play();
      } catch (error) {
        console.warn("[useGameSounds] Failed to play blackbird sound:", error);
      }
    }
  };

  return {
    playCardPlay,
    playCardDraw,
    playRoundEnd,
    playBlackbird,
  };
}
