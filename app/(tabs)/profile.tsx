import { Touchable } from "@/components/ui/button";
import { ScrollView, Text, View, ActivityIndicator, TextInput } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-provider";
import { trpc } from "@/lib/trpc";

export default function ProfileScreen() {
  const { user } = useAuth();
  const { data: profile, isLoading } = trpc.profile.me.useQuery(undefined, { enabled: !!user });
  const { data: premiumStatus } = trpc.premium.status.useQuery(undefined, { enabled: !!user });

  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState("");

  const updateProfileMutation = trpc.profile.update.useMutation();
  const utils = trpc.useUtils();

  const handleEditProfile = () => {
    if (profile) {
      setUsername(profile.username);
      setIsEditing(true);
    }
  };

  const handleSaveProfile = async () => {
    if (!username.trim()) return;

    try {
      await updateProfileMutation.mutateAsync({ username });
      await utils.profile.me.invalidate();
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  if (!user) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <Text className="text-foreground text-xl font-semibold mb-4">
            Nicht angemeldet
          </Text>
          <Text className="text-muted text-center">
            Bitte melde dich an, um dein Profil zu sehen
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isLoading || !profile) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#228B22" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <View className="gap-6">
          {/* Header */}
          <View className="items-center gap-2 mt-4">
            <View className="w-24 h-24 rounded-full bg-primary items-center justify-center">
              <Text className="text-background text-4xl font-bold">
                {profile.username.charAt(0).toUpperCase()}
              </Text>
            </View>
            {isEditing ? (
              <View className="w-full items-center gap-2">
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Benutzername"
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground text-lg w-64 text-center"
                  autoFocus
                />
                <View className="flex-row gap-2">
                  <Touchable
                    onPress={handleSaveProfile}
                    className="bg-primary px-6 py-2 rounded-lg active:opacity-80"
                  >
                    <Text className="text-background font-semibold">Speichern</Text>
                  </Touchable>
                  <Touchable
                    onPress={() => setIsEditing(false)}
                    className="bg-surface border border-border px-6 py-2 rounded-lg active:opacity-80"
                  >
                    <Text className="text-foreground font-semibold">Abbrechen</Text>
                  </Touchable>
                </View>
              </View>
            ) : (
              <>
                <Text className="text-foreground text-2xl font-bold">{profile.username}</Text>
                <Touchable
                  onPress={handleEditProfile}
                  className="bg-surface border border-border px-4 py-2 rounded-lg active:opacity-80"
                >
                  <Text className="text-foreground font-semibold">Profil bearbeiten</Text>
                </Touchable>
              </>
            )}
          </View>

          {/* Premium Status */}
          {premiumStatus?.isPremium && (
            <View className="bg-warning rounded-2xl p-4 border border-warning">
              <Text className="text-background text-lg font-bold text-center">
                ⭐ Premium Mitglied
              </Text>
              <Text className="text-background text-sm text-center mt-1 opacity-90">
                Gültig bis: {premiumStatus.expiresAt ? new Date(premiumStatus.expiresAt).toLocaleDateString("de-DE") : "Unbekannt"}
              </Text>
            </View>
          )}

          {/* Statistics */}
          <View className="bg-surface rounded-2xl p-6 border border-border">
            <Text className="text-foreground text-xl font-bold mb-4">Statistiken</Text>
            
            <View className="gap-4">
              <View className="flex-row justify-between">
                <Text className="text-muted">Gespielte Spiele</Text>
                <Text className="text-foreground font-semibold">{profile.totalGamesPlayed}</Text>
              </View>
              
              <View className="flex-row justify-between">
                <Text className="text-muted">Gewonnene Spiele</Text>
                <Text className="text-primary font-semibold">{profile.totalGamesWon}</Text>
              </View>
              
              <View className="flex-row justify-between">
                <Text className="text-muted">Siegrate</Text>
                <Text className="text-foreground font-semibold">
                  {profile.totalGamesPlayed > 0
                    ? Math.round((profile.totalGamesWon / profile.totalGamesPlayed) * 100)
                    : 0}
                  %
                </Text>
              </View>
              
              <View className="h-px bg-border" />
              
              <View className="flex-row justify-between">
                <Text className="text-muted">Aktuelle Serie</Text>
                <Text className="text-warning font-semibold">{profile.currentWinStreak}</Text>
              </View>
              
              <View className="flex-row justify-between">
                <Text className="text-muted">Längste Serie</Text>
                <Text className="text-warning font-semibold">{profile.longestWinStreak}</Text>
              </View>
              
              <View className="h-px bg-border" />
              
              <View className="flex-row justify-between">
                <Text className="text-muted">Verlustpunkte gesamt</Text>
                <Text className="text-error font-semibold">{profile.totalLossPoints}</Text>
              </View>
            </View>
          </View>

          {/* Account Info */}
          <View className="bg-surface rounded-2xl p-6 border border-border">
            <Text className="text-foreground text-xl font-bold mb-4">Account</Text>
            
            <View className="gap-3">
              <View>
                <Text className="text-muted text-sm">E-Mail</Text>
                <Text className="text-foreground">{user.email || "Nicht verfügbar"}</Text>
              </View>
              
              <View>
                <Text className="text-muted text-sm">Mitglied seit</Text>
                <Text className="text-foreground">
                  {new Date(profile.createdAt).toLocaleDateString("de-DE")}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
