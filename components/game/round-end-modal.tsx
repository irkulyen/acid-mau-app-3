import { Modal, Pressable, Text, View } from "react-native";
import type { GameState, Player } from "@/shared/game-types";

type RoundEndModalProps = {
  visible: boolean;
  roundNumber: number;
  players: GameState["players"];
  currentPlayer: Player;
  onReady: () => void;
};

export function RoundEndModal({ visible, roundNumber, players, currentPlayer, onReady }: RoundEndModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/70 items-center justify-center p-6">
        <View
          style={{
            borderRadius: 20,
            padding: 24,
            width: "100%",
            maxWidth: 380,
            backgroundColor: "rgba(20, 20, 20, 0.97)",
            borderWidth: 2,
            borderColor: "#4A4A4A",
          }}
        >
          <Text style={{ color: "#E8E8E8", fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 16 }}>
            🏁 Runde {roundNumber} beendet!
          </Text>

          <View style={{ backgroundColor: "rgba(0, 0, 0, 0.3)", borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <Text style={{ color: "#9BA1A6", fontSize: 12, marginBottom: 8 }}>Verlustpunkte:</Text>
            {players.map((player) => (
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

          <View style={{ backgroundColor: "rgba(0, 0, 0, 0.3)", borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <Text style={{ color: "#9BA1A6", fontSize: 12, marginBottom: 8 }}>Spieler-Status:</Text>
            {players
              .filter((player) => !player.isEliminated)
              .map((player) => (
                <View key={player.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 }}>
                  <Text style={{ color: "#E8E8E8" }}>{player.username}</Text>
                  <Text style={{ fontWeight: "600", color: player.isReady ? "#32CD32" : "#FFA500" }}>
                    {player.isReady ? "✅ READY" : "⏳ Wartet..."}
                  </Text>
                </View>
              ))}
          </View>

          {!currentPlayer.isEliminated && !currentPlayer.isReady && (
            <Pressable
              onPress={onReady}
              style={({ pressed }) => ({
                backgroundColor: "#228B22",
                borderRadius: 14,
                padding: 16,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800", fontSize: 16 }}>✅ READY für nächste Runde</Text>
            </Pressable>
          )}

          {currentPlayer.isReady && (
            <View style={{ backgroundColor: "rgba(255, 165, 0, 0.15)", borderWidth: 1, borderColor: "#FFA500", borderRadius: 14, padding: 14 }}>
              <Text style={{ color: "#E8E8E8", textAlign: "center", fontWeight: "600" }}>⏳ Warte auf andere Spieler...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
