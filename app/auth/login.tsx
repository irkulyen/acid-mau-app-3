import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { Touchable } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-provider";
import { useCoreDesignTokens, withAlpha } from "@/lib/design-tokens";

export default function LoginScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const TOKENS = useCoreDesignTokens();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.login.useMutation();
  const toFriendlyAuthError = (err: any): string => {
    const raw = String(err?.message || "");
    const normalized = raw.toLowerCase();
    if (
      normalized.includes("rate exceeded") ||
      normalized.includes("too many") ||
      normalized.includes("429") ||
      (normalized.includes("json parse error") && normalized.includes("unexpected character: r"))
    ) {
      return "Zu viele Anfragen. Bitte 30-60 Sekunden warten und erneut anmelden.";
    }
    return raw || "Unbekannter Fehler";
  };

  const handleEmailLogin = async () => {
    console.log("[Login] Button clicked - START");
    setError("");
    
    if (!email.trim() || !password.trim()) {
      setError("Bitte E-Mail und Passwort eingeben");
      return;
    }

    setIsLoading(true);
    console.log("[Login] Sending request...");
    
    try {
      const result = await loginMutation.mutateAsync({
        email: email.trim(),
        password,
      });
      
      console.log("[Login] Success!");
      
      // Store token in frontend (LocalStorage for web, SecureStore for native)
      const { setSessionToken } = await import("@/lib/_core/auth");
      await setSessionToken(result.token);
      console.log("[Login] Token stored successfully");
      
      // Refresh auth state to load user data
      console.log("[Login] Refreshing auth state...");
      await refresh();
      console.log("[Login] Auth state refreshed");
      
      // Small delay to ensure AuthGuard picks up the change
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log("[Login] Navigation will be handled by AuthGuard");
      // AuthGuard will automatically redirect to home or onboarding
      
    } catch (error: any) {
      console.error("[Login] Error:", error);
      setError("Login fehlgeschlagen: " + toFriendlyAuthError(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="p-6">
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: TOKENS.SECONDARY_NEON, textAlign: 'center', marginBottom: 8 }}>
          Acid-Mau
        </Text>
        <Text style={{ fontSize: 16, color: TOKENS.TEXT_MUTED, textAlign: 'center', marginBottom: 32 }}>
          Willkommen zurück!
        </Text>

        {error ? (
          <View
            style={{
              backgroundColor: withAlpha(TOKENS.STATE_DANGER, 0.12),
              borderWidth: 1,
              borderColor: TOKENS.STATE_DANGER,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: TOKENS.STATE_DANGER, fontWeight: '600' }}>{error}</Text>
          </View>
        ) : null}

        <View style={{ marginBottom: 16 }}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="E-Mail"
            placeholderTextColor={TOKENS.TEXT_MUTED}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
            style={{
              backgroundColor: TOKENS.SURFACE_2,
              borderWidth: 1,
              borderColor: withAlpha(TOKENS.TEXT_MUTED, 0.5),
              borderRadius: 16,
              padding: 16,
              color: TOKENS.TEXT_MAIN,
              fontSize: 16,
            }}
          />
        </View>

        <View style={{ marginBottom: 24 }}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Passwort"
            placeholderTextColor={TOKENS.TEXT_MUTED}
            secureTextEntry
            editable={!isLoading}
            style={{
              backgroundColor: TOKENS.SURFACE_2,
              borderWidth: 1,
              borderColor: withAlpha(TOKENS.TEXT_MUTED, 0.5),
              borderRadius: 16,
              padding: 16,
              color: TOKENS.TEXT_MAIN,
              fontSize: 16,
            }}
          />
        </View>

        <Touchable
          onPress={handleEmailLogin}
          disabled={isLoading}
          style={({ pressed }) => ({
            backgroundColor: isLoading ? withAlpha(TOKENS.TEXT_MUTED, 0.7) : TOKENS.SECONDARY_NEON,
            borderRadius: 16,
            padding: 16,
            opacity: isLoading ? 0.6 : pressed ? 0.88 : 1,
          })}
        >
          {isLoading ? (
            <ActivityIndicator color={TOKENS.TEXT_INVERSE} />
          ) : (
            <Text style={{ color: TOKENS.TEXT_INVERSE, fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>
              Anmelden
            </Text>
          )}
        </Touchable>

        <View style={{ marginTop: 24, flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={{ color: TOKENS.TEXT_MUTED }}>Noch kein Konto? </Text>
          <Touchable
            onPress={() => router.push("/auth/register" as any)}
            style={({ pressed }) => ({
              padding: 0,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: TOKENS.SECONDARY_NEON, fontWeight: '600' }}>Registrieren</Text>
          </Touchable>
        </View>

        <View style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ color: TOKENS.TEXT_MUTED, fontSize: 12 }}>
            Test-Account: test@test.com / test123
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
