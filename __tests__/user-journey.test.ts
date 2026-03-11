import { describe, it, expect } from "vitest";

/**
 * User Journey Test: Registrierung → Login → Multiplayer
 * 
 * Testet die komplette User-Journey für neue Nutzer:
 * 1. Registrierung mit E-Mail/Passwort/Username
 * 2. Login mit den gleichen Credentials
 * 3. Profil abrufen (authentifiziert)
 */
describe("User Journey: Registrierung → Login", () => {
  it("sollte Registrierung, Login und Profil-Abruf erfolgreich durchführen", async () => {
    // Backend-URL aus Environment-Variable
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || "https://3000-izbr78esawvil2ox6c839-3f2186c3.us2.manus.computer";
    
    // Test-User-Daten (eindeutige E-Mail für jeden Test-Run)
    const testUser = {
      email: `testuser_${Date.now()}@test.com`,
      password: "test123",
      username: `TestUser${Date.now()}`,
    };

    console.log(`[Test] Registriere User: ${testUser.email}`);

    // 1. Registrierung
    const registerResponse = await fetch(`${apiUrl}/api/trpc/auth.register?batch=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ "0": testUser }]),
    });

    if (!registerResponse.ok) {
      const errorText = await registerResponse.text();
      console.error("[Test] Registrierung fehlgeschlagen:", registerResponse.status, errorText);
    }
    expect(registerResponse.ok).toBe(true);
    const registerData = await registerResponse.json();
    console.log("[Test] Registrierung-Response:", JSON.stringify(registerData, null, 2));

    // Prüfe, ob Registrierung erfolgreich war
    expect(registerData[0].result?.data?.json).toBeDefined();
    const registerResult = registerData[0].result.data.json;
    expect(registerResult.token).toBeDefined();
    expect(registerResult.user.email).toBe(testUser.email);

    console.log(`[Test] Registrierung erfolgreich. Token: ${registerResult.token.substring(0, 20)}...`);

    // 2. Login
    const loginResponse = await fetch(`${apiUrl}/api/trpc/auth.login?batch=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ "0": { email: testUser.email, password: testUser.password } }]),
    });

    expect(loginResponse.ok).toBe(true);
    const loginData = await loginResponse.json();
    console.log("[Test] Login-Response:", JSON.stringify(loginData, null, 2));

    // Prüfe, ob Login erfolgreich war
    expect(loginData[0].result?.data?.json).toBeDefined();
    const loginResult = loginData[0].result.data.json;
    expect(loginResult.token).toBeDefined();
    expect(loginResult.user.email).toBe(testUser.email);

    console.log(`[Test] Login erfolgreich. Token: ${loginResult.token.substring(0, 20)}...`);

    // 3. Profil abrufen (authentifiziert)
    const profileResponse = await fetch(`${apiUrl}/api/trpc/profile.me?batch=1`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${loginResult.token}`,
      },
    });

    expect(profileResponse.ok).toBe(true);
    const profileData = await profileResponse.json();
    console.log("[Test] Profil-Response:", JSON.stringify(profileData, null, 2));

    // Prüfe, ob Profil abgerufen wurde
    expect(profileData[0].result?.data?.json).toBeDefined();
    const profileResult = profileData[0].result.data.json;
    expect(profileResult.username).toBe(testUser.username);
    expect(profileResult.email).toBe(testUser.email);

    console.log(`[Test] Profil erfolgreich abgerufen: ${profileResult.username}`);
    console.log("[Test] ✅ User Journey erfolgreich abgeschlossen!");
  });
});
