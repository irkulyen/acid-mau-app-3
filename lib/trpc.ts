import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { Platform } from "react-native";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

/**
 * tRPC React client for type-safe API calls.
 *
 * IMPORTANT (tRPC v11): The `transformer` must be inside `httpBatchLink`,
 * NOT at the root createClient level. This ensures client and server
 * use the same serialization format (superjson).
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Creates the tRPC client with proper configuration.
 * Call this once in your app's root layout.
 */
export function createTRPCClient() {
  const apiBaseUrl = getApiBaseUrl();
  const trpcUrl = `${apiBaseUrl}/api/trpc`;
  if (__DEV__) {
    console.log("[tRPC] Client initialized", {
      platform: Platform.OS,
      apiBaseUrl: apiBaseUrl || "(relative)",
      trpcUrl,
    });
  }

  return trpc.createClient({
    links: [
      httpBatchLink({
        url: trpcUrl,
        transformer: superjson,
        // Send Bearer token in Authorization header + cookies as fallback
        async headers() {
          const token = await Auth.getSessionToken();
          if (token) {
            return {
              Authorization: `Bearer ${token}`,
            };
          }
          return {};
        },
        fetch(url, options) {
          const method = options?.method || "GET";
          if (__DEV__) {
            console.log("[tRPC] Request", { method, url: String(url) });
          }

          return fetch(url, {
            ...options,
            credentials: "include",
          }).catch((error) => {
            console.error("[tRPC] Network request failed", {
              method,
              url: String(url),
              apiBaseUrl: apiBaseUrl || "(relative)",
              platform: Platform.OS,
              message: error instanceof Error ? error.message : String(error),
            });
            throw error;
          });
        },
      }),
    ],
  });
}
