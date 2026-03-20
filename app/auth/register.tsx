import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { Touchable } from "@/components/ui/button";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-provider";
import { getApiBaseUrl } from "@/constants/oauth";

export default function RegisterScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const registerMutation = trpc.auth.register.useMutation();
  const isRateLimitLike = (message: string) => {
    const normalized = (message || "").toLowerCase();
    return (
      normalized.includes("rate exceeded") ||
      normalized.includes("too many") ||
      normalized.includes("429") ||
      (normalized.includes("json parse error") && normalized.includes("unexpected character: r"))
    );
  };

  const handleRegister = async () => {
    setError("");
    
    // Validation
    if (!username.trim()) {
      setError("Bitte Benutzernamen eingeben");
      return;
    }
    if (username.length < 3) {
      setError("Benutzername muss mindestens 3 Zeichen lang sein");
      return;
    }
    if (!email.trim()) {
      setError("Bitte E-Mail eingeben");
      return;
    }
    // Einfache E-Mail-Validierung client-seitig
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein");
      return;
    }
    if (!password) {
      setError("Bitte Passwort eingeben");
      return;
    }
    if (password.length < 6) {
      setError("Passwort muss mindestens 6 Zeichen lang sein");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein");
      return;
    }

    setIsLoading(true);
    const startedAt = Date.now();
    const apiBaseUrl = getApiBaseUrl();
    const registerEndpoint = `${apiBaseUrl}/api/trpc/auth.register?batch=1`;
    if (__DEV__) {
      console.log("[Register] Request start", {
        platform: Platform.OS,
        envApiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? null,
        apiBaseUrl,
        registerEndpoint,
        payload: {
          email: email.trim(),
          username: username.trim(),
          hasPassword: Boolean(password),
        },
        startedAtIso: new Date(startedAt).toISOString(),
      });
    }
    try {
      const result = await registerMutation.mutateAsync({
        email: email.trim(),
        password,
        username: username.trim(),
      });
      if (__DEV__) {
        console.log("[Register] Request success", {
          durationMs: Date.now() - startedAt,
          userId: result.userId,
        });
      }
      
      // Token speichern (SecureStore für native, localStorage für web)
      if (result.token) {
        const { setSessionToken } = await import("@/lib/_core/auth");
        await setSessionToken(result.token);
        console.log("[Register] Token stored successfully");
        
        // Refresh auth state to load user data
        console.log("[Register] Refreshing auth state...");
        await refresh();
        console.log("[Register] Auth state refreshed");
        
        // Small delay to ensure AuthGuard picks up the change
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // AuthGuard will automatically redirect to onboarding
      console.log("[Register] Navigation will be handled by AuthGuard");
    } catch (error: any) {
      const message = error?.message ? String(error.message) : String(error ?? "");
      console.error("[Register] Request failed", {
        durationMs: Date.now() - startedAt,
        timeoutDetected: /timed out|timeout|abort/i.test(message),
        message,
        rawError: error,
      });
      let errorMessage = "Registrierung fehlgeschlagen";
      
      // Zod-Validierungsfehler zuerst prüfen
      if (error.data?.zodError) {
        const zodErrors = error.data.zodError.fieldErrors;
        if (zodErrors?.email) {
          errorMessage = "Bitte gib eine gültige E-Mail-Adresse ein";
        } else if (zodErrors?.password) {
          errorMessage = "Passwort muss mindestens 6 Zeichen lang sein";
        } else if (zodErrors?.username) {
          errorMessage = "Benutzername muss zwischen 3 und 50 Zeichen lang sein";
        }
      } else if (error.message) {
        // Rohe JSON-Strings oder Zod-Fehlermeldungen abfangen
        const msg = error.message;
        if (isRateLimitLike(msg)) {
          errorMessage = "Zu viele Anfragen. Bitte 30-60 Sekunden warten und erneut versuchen.";
        } else
        if (msg.startsWith('[') || msg.startsWith('{') || msg.includes('invalid_format')) {
          // Versuche spezifische Felder zu erkennen
          if (msg.includes('email')) {
            errorMessage = "Bitte gib eine gültige E-Mail-Adresse ein";
          } else if (msg.includes('password')) {
            errorMessage = "Passwort muss mindestens 6 Zeichen lang sein";
          } else if (msg.includes('username')) {
            errorMessage = "Benutzername muss zwischen 3 und 50 Zeichen lang sein";
          }
        } else if (msg.includes('already exists') || msg.includes('bereits')) {
          errorMessage = "Diese E-Mail oder dieser Benutzername ist bereits vergeben";
        } else {
          errorMessage = msg;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="mb-8">
            <Pressable
              onPress={() => router.replace("/auth/login" as any)}
              style={({ pressed }) => [{ marginBottom: 16, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text className="text-primary text-lg">← Zurück zum Login</Text>
            </Pressable>
            <Text className="text-4xl font-bold text-foreground mb-2">Registrieren</Text>
            <Text className="text-muted text-lg">Erstelle dein Acid-Mau Konto</Text>
          </View>

          {/* Error Message */}
          {error ? (
            <View className="bg-error/10 border border-error rounded-xl p-4 mb-4">
              <Text className="text-error font-semibold">{error}</Text>
            </View>
          ) : null}

          {/* Registration Form */}
          <View className="gap-4 mb-6">
            <View>
              <Text className="text-foreground mb-2 text-sm">Benutzername</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="Mindestens 3 Zeichen"
                placeholderTextColor="#8B7355"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-lg"
              />
            </View>

            <View>
              <Text className="text-foreground mb-2 text-sm">E-Mail</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="deine@email.com"
                placeholderTextColor="#8B7355"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-lg"
              />
            </View>

            <View>
              <Text className="text-foreground mb-2 text-sm">Passwort</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Mindestens 6 Zeichen"
                placeholderTextColor="#8B7355"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-lg"
              />
            </View>

            <View>
              <Text className="text-foreground mb-2 text-sm">Passwort bestätigen</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Passwort wiederholen"
                placeholderTextColor="#8B7355"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
                className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-lg"
              />
            </View>

            <Pressable
              onPress={handleRegister}
              disabled={isLoading}
              style={({ pressed }) => [{
                backgroundColor: '#228B22',
                borderRadius: 12,
                padding: 16,
                marginTop: 8,
                opacity: isLoading ? 0.5 : pressed ? 0.8 : 1,
              }]}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>Konto erstellen</Text>
              )}
            </Pressable>
          </View>

          {/* Login Link */}
          <View className="flex-row justify-center items-center mt-4">
            <Text className="text-muted">Bereits ein Konto? </Text>
            <Pressable
              onPress={() => router.replace("/auth/login" as any)}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <Text className="text-primary font-semibold">Anmelden</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
