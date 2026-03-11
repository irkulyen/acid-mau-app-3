import { useState } from "react";
import { ScrollView, Text, View, Alert } from "react-native";
import { Touchable } from "@/components/ui/button";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-provider";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";
import { useSocket } from "@/lib/socket-provider";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const logoutMutation = trpc.auth.logout.useMutation();
  const { data: profile } = trpc.profile.me.useQuery(undefined, { enabled: !!user });
  const { closeAllRooms, isConnected } = useSocket();
  const [closingRooms, setClosingRooms] = useState(false);

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
            
            <Touchable className="p-4 active:opacity-80">
              <Text className="text-foreground font-semibold">Ton & Musik</Text>
              <Text className="text-muted text-sm mt-1">
                Soundeffekte und Hintergrundmusik
              </Text>
            </Touchable>
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

          {/* Admin Section - Acid_King only */}
          {profile?.username === "Acid_King" && (
            <View className="bg-error rounded-2xl p-6 border border-error" style={{ opacity: 0.9 }}>
              <Text className="text-background text-lg font-bold mb-2">
                Admin
              </Text>
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
                          setClosingRooms(true);
                          closeAllRooms("Acid_King");
                          setTimeout(() => {
                            setClosingRooms(false);
                            Alert.alert("Erledigt", "Alle Räume wurden geschlossen.");
                          }, 2000);
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
