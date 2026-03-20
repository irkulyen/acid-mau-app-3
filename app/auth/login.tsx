import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator, Platform, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { Touchable } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-provider";
import { getApiBaseUrl } from "@/constants/oauth";

export default function LoginScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.login.useMutation();
  const toFriendlyAuthError = (err: unknown): string => {
    const raw =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message ?? "")
        : String(err ?? "");
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
    if (__DEV__) {
      console.log("[Login] Button clicked - START");
    }
    setError("");
    
    if (!email.trim() || !password.trim()) {
      setError("Bitte E-Mail und Passwort eingeben");
      return;
    }

    setIsLoading(true);
    const startedAt = Date.now();
    const apiBaseUrl = getApiBaseUrl();
    const loginEndpoint = `${apiBaseUrl}/api/trpc/auth.login?batch=1`;
    if (__DEV__) {
      console.log("[Login] Request start", {
        platform: Platform.OS,
        envApiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? null,
        apiBaseUrl,
        loginEndpoint,
        payload: {
          email: email.trim(),
          hasPassword: Boolean(password),
        },
        startedAtIso: new Date(startedAt).toISOString(),
      });
    }
    
    try {
      const result = await loginMutation.mutateAsync({
        email: email.trim(),
        password,
      });
      
      if (__DEV__) {
        console.log("[Login] Request success", {
          durationMs: Date.now() - startedAt,
          userId: result.userId,
        });
      }
      
      // Store token in frontend (LocalStorage for web, SecureStore for native)
      const { setSessionToken } = await import("@/lib/_core/auth");
      await setSessionToken(result.token);
      if (__DEV__) {
        console.log("[Login] Token stored successfully");
      }
      
      // Refresh auth state to load user data
      if (__DEV__) {
        console.log("[Login] Refreshing auth state...");
      }
      await refresh();
      if (__DEV__) {
        console.log("[Login] Auth state refreshed");
      }
      
      // Small delay to ensure AuthGuard picks up the change
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (__DEV__) {
        console.log("[Login] Navigation will be handled by AuthGuard");
      }
      // AuthGuard will automatically redirect to home or onboarding
      
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message ?? "")
          : String(error ?? "");
      console.error("[Login] Request failed", {
        durationMs: Date.now() - startedAt,
        timeoutDetected: /timed out|timeout|abort/i.test(message),
        message,
        rawError: error,
      });
      setError("Login fehlgeschlagen: " + toFriendlyAuthError(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#4CAF50', textAlign: 'center', marginBottom: 8 }}>
          Acid-Mau
        </Text>
        <Text style={{ fontSize: 16, color: '#999', textAlign: 'center', marginBottom: 32 }}>
          Willkommen zurück!
        </Text>

        {error ? (
          <View style={{ backgroundColor: 'rgba(220, 20, 60, 0.1)', borderWidth: 1, borderColor: '#DC143C', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <Text style={{ color: '#DC143C', fontWeight: '600' }}>{error}</Text>
          </View>
        ) : null}

        <View style={{ marginBottom: 16 }}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="E-Mail"
            placeholderTextColor="#888"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
            style={{
              backgroundColor: '#2A2A2A',
              borderWidth: 1,
              borderColor: '#444',
              borderRadius: 12,
              padding: 16,
              color: '#FFF',
              fontSize: 16,
            }}
          />
        </View>

        <View style={{ marginBottom: 24 }}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Passwort"
            placeholderTextColor="#888"
            secureTextEntry
            editable={!isLoading}
            style={{
              backgroundColor: '#2A2A2A',
              borderWidth: 1,
              borderColor: '#444',
              borderRadius: 12,
              padding: 16,
              color: '#FFF',
              fontSize: 16,
            }}
          />
        </View>

        <Pressable
          onPress={handleEmailLogin}
          disabled={isLoading}
          style={({ pressed }) => [{
            backgroundColor: isLoading ? '#999' : '#4CAF50',
            borderRadius: 12,
            padding: 16,
            opacity: isLoading ? 0.6 : pressed ? 0.8 : 1,
          }]}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>
              Anmelden
            </Text>
          )}
        </Pressable>

        <View style={{ marginTop: 24, flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={{ color: '#999' }}>Noch kein Konto? </Text>
          <Pressable
            onPress={() => router.push("/auth/register" as any)}
            style={({ pressed }) => [{
              padding: 0,
              opacity: pressed ? 0.7 : 1,
            }]}
          >
            <Text style={{ color: '#4CAF50', fontWeight: '600' }}>Registrieren</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ color: '#666', fontSize: 12 }}>
            Test-Account (nur lokale Dev-Umgebung): test@test.com / test123
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
