import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator, Platform, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { Touchable } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-provider";

export default function LoginScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.login.useMutation();

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
      
      console.log("[Login] Success!", result);
      console.log("[Login] Token received:", result.token.substring(0, 20) + "...");
      
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
      setError("Login fehlgeschlagen: " + (error.message || "Unbekannter Fehler"));
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
            Test-Account: test@test.com / test123
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
