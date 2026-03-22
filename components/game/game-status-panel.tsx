import { Text, View } from "react-native";
import type { GamePriorityPill, UiTone } from "@/lib/ux-status";

type GameStatusPanelProps = {
  decisionPills: GamePriorityPill[];
  hasWishSuit: boolean;
  wishSuitLabel: string;
  showClutchOrRivalryBanner: boolean;
  clutchBanner: string | null;
  rivalryBanner: string | null;
  showMomentStatusBanner: boolean;
  momentBanner: string | null;
};

const pillPalette: Record<UiTone, { bg: string; border: string; text: string }> = {
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

export function GameStatusPanel({
  decisionPills,
  hasWishSuit,
  wishSuitLabel,
  showClutchOrRivalryBanner,
  clutchBanner,
  rivalryBanner,
  showMomentStatusBanner,
  momentBanner,
}: GameStatusPanelProps) {
  return (
    <>
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
              <Text style={{ color: palette.text, fontSize: 12, fontWeight: "800" }}>{pill.label}</Text>
            </View>
          );
        })}
      </View>

      {hasWishSuit && (
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
    </>
  );
}
