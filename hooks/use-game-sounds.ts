import { useEffect } from "react";
import { setAudioModeAsync, setIsAudioActiveAsync, useAudioPlayer, type AudioPlayer } from "expo-audio";
import { Platform } from "react-native";

/**
 * Hook for playing game sound effects
 */
export function useGameSounds() {
  const cardPlaySound = useAudioPlayer(require("@/assets/sounds/card-play.wav"));
  const cardDrawSound = useAudioPlayer(require("@/assets/sounds/card-draw.wav"));
  const roundEndSound = useAudioPlayer(require("@/assets/sounds/round-end.wav"));
  const blackbirdSound = useAudioPlayer(require("@/assets/sounds/blackbird.mp3"));
  const clutchSound = useAudioPlayer(require("@/assets/sounds/round-end.wav"));
  const rivalrySound = useAudioPlayer(require("@/assets/sounds/blackbird.mp3"));

  useEffect(() => {
    if (Platform.OS === "web") return;

    void (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: "duckOthers",
          interruptionModeAndroid: "duckOthers",
          allowsRecording: false,
          shouldPlayInBackground: false,
          shouldRouteThroughEarpiece: false,
        });
        await setIsAudioActiveAsync(true);
      } catch (error) {
        console.warn("[useGameSounds] Failed to configure audio mode:", error);
      }
    })();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        cardPlaySound.release();
        cardDrawSound.release();
        roundEndSound.release();
        blackbirdSound.release();
        clutchSound.release();
        rivalrySound.release();
      } catch (error) {
        // Ignore cleanup errors
        console.warn("[useGameSounds] Cleanup error:", error);
      }
    };
  }, [cardPlaySound, cardDrawSound, roundEndSound, blackbirdSound, clutchSound, rivalrySound]);

  const playFromStart = (player: AudioPlayer, label: string) => {
    if (Platform.OS === "web") return;
    void player
      .seekTo(0)
      .then(() => player.play())
      .catch((error) => {
        try {
          player.play();
        } catch (fallbackError) {
          console.warn(`[useGameSounds] Failed to play ${label} sound:`, fallbackError ?? error);
        }
      });
  };

  const playCardPlay = () => {
    playFromStart(cardPlaySound, "card-play");
  };

  const playCardDraw = () => {
    playFromStart(cardDrawSound, "card-draw");
  };

  const playRoundEnd = () => {
    playFromStart(roundEndSound, "round-end");
  };

  const playBlackbird = () => {
    playFromStart(blackbirdSound, "blackbird");
  };

  const playClutchCallout = () => {
    playFromStart(clutchSound, "clutch");
  };

  const playRivalryCallout = () => {
    playFromStart(rivalrySound, "rivalry");
  };

  return {
    playCardPlay,
    playCardDraw,
    playRoundEnd,
    playBlackbird,
    playClutchCallout,
    playRivalryCallout,
  };
}
