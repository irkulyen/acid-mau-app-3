import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View, Alert } from "react-native";
import { Touchable } from "@/components/ui/button";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-provider";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";
import { useSocket } from "@/lib/socket-provider";
import { useCoreDesignTokens, withAlpha } from "@/lib/design-tokens";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const logoutMutation = trpc.auth.logout.useMutation();
  const { data: profile } = trpc.profile.me.useQuery(undefined, { enabled: !!user });
  const { closeAllRooms, closeEmptyRooms, isConnected, socket } = useSocket();
  const TOKENS = useCoreDesignTokens();
  const [closingRooms, setClosingRooms] = useState(false);
  const [closingEmptyRooms, setClosingEmptyRooms] = useState(false);
  const normalizeAdminName = (value: string | null | undefined) =>
    (value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const isNamedAdmin = useMemo(() => {
    const names = [normalizeAdminName(profile?.username), normalizeAdminName(user?.name)];
    return names.includes("admin") || names.includes("irkulyen");
  }, [profile?.username, user?.name]);
  const isAdmin = isNamedAdmin;

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
        <Text style={{ fontSize: 30, fontWeight: "700", color: TOKENS.TEXT_MAIN }}>Einstellungen</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <View className="gap-6">
          {/* App Settings */}
          <View
            style={{
              backgroundColor: TOKENS.SURFACE_1,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: withAlpha(TOKENS.TEXT_MUTED, 0.3),
              overflow: "hidden",
            }}
          >
            <Text
              style={{
                color: TOKENS.TEXT_MAIN,
                fontSize: 18,
                fontWeight: "700",
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: withAlpha(TOKENS.TEXT_MUTED, 0.24),
              }}
            >
              App-Einstellungen
            </Text>
            
            <Touchable
              style={({ pressed }) => ({
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: withAlpha(TOKENS.TEXT_MUTED, 0.24),
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: TOKENS.TEXT_MAIN, fontWeight: "600" }}>Benachrichtigungen</Text>
              <Text style={{ color: TOKENS.TEXT_MUTED, fontSize: 14, marginTop: 4 }}>
                Push-Benachrichtigungen verwalten
              </Text>
            </Touchable>
            
            <Touchable
              style={({ pressed }) => ({
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: withAlpha(TOKENS.TEXT_MUTED, 0.24),
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: TOKENS.TEXT_MAIN, fontWeight: "600" }}>Sprache</Text>
              <Text style={{ color: TOKENS.TEXT_MUTED, fontSize: 14, marginTop: 4 }}>Deutsch</Text>
            </Touchable>
            
            <Touchable
              style={({ pressed }) => ({
                padding: 16,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: TOKENS.TEXT_MAIN, fontWeight: "600" }}>Ton & Musik</Text>
              <Text style={{ color: TOKENS.TEXT_MUTED, fontSize: 14, marginTop: 4 }}>
                Soundeffekte und Hintergrundmusik
              </Text>
            </Touchable>
          </View>

          {/* Game Settings */}
          <View
            style={{
              backgroundColor: TOKENS.SURFACE_1,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: withAlpha(TOKENS.TEXT_MUTED, 0.3),
              overflow: "hidden",
            }}
          >
            <Text
              style={{
                color: TOKENS.TEXT_MAIN,
                fontSize: 18,
                fontWeight: "700",
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: withAlpha(TOKENS.TEXT_MUTED, 0.24),
              }}
            >
              Spiel-Einstellungen
            </Text>
            
            <Touchable
              style={({ pressed }) => ({
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: withAlpha(TOKENS.TEXT_MUTED, 0.24),
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: TOKENS.TEXT_MAIN, fontWeight: "600" }}>Kartendesign</Text>
              <Text style={{ color: TOKENS.TEXT_MUTED, fontSize: 14, marginTop: 4 }}>
                Wähle dein bevorzugtes Kartendesign
              </Text>
            </Touchable>
            
            <Touchable
              style={({ pressed }) => ({
                padding: 16,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: TOKENS.TEXT_MAIN, fontWeight: "600" }}>Tisch-Theme</Text>
              <Text style={{ color: TOKENS.TEXT_MUTED, fontSize: 14, marginTop: 4 }}>
                Passe den Spieltisch an
              </Text>
            </Touchable>
          </View>

          {/* Premium */}
          <View
            style={{
              backgroundColor: TOKENS.STATE_WARNING,
              borderRadius: 16,
              padding: 24,
              borderWidth: 1,
              borderColor: TOKENS.STATE_WARNING,
            }}
          >
            <Text style={{ color: TOKENS.TEXT_INVERSE, fontSize: 20, fontWeight: "700", marginBottom: 8 }}>
              ⭐ Premium werden
            </Text>
            <Text style={{ color: TOKENS.TEXT_INVERSE, fontSize: 14, marginBottom: 16, opacity: 0.9 }}>
              Werbefrei spielen, erweiterte Statistiken, private Lobbys und mehr
            </Text>
            <Touchable
              style={({ pressed }) => ({
                backgroundColor: TOKENS.TEXT_INVERSE,
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 12,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: TOKENS.STATE_WARNING, fontWeight: "700", textAlign: "center" }}>
                Jetzt upgraden - 4,99€/Monat
              </Text>
            </Touchable>
          </View>

          {/* About */}
          <View
            style={{
              backgroundColor: TOKENS.SURFACE_1,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: withAlpha(TOKENS.TEXT_MUTED, 0.3),
              overflow: "hidden",
            }}
          >
            <Text
              style={{
                color: TOKENS.TEXT_MAIN,
                fontSize: 18,
                fontWeight: "700",
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: withAlpha(TOKENS.TEXT_MUTED, 0.24),
              }}
            >
              Über
            </Text>
            
            <Touchable
              style={({ pressed }) => ({
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: withAlpha(TOKENS.TEXT_MUTED, 0.24),
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: TOKENS.TEXT_MAIN, fontWeight: "600" }}>Spielregeln</Text>
              <Text style={{ color: TOKENS.TEXT_MUTED, fontSize: 14, marginTop: 4 }}>
                Lerne die Regeln von Acid-Mau
              </Text>
            </Touchable>
            
            <Touchable
              style={({ pressed }) => ({
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: withAlpha(TOKENS.TEXT_MUTED, 0.24),
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: TOKENS.TEXT_MAIN, fontWeight: "600" }}>Datenschutz</Text>
              <Text style={{ color: TOKENS.TEXT_MUTED, fontSize: 14, marginTop: 4 }}>
                Datenschutzerklärung lesen
              </Text>
            </Touchable>
            
            <Touchable
              style={({ pressed }) => ({
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: withAlpha(TOKENS.TEXT_MUTED, 0.24),
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: TOKENS.TEXT_MAIN, fontWeight: "600" }}>Nutzungsbedingungen</Text>
              <Text style={{ color: TOKENS.TEXT_MUTED, fontSize: 14, marginTop: 4 }}>
                AGB lesen
              </Text>
            </Touchable>
            
            <View className="p-4">
              <Text style={{ color: TOKENS.TEXT_MAIN, fontWeight: "600" }}>Version</Text>
              <Text style={{ color: TOKENS.TEXT_MUTED, fontSize: 14, marginTop: 4 }}>1.0.0</Text>
            </View>
          </View>

          {/* Admin Section */}
          {isAdmin && (
            <View
              style={{
                backgroundColor: TOKENS.STATE_DANGER,
                borderRadius: 16,
                padding: 24,
                borderWidth: 1,
                borderColor: TOKENS.STATE_DANGER,
                opacity: 0.9,
              }}
            >
              <Text style={{ color: TOKENS.TEXT_INVERSE, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
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
                style={({ pressed }) => ({
                  backgroundColor: TOKENS.TEXT_INVERSE,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 12,
                  marginBottom: 12,
                  opacity: pressed ? 0.8 : 1,
                })}
                disabled={closingEmptyRooms}
              >
                <Text style={{ color: TOKENS.STATE_DANGER, fontWeight: "700", textAlign: "center" }}>
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
                style={({ pressed }) => ({
                  backgroundColor: TOKENS.TEXT_INVERSE,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 12,
                  opacity: pressed ? 0.8 : 1,
                })}
                disabled={closingRooms}
              >
                <Text style={{ color: TOKENS.STATE_DANGER, fontWeight: "700", textAlign: "center" }}>
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
                style={({ pressed }) => ({
                  backgroundColor: TOKENS.STATE_DANGER,
                  paddingHorizontal: 24,
                  paddingVertical: 16,
                  borderRadius: 12,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: TOKENS.TEXT_INVERSE, fontWeight: "700", textAlign: "center", fontSize: 18 }}>
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
