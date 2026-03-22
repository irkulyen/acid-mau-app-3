import { Touchable } from "@/components/ui/button";
import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-provider";
import { trpc } from "@/lib/trpc";

export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const createProfileMutation = trpc.profile.create.useMutation();

  const handleComplete = async () => {
    console.log("[Onboarding] Button clicked - START");
    setError("");
    
    if (!username.trim()) {
      setError("Bitte Benutzernamen eingeben");
      return;
    }

    if (username.length < 3) {
      setError("Benutzername muss mindestens 3 Zeichen lang sein");
      return;
    }

    if (!user) {
      setError("Nicht angemeldet");
      console.error("[Onboarding] No user found");
      return;
    }
    
    console.log("[Onboarding] Creating profile for user:", user.id, "username:", username);

    setIsLoading(true);
    try {
      console.log("[Onboarding] Sending profile creation request...");
      const result = await createProfileMutation.mutateAsync({ username });
      console.log("[Onboarding] Profile created successfully:", result);
      console.log("[Onboarding] Redirecting to home...");
      router.replace("/");
    } catch (error: any) {
      console.error("[Onboarding] Error:", error);
      setError(error.message || "Profil konnte nicht erstellt werden");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="p-6">
      <View className="flex-1 justify-center">
        {/* Header */}
        <View className="items-center mb-12">
          <Text className="text-6xl mb-4">🃏</Text>
          <Text className="text-4xl font-bold text-foreground mb-2">Willkommen!</Text>
          <Text className="text-muted text-lg text-center">
            Wähle einen Benutzernamen für dein CrazyAmsel Profil
          </Text>
        </View>

        {/* Error Message */}
        {error ? (
          <View className="bg-error/10 border border-error rounded-xl p-4 mb-4">
            <Text className="text-error font-semibold">{error}</Text>
          </View>
        ) : null}

        {/* Username Input */}
        <View className="gap-6">
          <View>
            <Text className="text-foreground font-semibold mb-2 text-lg">Benutzername</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="z.B. KartenMeister"
              placeholderTextColor="#8B7355"
              autoCapitalize="none"
              maxLength={20}
              className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-lg"
            />
            <Text className="text-muted text-sm mt-2">
              Mindestens 3 Zeichen, maximal 20 Zeichen
            </Text>
          </View>

          <Touchable
            onPress={handleComplete}
            disabled={isLoading}
            className="bg-primary rounded-xl p-5 active:opacity-80 disabled:opacity-50"
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-background font-bold text-xl text-center">
                Los geht's!
              </Text>
            )}
          </Touchable>
        </View>

        {/* Info Box */}
        <View className="mt-12 bg-surface rounded-xl p-4 border border-border">
          <Text className="text-muted text-sm text-center">
            Dein Benutzername wird anderen Spielern angezeigt und kann später geändert werden
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
