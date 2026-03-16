import { useState } from "react";
import { View, Text, ScrollView, Alert, Share, Platform } from "react-native";
import { Image } from "expo-image";
import { Touchable } from "@/components/ui/button";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import * as Clipboard from "expo-clipboard";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-provider";
import { trpc } from "@/lib/trpc";
import { useCoreDesignTokens, withAlpha } from "@/lib/design-tokens";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: profile } = trpc.profile.me.useQuery(undefined, { enabled: !!user });
  const TOKENS = useCoreDesignTokens();

  const handleQuickPlay = () => {
    // Quick play: join any available room
    router.push("/lobby/join" as any);
  };

  const handleCreateRoom = () => {
    router.push("/lobby/create" as any);
  };

  const handleJoinRoom = () => {
    router.push("/lobby/join" as any);
  };

  const handlePractice = () => {
    router.push("/practice" as any);
  };

  const handleInviteFriends = async () => {
    const appUrl = "https://8081-izbr78esawvil2ox6c839-3f2186c3.us2.manus.computer";
    const message = `Spiel Acid-Mau mit mir! 🃏\n\nÖffne diesen Link auf deinem Handy:\n${appUrl}\n\nDu brauchst die Expo Go App (kostenlos im App Store/Play Store).`;

    try {
      if (Platform.OS === "web") {
        // Web: Try Web Share API first, fallback to clipboard
        if (navigator.share) {
          await navigator.share({ title: "Acid-Mau", text: message });
        } else {
          await Clipboard.setStringAsync(message);
          Alert.alert("Link kopiert! ✅", "Schicke ihn deinen Freunden per WhatsApp, Mail oder SMS!");
        }
      } else {
        // Native: React Native Share API (öffnet nativen Share-Dialog)
        await Share.share({
          message,
          title: "Acid-Mau - Freunde einladen",
        });
      }
    } catch (error: any) {
      // User cancelled share = no error
      if (error?.message === "User did not share") return;
      console.error("Share error:", error);
      // Fallback: Clipboard
      try {
        await Clipboard.setStringAsync(message);
        Alert.alert("Link kopiert! ✅", "Schicke ihn deinen Freunden per WhatsApp, Mail oder SMS!");
      } catch (clipError) {
        console.error("Clipboard fallback error:", clipError);
      }
    }
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-8">
          {/* Hero Section */}
          <View className="items-center gap-3 mt-4">
            <Image
              source={require("@/assets/branding/crazy-amsel-logo.png")}
              style={{ width: 132, height: 132 }}
              contentFit="contain"
            />
            <Text className="text-4xl font-bold text-primary" style={{ marginTop: -4 }}>Acid-Mau</Text>
            <Text className="text-base text-muted text-center">
              Das verrückte Kartenspiel
            </Text>
            {profile && (
              <View
                style={{
                  marginTop: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: TOKENS.SURFACE_1,
                  borderWidth: 1,
                  borderColor: withAlpha(TOKENS.TEXT_MUTED, 0.28),
                }}
              >
                <Text style={{ color: TOKENS.TEXT_MAIN, fontWeight: "600" }}>
                  Willkommen, {profile.username}!
                </Text>
              </View>
            )}
          </View>

          {/* Game Modes */}
          <View className="gap-4 mt-4">
            {/* Quick Play */}
            <Touchable
              onPress={handleQuickPlay}
              style={({ pressed }) => ({
                backgroundColor: TOKENS.SECONDARY_NEON,
                paddingHorizontal: 32,
                paddingVertical: 24,
                borderRadius: 16,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ color: TOKENS.TEXT_INVERSE, fontSize: 24, fontWeight: "700", textAlign: "center" }}>
                Schnellspiel
              </Text>
              <Text style={{ color: TOKENS.TEXT_INVERSE, fontSize: 14, textAlign: "center", marginTop: 4, opacity: 0.9 }}>
                Finde sofort ein Spiel
              </Text>
            </Touchable>

            {/* Create Room */}
            <Touchable
              onPress={handleCreateRoom}
              style={({ pressed }) => ({
                backgroundColor: TOKENS.SURFACE_1,
                paddingHorizontal: 32,
                paddingVertical: 20,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: withAlpha(TOKENS.TEXT_MUTED, 0.3),
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ color: TOKENS.TEXT_MAIN, fontSize: 20, fontWeight: "600", textAlign: "center" }}>
                Raum erstellen
              </Text>
              <Text style={{ color: TOKENS.TEXT_MUTED, fontSize: 14, textAlign: "center", marginTop: 4 }}>
                Spiele mit Freunden
              </Text>
            </Touchable>

            {/* Join Room */}
            <Touchable
              onPress={handleJoinRoom}
              style={({ pressed }) => ({
                backgroundColor: TOKENS.SURFACE_1,
                paddingHorizontal: 32,
                paddingVertical: 20,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: withAlpha(TOKENS.TEXT_MUTED, 0.3),
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ color: TOKENS.TEXT_MAIN, fontSize: 20, fontWeight: "600", textAlign: "center" }}>
                Raum beitreten
              </Text>
              <Text style={{ color: TOKENS.TEXT_MUTED, fontSize: 14, textAlign: "center", marginTop: 4 }}>
                Mit Code beitreten
              </Text>
            </Touchable>

            {/* Practice Mode */}
            <Touchable
              onPress={handlePractice}
              style={({ pressed }) => ({
                backgroundColor: TOKENS.SURFACE_1,
                paddingHorizontal: 32,
                paddingVertical: 20,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: withAlpha(TOKENS.TEXT_MUTED, 0.3),
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ color: TOKENS.TEXT_MAIN, fontSize: 20, fontWeight: "600", textAlign: "center" }}>
                Übungsmodus
              </Text>
              <Text style={{ color: TOKENS.TEXT_MUTED, fontSize: 14, textAlign: "center", marginTop: 4 }}>
                Spiele gegen KI
              </Text>
            </Touchable>

            {/* Invite Friends */}
            <Touchable
              onPress={handleInviteFriends}
              style={({ pressed }) => ({
                backgroundColor: TOKENS.STATE_SUCCESS,
                paddingHorizontal: 32,
                paddingVertical: 20,
                borderRadius: 16,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ color: TOKENS.TEXT_INVERSE, fontSize: 20, fontWeight: "600", textAlign: "center" }}>
                🎉 Freunde einladen
              </Text>
              <Text style={{ color: TOKENS.TEXT_INVERSE, fontSize: 14, textAlign: "center", marginTop: 4, opacity: 0.9 }}>
                Link zum Teilen
              </Text>
            </Touchable>
          </View>

          {/* Stats Preview */}
          {profile && (
            <View
              style={{
                marginTop: 16,
                backgroundColor: TOKENS.SURFACE_1,
                borderRadius: 16,
                padding: 24,
                borderWidth: 1,
                borderColor: withAlpha(TOKENS.TEXT_MUTED, 0.3),
              }}
            >
              <Text style={{ color: TOKENS.TEXT_MAIN, fontSize: 18, fontWeight: "600", marginBottom: 16 }}>
                Deine Statistiken
              </Text>
              <View className="flex-row justify-around">
                <View className="items-center">
                  <Text style={{ color: TOKENS.SECONDARY_NEON, fontSize: 36, fontWeight: "700" }}>
                    {profile.totalGamesWon}
                  </Text>
                  <Text style={{ color: TOKENS.TEXT_MUTED, fontSize: 14, marginTop: 4 }}>Siege</Text>
                </View>
                <View className="items-center">
                  <Text style={{ color: TOKENS.TEXT_MAIN, fontSize: 36, fontWeight: "700" }}>
                    {profile.totalGamesPlayed}
                  </Text>
                  <Text style={{ color: TOKENS.TEXT_MUTED, fontSize: 14, marginTop: 4 }}>Spiele</Text>
                </View>
                <View className="items-center">
                  <Text style={{ color: TOKENS.STATE_WARNING, fontSize: 36, fontWeight: "700" }}>
                    {profile.currentWinStreak}
                  </Text>
                  <Text style={{ color: TOKENS.TEXT_MUTED, fontSize: 14, marginTop: 4 }}>Serie</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
