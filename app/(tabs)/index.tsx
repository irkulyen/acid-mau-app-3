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

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: profile } = trpc.profile.me.useQuery(undefined, { enabled: !!user });

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
              source={require("@/assets/images/acid-mau-logo.png")}
              style={{ width: 120, height: 120, borderRadius: 20 }}
              contentFit="cover"
            />
            <Text className="text-4xl font-bold text-primary" style={{ marginTop: -4 }}>Acid-Mau</Text>
            <Text className="text-base text-muted text-center">
              Das verrückte Kartenspiel
            </Text>
            {profile && (
              <View className="mt-2 px-4 py-2 bg-surface rounded-full">
                <Text className="text-foreground font-semibold">
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
              className="bg-primary px-8 py-6 rounded-2xl"
            >
              <Text className="text-background text-2xl font-bold text-center">
                Schnellspiel
              </Text>
              <Text className="text-background text-sm text-center mt-1 opacity-90">
                Finde sofort ein Spiel
              </Text>
            </Touchable>

            {/* Create Room */}
            <Touchable
              onPress={handleCreateRoom}
              className="bg-surface px-8 py-5 rounded-2xl border border-border"
            >
              <Text className="text-foreground text-xl font-semibold text-center">
                Raum erstellen
              </Text>
              <Text className="text-muted text-sm text-center mt-1">
                Spiele mit Freunden
              </Text>
            </Touchable>

            {/* Join Room */}
            <Touchable
              onPress={handleJoinRoom}
              className="bg-surface px-8 py-5 rounded-2xl border border-border"
            >
              <Text className="text-foreground text-xl font-semibold text-center">
                Raum beitreten
              </Text>
              <Text className="text-muted text-sm text-center mt-1">
                Mit Code beitreten
              </Text>
            </Touchable>

            {/* Practice Mode */}
            <Touchable
              onPress={handlePractice}
              className="bg-surface px-8 py-5 rounded-2xl border border-border"
            >
              <Text className="text-foreground text-xl font-semibold text-center">
                Übungsmodus
              </Text>
              <Text className="text-muted text-sm text-center mt-1">
                Spiele gegen KI
              </Text>
            </Touchable>

            {/* Invite Friends */}
            <Touchable
              onPress={handleInviteFriends}
              className="bg-success px-8 py-5 rounded-2xl"
            >
              <Text className="text-background text-xl font-semibold text-center">
                🎉 Freunde einladen
              </Text>
              <Text className="text-background text-sm text-center mt-1 opacity-90">
                Link zum Teilen
              </Text>
            </Touchable>
          </View>

          {/* Stats Preview */}
          {profile && (
            <View className="mt-4 bg-surface rounded-2xl p-6 border border-border">
              <Text className="text-foreground text-lg font-semibold mb-4">
                Deine Statistiken
              </Text>
              <View className="flex-row justify-around">
                <View className="items-center">
                  <Text className="text-3xl font-bold text-primary">
                    {profile.totalGamesWon}
                  </Text>
                  <Text className="text-muted text-sm mt-1">Siege</Text>
                </View>
                <View className="items-center">
                  <Text className="text-3xl font-bold text-foreground">
                    {profile.totalGamesPlayed}
                  </Text>
                  <Text className="text-muted text-sm mt-1">Spiele</Text>
                </View>
                <View className="items-center">
                  <Text className="text-3xl font-bold text-warning">
                    {profile.currentWinStreak}
                  </Text>
                  <Text className="text-muted text-sm mt-1">Serie</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
