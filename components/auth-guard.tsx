import { useEffect, useRef } from "react";
import { useRouter, useSegments } from "expo-router";
import { useAuth } from "@/lib/auth-provider";
import { trpc } from "@/lib/trpc";
import { LoadingScreen } from "@/components/loading-screen";
import { useQueryClient } from "@tanstack/react-query";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const queryClient = useQueryClient();
  const { user, loading: authLoading, logout } = useAuth();
  const prevUserId = useRef<number | null>(null);
  
  // When user changes (login/logout), invalidate profile cache
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (currentUserId !== prevUserId.current) {
      console.log("[AuthGuard] User changed:", prevUserId.current, "->", currentUserId);
      prevUserId.current = currentUserId;
      
      if (currentUserId) {
        console.log("[AuthGuard] Invalidating profile cache...");
        queryClient.invalidateQueries({ queryKey: [["profile", "me"]] });
      } else {
        queryClient.removeQueries({ queryKey: [["profile", "me"]] });
      }
    }
  }, [user, queryClient]);

  const { data: profile, isLoading: profileLoading, error: profileError } = trpc.profile.me.useQuery(undefined, {
    enabled: !!user,
    retry: 1,
  });

  // If profile query fails with auth error, clear token and redirect to login
  useEffect(() => {
    if (profileError && user) {
      console.log("[AuthGuard] Profile query failed:", profileError.message);
      console.log("[AuthGuard] Clearing invalid session...");
      logout();
    }
  }, [profileError, user, logout]);

  useEffect(() => {
    console.log("[AuthGuard] State:", {
      authLoading,
      profileLoading,
      hasUser: !!user,
      hasProfile: !!profile,
      profileError: profileError?.message,
      segments,
      inAuthGroup: segments[0] === "auth",
    });

    if (authLoading) {
      console.log("[AuthGuard] Auth still loading, skipping navigation");
      return;
    }

    const inAuthGroup = segments[0] === "auth";
    const inOAuthCallback = segments[0] === "oauth";

    if (inOAuthCallback) {
      console.log("[AuthGuard] In OAuth callback, skipping");
      return;
    }

    // User not logged in -> redirect to login
    if (!user && !inAuthGroup) {
      console.log("[AuthGuard] No user and not in auth group -> redirect to login");
      router.replace("/auth/login" as any);
      return;
    }

    // If user exists but profile is still loading, wait
    if (user && profileLoading) {
      console.log("[AuthGuard] Profile still loading, skipping navigation");
      return;
    }

    // If profile query errored, don't redirect to onboarding - logout will handle it
    if (user && profileError) {
      console.log("[AuthGuard] Profile error, waiting for logout to complete");
      return;
    }

    // User logged in but no profile -> redirect to onboarding
    if (user && !profile && !profileLoading && !profileError && !inAuthGroup) {
      console.log("[AuthGuard] User but no profile (new user) -> redirect to onboarding");
      router.replace("/auth/onboarding" as any);
      return;
    }

    // User logged in with profile and in auth screens -> redirect to home
    if (user && profile && inAuthGroup) {
      console.log("[AuthGuard] User with profile in auth group -> redirect to home");
      router.replace("/");
      return;
    }

    console.log("[AuthGuard] No navigation needed");
  }, [user, profile, segments, authLoading, profileLoading, profileError]);

  // Show loading screen while checking auth
  if (authLoading || (user && profileLoading)) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}
