import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";

type AuthContextType = {
  user: Auth.User | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    console.log("[AuthProvider] fetchUser called");
    try {
      setLoading(true);
      setError(null);

      const sessionToken = await Auth.getSessionToken();
      console.log(
        "[AuthProvider] Session token:",
        sessionToken ? `present (${sessionToken.substring(0, 20)}...)` : "missing",
      );

      if (!sessionToken) {
        console.log("[AuthProvider] No session token, setting user to null");
        setUser(null);
        return;
      }

      // Use cached user info first
      const cachedUser = await Auth.getUserInfo();
      console.log("[AuthProvider] Cached user:", cachedUser);

      if (cachedUser) {
        console.log("[AuthProvider] Using cached user info");
        setUser(cachedUser);
      } else {
        // No cached user but have token - fetch from API
        console.log("[AuthProvider] No cached user, fetching from API...");
        try {
          const apiUser = await Api.getMe();
          if (apiUser) {
            const userInfo: Auth.User = {
              id: apiUser.id,
              openId: apiUser.openId,
              name: apiUser.name,
              email: apiUser.email,
              loginMethod: apiUser.loginMethod,
              lastSignedIn: new Date(apiUser.lastSignedIn),
            };
            setUser(userInfo);
            await Auth.setUserInfo(userInfo);
            console.log("[AuthProvider] User set from API:", userInfo);
          } else {
            console.log("[AuthProvider] No authenticated user from API");
            setUser(null);
          }
        } catch (err) {
          console.error("[AuthProvider] Failed to fetch user from API:", err);
          setUser(null);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[AuthProvider] fetchUser error:", error);
      setError(error);
      setUser(null);
    } finally {
      setLoading(false);
      console.log("[AuthProvider] fetchUser completed");
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch (err) {
      console.error("[AuthProvider] Logout API call failed:", err);
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    console.log("[AuthProvider] Initial load, platform:", Platform.OS);
    // Check for cached user info first for faster initial load
    Auth.getUserInfo().then((cachedUser) => {
      console.log("[AuthProvider] Cached user check:", cachedUser);
      if (cachedUser) {
        console.log("[AuthProvider] Setting cached user immediately");
        setUser(cachedUser);
        setLoading(false);
      } else {
        fetchUser();
      }
    });
  }, [fetchUser]);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      isAuthenticated,
      refresh: fetchUser,
      logout,
    }),
    [user, loading, error, isAuthenticated, fetchUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
