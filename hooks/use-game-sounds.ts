import { useCallback, useEffect, useRef, useState } from "react";
import { setAudioModeAsync, setIsAudioActiveAsync, useAudioPlayer, type AudioPlayer } from "expo-audio";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  computeNextMixState,
  filterScheduledByPriority,
  getHoldPriorityMs,
  isBlockedByCooldown,
  isBlockedByGlobalGap,
  isBlockedByPriorityWindow,
  type SoundPriority,
} from "./game-sound-policy";

export const GAME_SFX_ENABLED_KEY = "crazyamsel:sfx-enabled";

type SoundLabel =
  | "card-play"
  | "card-draw"
  | "round-end"
  | "blackbird"
  | "clutch"
  | "rivalry"
  | "turn-shift"
  | "invalid";

type PlayProfile = {
  volume?: number;
  playbackRate?: number;
  cooldownMs?: number;
  priority?: 1 | 2 | 3 | 4 | 5;
  holdPriorityMs?: number;
  bypassGlobalGap?: boolean;
};

type ScheduledSound = {
  timer: ReturnType<typeof setTimeout>;
  priority: SoundPriority;
};

export type AmselSoundEvent =
  | "CARD_PLAY"
  | "DRAW"
  | "SPECIAL_7"
  | "SPECIAL_U"
  | "SPECIAL_A"
  | "SPECIAL_8"
  | "ELIMINATION"
  | "WIN"
  | "ERROR_INVALID";

/**
 * Hook for playing game sound effects
 */
export function useGameSounds() {
  const cardPlaySound = useAudioPlayer(require("@/assets/sounds/card-play.wav"));
  const cardDrawSound = useAudioPlayer(require("@/assets/sounds/card-draw.wav"));
  const roundEndSound = useAudioPlayer(require("@/assets/sounds/round-end.wav"));
  const blackbirdSound = useAudioPlayer(require("@/assets/sounds/blackbird.mp3"));
  const clutchSound = useAudioPlayer(require("@/assets/sounds/clutch-callout.wav"));
  const rivalrySound = useAudioPlayer(require("@/assets/sounds/rivalry-callout.wav"));
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const soundsEnabledRef = useRef(true);
  const lastPlayedAtRef = useRef<Record<string, number>>({});
  const delayedSoundTimersRef = useRef<ScheduledSound[]>([]);
  const mixPriorityRef = useRef<{ priority: SoundPriority; until: number }>({ priority: 1, until: 0 });
  const lastAnySoundAtRef = useRef(0);

  useEffect(() => {
    if (Platform.OS === "web") return;

    void (async () => {
      try {
        const fromStorage = await AsyncStorage.getItem(GAME_SFX_ENABLED_KEY);
        const envDisabled = process.env.EXPO_PUBLIC_DISABLE_GAME_SFX === "1";
        const enabled = !envDisabled && fromStorage !== "0";
        soundsEnabledRef.current = enabled;
        setSoundsEnabled(enabled);
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
        delayedSoundTimersRef.current.forEach(({ timer }) => clearTimeout(timer));
        delayedSoundTimersRef.current = [];
      } catch (error) {
        // Ignore cleanup errors
        console.warn("[useGameSounds] Cleanup error:", error);
      }
    };
  }, [cardPlaySound, cardDrawSound, roundEndSound, blackbirdSound, clutchSound, rivalrySound]);

  const persistSoundsEnabled = useCallback((value: boolean) => {
    soundsEnabledRef.current = value;
    setSoundsEnabled(value);
    void AsyncStorage.setItem(GAME_SFX_ENABLED_KEY, value ? "1" : "0").catch((error) => {
      console.warn("[useGameSounds] Failed to persist sound preference:", error);
    });
  }, []);

  const playFromStart = useCallback((player: AudioPlayer, label: SoundLabel, profile?: PlayProfile) => {
    if (Platform.OS === "web" || !soundsEnabledRef.current) return;
    const now = Date.now();
    const priority: SoundPriority = profile?.priority ?? 2;
    const holdPriorityMs = getHoldPriorityMs(priority, profile?.holdPriorityMs);
    const cooldownMs = profile?.cooldownMs ?? 0;
    const lastAt = lastPlayedAtRef.current[label] ?? 0;
    if (isBlockedByCooldown(now, lastAt, cooldownMs)) return;

    const activeMix = mixPriorityRef.current;
    if (isBlockedByPriorityWindow(now, priority, activeMix)) {
      return;
    }

    if (isBlockedByGlobalGap(now, priority, lastAnySoundAtRef.current, profile?.bypassGlobalGap)) {
      return;
    }

    lastPlayedAtRef.current[label] = now;
    lastAnySoundAtRef.current = now;
    mixPriorityRef.current = computeNextMixState(now, priority, activeMix, holdPriorityMs);

    if (priority >= 4 && delayedSoundTimersRef.current.length > 0) {
      // Prevent low-priority aftershocks from muddying high-impact moments.
      delayedSoundTimersRef.current = delayedSoundTimersRef.current.filter((entry) => {
        if (filterScheduledByPriority([entry], priority).length > 0) return true;
        clearTimeout(entry.timer);
        return false;
      });
    }

    if (typeof profile?.volume === "number") {
      const safeVolume = Math.max(0, Math.min(1, profile.volume));
      try {
        player.volume = safeVolume;
      } catch (error) {
        console.warn(`[useGameSounds] Failed to set volume for ${label}:`, error);
      }
    }
    if (typeof profile?.playbackRate === "number") {
      const safeRate = Math.max(0.25, Math.min(2, profile.playbackRate));
      const playerWithRate = player as AudioPlayer & { setPlaybackRate?: (value: number) => void };
      if (typeof playerWithRate.setPlaybackRate === "function") {
        try {
          playerWithRate.setPlaybackRate(safeRate);
        } catch (error) {
          console.warn(`[useGameSounds] Failed to set playback rate for ${label}:`, error);
        }
      }
    }

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
  }, []);

  const scheduleSound = useCallback((delayMs: number, priority: SoundPriority, callback: () => void) => {
    if (!soundsEnabledRef.current || Platform.OS === "web") return;
    const timer = setTimeout(() => {
      delayedSoundTimersRef.current = delayedSoundTimersRef.current.filter((entry) => entry.timer !== timer);
      const now = Date.now();
      const activeMix = mixPriorityRef.current;
      if (now < activeMix.until && priority < activeMix.priority) {
        return;
      }
      callback();
    }, delayMs);
    delayedSoundTimersRef.current.push({ timer, priority });
  }, []);

  const playCardPlay = (intensity: 1 | 2 | 3 | 4 | 5 = 2) => {
    const volume = 0.3 + intensity * 0.1;
    const playbackRate = 0.95 + intensity * 0.05;
    playFromStart(cardPlaySound, "card-play", {
      volume: Math.min(0.95, volume),
      playbackRate: Math.min(1.22, playbackRate),
      cooldownMs: 80,
      priority: intensity >= 4 ? 3 : 2,
    });
  };

  const playCardDraw = (drawCount = 1, toSelf = false) => {
    const normalized = Math.max(1, Math.min(8, drawCount));
    playFromStart(cardDrawSound, "card-draw", {
      volume: toSelf ? 0.55 : 0.45,
      playbackRate: 1 + Math.min(0.18, normalized * 0.02),
      cooldownMs: 70,
      priority: normalized >= 4 ? 3 : 2,
    });
    if (normalized >= 3) {
      scheduleSound(88, 2, () =>
        playFromStart(cardDrawSound, "card-draw", {
          volume: toSelf ? 0.42 : 0.34,
          playbackRate: 0.92,
          cooldownMs: 0,
          priority: 2,
        })
      );
    }
  };

  const playRoundEnd = () => {
    playFromStart(roundEndSound, "round-end", { volume: 0.72, playbackRate: 1.0, cooldownMs: 600, priority: 4, holdPriorityMs: 320 });
  };

  const playBlackbird = (intensity: 1 | 2 | 3 | 4 | 5 = 3) => {
    playFromStart(blackbirdSound, "blackbird", {
      volume: Math.min(0.9, 0.34 + intensity * 0.1),
      playbackRate: 0.96 + intensity * 0.03,
      cooldownMs: 260,
      priority: intensity >= 4 ? 4 : 3,
      holdPriorityMs: intensity >= 4 ? 340 : 250,
    });
  };

  const playClutchCallout = () => {
    playFromStart(clutchSound, "clutch", {
      volume: 0.56,
      playbackRate: 1.02,
      cooldownMs: 1100,
      priority: 4,
      holdPriorityMs: 280,
    });
  };

  const playRivalryCallout = () => {
    playFromStart(rivalrySound, "rivalry", {
      volume: 0.44,
      playbackRate: 0.98,
      cooldownMs: 1200,
      priority: 3,
      holdPriorityMs: 220,
    });
  };

  const playTurnShift = (isMyTurn: boolean) => {
    playFromStart(cardPlaySound, "turn-shift", {
      volume: isMyTurn ? 0.54 : 0.3,
      playbackRate: isMyTurn ? 1.16 : 0.94,
      cooldownMs: 220,
      priority: isMyTurn ? 3 : 2,
    });
  };

  const playSpecialCard = (rank: "ass" | "bube" | "7" | "8") => {
    if (rank === "7") {
      playFromStart(roundEndSound, "round-end", {
        volume: 0.74,
        playbackRate: 1.18,
        cooldownMs: 300,
        priority: 5,
        holdPriorityMs: 360,
      });
      scheduleSound(68, 4, () =>
        playFromStart(cardPlaySound, "card-play", {
          volume: 0.58,
          playbackRate: 0.82,
          cooldownMs: 0,
          priority: 4,
        })
      );
      scheduleSound(132, 3, () =>
        playFromStart(blackbirdSound, "blackbird", {
          volume: 0.46,
          playbackRate: 1.16,
          cooldownMs: 0,
          priority: 3,
        })
      );
      return;
    }
    if (rank === "8") {
      playFromStart(cardPlaySound, "card-play", {
        volume: 0.44,
        playbackRate: 1.04,
        cooldownMs: 220,
        priority: 4,
        holdPriorityMs: 260,
      });
      scheduleSound(74, 3, () =>
        playFromStart(blackbirdSound, "blackbird", {
          volume: 0.45,
          playbackRate: 1.02,
          cooldownMs: 0,
          priority: 3,
        })
      );
      return;
    }
    if (rank === "ass") {
      playFromStart(cardPlaySound, "card-play", {
        volume: 0.38,
        playbackRate: 1.26,
        cooldownMs: 260,
        priority: 4,
        holdPriorityMs: 300,
      });
      scheduleSound(58, 4, () =>
        playFromStart(blackbirdSound, "blackbird", {
          volume: 0.43,
          playbackRate: 0.84,
          cooldownMs: 0,
          priority: 4,
        })
      );
      return;
    }
    playFromStart(blackbirdSound, "blackbird", {
      volume: 0.5,
      playbackRate: 1.12,
      cooldownMs: 240,
      priority: 4,
      holdPriorityMs: 300,
    });
    scheduleSound(80, 3, () =>
      playFromStart(cardDrawSound, "card-draw", {
        volume: 0.36,
        playbackRate: 0.96,
        cooldownMs: 0,
        priority: 3,
      })
    );
  };

  const playDrawChainAlert = (drawChainCount: number) => {
    const chain = Math.max(2, drawChainCount);
    const intensity = Math.min(5, Math.floor(chain / 2) + 2);
    playFromStart(roundEndSound, "round-end", {
      volume: Math.min(0.9, 0.45 + intensity * 0.08),
      playbackRate: Math.min(1.26, 1 + intensity * 0.06),
      cooldownMs: 260,
      priority: 4,
      holdPriorityMs: 340,
    });
  };

  const playElimination = () => {
    playFromStart(roundEndSound, "round-end", {
      volume: 0.82,
      playbackRate: 0.88,
      cooldownMs: 520,
      priority: 5,
      holdPriorityMs: 380,
    });
    scheduleSound(110, 4, () =>
      playFromStart(blackbirdSound, "blackbird", {
        volume: 0.52,
        playbackRate: 0.84,
        cooldownMs: 0,
        priority: 4,
      })
    );
  };

  const playVictory = () => {
    playFromStart(roundEndSound, "round-end", {
      volume: 0.9,
      playbackRate: 1.1,
      cooldownMs: 700,
      priority: 5,
      holdPriorityMs: 420,
    });
    scheduleSound(140, 4, () =>
      playFromStart(blackbirdSound, "blackbird", {
        volume: 0.65,
        playbackRate: 1.12,
        cooldownMs: 0,
        priority: 4,
      })
    );
  };

  const playRoundTransition = () => {
    playFromStart(cardPlaySound, "card-play", {
      volume: 0.46,
      playbackRate: 1.04,
      cooldownMs: 260,
      priority: 3,
    });
    scheduleSound(80, 2, () =>
      playFromStart(cardDrawSound, "card-draw", {
        volume: 0.4,
        playbackRate: 1.06,
        cooldownMs: 0,
        priority: 2,
      })
    );
  };

  const playInvalidAction = () => {
    playFromStart(cardPlaySound, "invalid", {
      volume: 0.22,
      playbackRate: 0.7,
      cooldownMs: 180,
      priority: 2,
    });
  };

  const playAmselSignature = useCallback((event: AmselSoundEvent, intensity: 1 | 2 | 3 | 4 | 5 = 3) => {
    switch (event) {
      case "CARD_PLAY":
        playBlackbird(Math.max(1, Math.min(3, intensity)) as 1 | 2 | 3 | 4 | 5);
        return;
      case "DRAW":
        playFromStart(blackbirdSound, "blackbird", {
          volume: 0.28,
          playbackRate: 1.08,
          cooldownMs: 180,
          priority: 2,
        });
        return;
      case "SPECIAL_7":
        playSpecialCard("7");
        return;
      case "SPECIAL_U":
        playSpecialCard("bube");
        return;
      case "SPECIAL_A":
        playSpecialCard("ass");
        return;
      case "SPECIAL_8":
        playSpecialCard("8");
        return;
      case "ELIMINATION":
        playElimination();
        return;
      case "WIN":
        playVictory();
        return;
      case "ERROR_INVALID":
        playInvalidAction();
        playFromStart(blackbirdSound, "blackbird", {
          volume: 0.22,
          playbackRate: 0.82,
          cooldownMs: 300,
          priority: 2,
        });
        return;
      default:
        return;
    }
  }, [blackbirdSound, playBlackbird, playElimination, playFromStart, playInvalidAction, playSpecialCard, playVictory]);

  return {
    soundsEnabled,
    setSoundsEnabled: persistSoundsEnabled,
    playCardPlay,
    playCardDraw,
    playRoundEnd,
    playBlackbird,
    playClutchCallout,
    playRivalryCallout,
    playTurnShift,
    playSpecialCard,
    playDrawChainAlert,
    playElimination,
    playVictory,
    playRoundTransition,
    playInvalidAction,
    playAmselSignature,
  };
}
