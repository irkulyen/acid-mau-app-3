import { Touchable } from "@/components/ui/button";
import { ScrollView, Text, View, ActivityIndicator, TextInput, Alert } from "react-native";
import { useState } from "react";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-provider";
import { trpc } from "@/lib/trpc";

export default function ProfileScreen() {
  const { user } = useAuth();
  const { data: profile, isLoading } = trpc.profile.me.useQuery(undefined, { enabled: !!user });
  const { data: premiumStatus } = trpc.premium.status.useQuery(undefined, { enabled: !!user });

  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const updateProfileMutation = trpc.profile.update.useMutation();
  const uploadAvatarMutation = trpc.profile.uploadAvatar.useMutation();
  const utils = trpc.useUtils();

  const estimateBase64Bytes = (b64: string) => Math.floor((b64.length * 3) / 4);

  const buildDataUri = (base64: string, mimeType: string) => `data:${mimeType};base64,${base64}`;

  const handleEditProfile = () => {
    if (profile) {
      setUsername(profile.username);
      setAvatarUrl(profile.avatarUrl || "");
      setIsEditing(true);
    }
  };

  const handleSaveProfile = async () => {
    if (!username.trim()) return;

    try {
      await updateProfileMutation.mutateAsync({
        username,
        avatarUrl: avatarUrl.trim() ? avatarUrl.trim() : null,
      });
      await utils.profile.me.invalidate();
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  const handlePickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Berechtigung fehlt", "Bitte erlaube den Zugriff auf deine Fotos.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        base64: false,
      });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.uri) {
        Alert.alert("Fehler", "Bild konnte nicht gelesen werden.");
        return;
      }

      // 1) Normalize to 512x512 JPEG and compress adaptively.
      //    This guarantees predictable upload size and fast rendering/caching.
      const compressCandidates = [0.82, 0.7, 0.58, 0.46, 0.36];
      let bestBase64: string | null = null;
      let mimeType = "image/jpeg";
      for (const compress of compressCandidates) {
        const processed = await manipulateAsync(
          asset.uri,
          [{ resize: { width: 512, height: 512 } }],
          {
            compress,
            format: SaveFormat.JPEG,
            base64: true,
          }
        );
        if (!processed.base64) continue;
        bestBase64 = processed.base64;
        if (estimateBase64Bytes(processed.base64) <= 320 * 1024) break;
      }

      if (!bestBase64) {
        Alert.alert("Fehler", "Bild konnte nicht verarbeitet werden.");
        return;
      }

      // 2) Preferred path: dedicated upload endpoint.
      // 3) Fallback path: older backend without profile.uploadAvatar -> save data URI via profile.update.
      try {
        const upload = await uploadAvatarMutation.mutateAsync({
          base64: bestBase64,
          mimeType,
        });
        setAvatarUrl(upload.avatarUrl);
      } catch (uploadErr: any) {
        const message = String(uploadErr?.message || uploadErr || "");
        if (!/No procedure found on path "profile\.uploadAvatar"/i.test(message)) {
          throw uploadErr;
        }
        // Legacy backend without binary avatar upload endpoint:
        // avoid DB-breaking data URI updates and show a clear actionable error.
        throw new Error("Dein Server unterstützt noch keinen Profilbild-Upload. Bitte Backend aktualisieren (profile.uploadAvatar).");
      }

      await utils.profile.me.invalidate();
      Alert.alert("Erfolg", "Profilbild aktualisiert.");
    } catch (error: any) {
      console.error("Failed to pick/upload avatar:", error);
      const rawMessage = String(error?.message || error || "");
      if (/Failed query: update `player_profiles`/i.test(rawMessage) || /Data too long for column/i.test(rawMessage)) {
        Alert.alert("Fehler", "Profilbild ist für diesen Server zu groß oder Upload wird dort noch nicht unterstützt.");
        return;
      }
      Alert.alert("Fehler", rawMessage || "Profilbild konnte nicht hochgeladen werden.");
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
            {(isEditing ? avatarUrl : profile.avatarUrl) ? (
              <Image
                source={{ uri: isEditing ? avatarUrl : (profile.avatarUrl || "") }}
                style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: "#32CD32" }}
                contentFit="cover"
              />
            ) : (
              <View className="w-24 h-24 rounded-full bg-primary items-center justify-center">
                <Text className="text-background text-4xl font-bold">
                  {profile.username.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {isEditing ? (
              <View className="w-full items-center gap-2">
                <Touchable
                  onPress={handlePickAvatar}
                  className="bg-surface border border-border px-5 py-2 rounded-lg active:opacity-80"
                >
                  <Text className="text-foreground font-semibold">
                    {uploadAvatarMutation.isPending ? "Lade Bild hoch..." : "Foto aus Galerie wählen"}
                  </Text>
                </Touchable>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Benutzername"
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground text-lg w-64 text-center"
                  autoFocus
                />
                <TextInput
                  value={avatarUrl}
                  onChangeText={setAvatarUrl}
                  placeholder="Profilbild URL (https://...)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground text-sm w-80 text-center"
                />
                <View className="flex-row gap-2">
                  <Touchable
                    onPress={handleSaveProfile}
                    className="bg-primary px-6 py-2 rounded-lg active:opacity-80"
                  >
                    <Text className="text-background font-semibold">Speichern</Text>
                  </Touchable>
                  <Touchable
                    onPress={() => {
                      setIsEditing(false);
                      setAvatarUrl(profile.avatarUrl || "");
                      setUsername(profile.username);
                    }}
                    className="bg-surface border border-border px-6 py-2 rounded-lg active:opacity-80"
                  >
                    <Text className="text-foreground font-semibold">Abbrechen</Text>
                  </Touchable>
                </View>
                {!!avatarUrl.trim() && (
                  <Touchable
                    onPress={() => setAvatarUrl("")}
                    className="bg-surface border border-border px-4 py-2 rounded-lg active:opacity-80 mt-1"
                  >
                    <Text className="text-foreground font-semibold">Profilbild entfernen</Text>
                  </Touchable>
                )}
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
