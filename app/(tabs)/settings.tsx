import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View, Alert, Switch } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Touchable } from "@/components/ui/button";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-provider";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";
import { useSocket } from "@/lib/socket-provider";
import { GAME_SFX_ENABLED_KEY } from "@/hooks/use-game-sounds";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const logoutMutation = trpc.auth.logout.useMutation();
  const { data: profile } = trpc.profile.me.useQuery(undefined, { enabled: !!user });
  const { closeAllRooms, closeEmptyRooms, isConnected, socket } = useSocket();
  const [closingRooms, setClosingRooms] = useState(false);
  const [closingEmptyRooms, setClosingEmptyRooms] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const normalizeAdminName = (value: string | null | undefined) =>
    (value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const isNamedAdmin = useMemo(() => {
    const names = [normalizeAdminName(profile?.username), normalizeAdminName(user?.name)];
    return names.includes("admin") || names.includes("irkulyen");
  }, [profile?.username, user?.name]);
  const isAdmin = isNamedAdmin;

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(GAME_SFX_ENABLED_KEY)
      .then((value) => {
        if (!mounted) return;
        setSoundEnabled(value !== "0");
      })
      .catch(() => {
        if (!mounted) return;
        setSoundEnabled(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onRoomsClosed = (data: { count: number }) => {
      setClosingRooms(false);
      Alert.alert("Erledigt", `${data.count} Räume wurden geschlossen.`);
    };
    const onEmptyRoomsClosed = (data: { count: number }) => {
      setClosingEmptyRooms(false);
      Alert.alert("Erledigt", `${data.count} leere Räume wurden bereinigt.`);
    };
    const onSocketError = (data: { message: string }) => {
      if (!closingRooms && !closingEmptyRooms) return;
      setClosingRooms(false);
      setClosingEmptyRooms(false);
      Alert.alert("Admin-Fehler", data?.message || "Unbekannter Fehler");
    };

    socket.on("admin:rooms-closed", onRoomsClosed);
    socket.on("admin:empty-rooms-closed", onEmptyRoomsClosed);
    socket.on("error", onSocketError);
    return () => {
      socket.off("admin:rooms-closed", onRoomsClosed);
      socket.off("admin:empty-rooms-closed", onEmptyRoomsClosed);
      socket.off("error", onSocketError);
    };
  }, [socket, closingRooms, closingEmptyRooms]);

  const handleLogout = async () => {
    console.log("[DEBUG] handleLogout called - DIRECT ACTION (no Alert)");
    try {
      // 1. Call server logout (clear cookie)
      await logoutMutation.mutateAsync();
      console.log("[DEBUG] Server logout successful");
      
      // 2. Clear client-side auth state
      await logout();
      console.log("[DEBUG] Client logout successful");
      
      // 3. Navigate to home
      router.replace("/");
      console.log("[DEBUG] Navigated to /");
    } catch (error) {
      console.error("[DEBUG] Logout failed:", error);
    }
  };

  return (
    <ScreenContainer className="p-6">
      <View className="mb-6">
        <Text className="text-3xl font-bold text-foreground">Einstellungen</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <View className="gap-6">
          {/* App Settings */}
          <View className="bg-surface rounded-2xl border border-border overflow-hidden">
            <Text className="text-foreground text-lg font-bold p-4 border-b border-border">
              App-Einstellungen
            </Text>
            
            <Touchable className="p-4 border-b border-border active:opacity-80">
              <Text className="text-foreground font-semibold">Benachrichtigungen</Text>
              <Text className="text-muted text-sm mt-1">
                Push-Benachrichtigungen verwalten
              </Text>
            </Touchable>
            
            <Touchable className="p-4 border-b border-border active:opacity-80">
              <Text className="text-foreground font-semibold">Sprache</Text>
              <Text className="text-muted text-sm mt-1">Deutsch</Text>
            </Touchable>
            
            <View className="p-4 flex-row items-center justify-between">
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text className="text-foreground font-semibold">Soundeffekte</Text>
                <Text className="text-muted text-sm mt-1">
                  Aktiviert Spiel-SFX fur Karten, Spezialmomente und Amsel
                </Text>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={(value) => {
                  setSoundEnabled(value);
                  void AsyncStorage.setItem(GAME_SFX_ENABLED_KEY, value ? "1" : "0");
                }}
                trackColor={{ false: "#6b7280", true: "#22c55e" }}
                thumbColor={soundEnabled ? "#f4fff8" : "#f4f4f5"}
              />
            </View>
          </View>

          {/* Game Settings */}
          <View className="bg-surface rounded-2xl border border-border overflow-hidden">
            <Text className="text-foreground text-lg font-bold p-4 border-b border-border">
              Spiel-Einstellungen
            </Text>
            
            <Touchable className="p-4 border-b border-border active:opacity-80">
              <Text className="text-foreground font-semibold">Kartendesign</Text>
              <Text className="text-muted text-sm mt-1">
                Wähle dein bevorzugtes Kartendesign
              </Text>
            </Touchable>
            
            <Touchable className="p-4 active:opacity-80">
              <Text className="text-foreground font-semibold">Tisch-Theme</Text>
              <Text className="text-muted text-sm mt-1">
                Passe den Spieltisch an
              </Text>
            </Touchable>
          </View>

          {/* Premium */}
          <View className="bg-warning rounded-2xl p-6 border border-warning">
            <Text className="text-background text-xl font-bold mb-2">
              ⭐ Premium werden
            </Text>
            <Text className="text-background text-sm mb-4 opacity-90">
              Werbefrei spielen, erweiterte Statistiken, private Lobbys und mehr
            </Text>
            <Touchable className="bg-background px-6 py-3 rounded-lg active:opacity-80">
              <Text className="text-warning font-bold text-center">
                Jetzt upgraden - 4,99€/Monat
              </Text>
            </Touchable>
          </View>

          {/* About */}
          <View className="bg-surface rounded-2xl border border-border overflow-hidden">
            <Text className="text-foreground text-lg font-bold p-4 border-b border-border">
              Über
            </Text>
            
            <Touchable className="p-4 border-b border-border active:opacity-80">
              <Text className="text-foreground font-semibold">Spielregeln</Text>
              <Text className="text-muted text-sm mt-1">
                Lerne die Regeln von Acid-Mau
              </Text>
            </Touchable>
            
            <Touchable className="p-4 border-b border-border active:opacity-80">
              <Text className="text-foreground font-semibold">Datenschutz</Text>
              <Text className="text-muted text-sm mt-1">
                Datenschutzerklärung lesen
              </Text>
            </Touchable>
            
            <Touchable className="p-4 border-b border-border active:opacity-80">
              <Text className="text-foreground font-semibold">Nutzungsbedingungen</Text>
              <Text className="text-muted text-sm mt-1">
                AGB lesen
              </Text>
            </Touchable>
            
            <View className="p-4">
              <Text className="text-foreground font-semibold">Version</Text>
              <Text className="text-muted text-sm mt-1">1.0.0</Text>
            </View>
          </View>

          {/* Admin Section */}
          {isAdmin && (
            <View className="bg-error rounded-2xl p-6 border border-error" style={{ opacity: 0.9 }}>
              <Text className="text-background text-lg font-bold mb-2">
                Admin
              </Text>
              <Touchable
                onPress={() => {
                  Alert.alert(
                    "Leere Räume schließen?",
                    "Schließt nur Räume ohne verbundene Spieler. Laufende Räume bleiben offen.",
                    [
                      { text: "Abbrechen", style: "cancel" },
                      {
                        text: "Leere schließen",
                        style: "destructive",
                        onPress: () => {
                          if (!isConnected) {
                            Alert.alert("Keine Verbindung", "Socket ist nicht verbunden.");
                            return;
                          }
                          setClosingEmptyRooms(true);
                          closeEmptyRooms(profile?.username || user?.name || "admin");
                        },
                      },
                    ]
                  );
                }}
                className="bg-background px-6 py-3 rounded-xl mb-3"
                disabled={closingEmptyRooms}
              >
                <Text className="text-error font-bold text-center">
                  {closingEmptyRooms ? "Bereinige..." : "Leere Räume schließen"}
                </Text>
              </Touchable>
              <Touchable
                onPress={() => {
                  Alert.alert(
                    "Alle Räume schließen?",
                    "Alle aktiven Spiele und Warteräume werden sofort beendet. Das kann nicht rückgängig gemacht werden.",
                    [
                      { text: "Abbrechen", style: "cancel" },
                      {
                        text: "Alle schließen",
                        style: "destructive",
                        onPress: () => {
                          if (!isConnected) {
                            Alert.alert("Keine Verbindung", "Socket ist nicht verbunden.");
                            return;
                          }
                          setClosingRooms(true);
                          closeAllRooms(profile?.username || user?.name || "admin");
                        },
                      },
                    ]
                  );
                }}
                className="bg-background px-6 py-3 rounded-xl"
                disabled={closingRooms}
              >
                <Text className="text-error font-bold text-center">
                  {closingRooms ? "Schließe Räume..." : "Alle Räume schließen"}
                </Text>
              </Touchable>
            </View>
          )}

          {/* Account Actions */}
          {user && (
            <View className="gap-3">
              <Touchable
                onPress={() => {
                  console.log("[DEBUG] Logout button PRESSED");
                  handleLogout();
                }}
                className="bg-error px-6 py-4 rounded-xl"
              >
                <Text className="text-background font-bold text-center text-lg">
                  Abmelden
                </Text>
              </Touchable>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
