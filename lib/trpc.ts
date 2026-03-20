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
let trpcRequestCounter = 0;

/**
 * Creates the tRPC client with proper configuration.
 * Call this once in your app's root layout.
 */
export function createTRPCClient() {
  const apiBaseUrl = getApiBaseUrl();
  const trpcUrl = `${apiBaseUrl}/api/trpc`;
  const timeoutMsRaw = parseInt(process.env.EXPO_PUBLIC_TRPC_TIMEOUT_MS ?? "20000", 10);
  const requestTimeoutMs = Number.isInteger(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 20000;
  if (__DEV__) {
    console.log("[tRPC] Client initialized", {
      platform: Platform.OS,
      envApiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? null,
      apiBaseUrl: apiBaseUrl || "(relative)",
      trpcUrl,
      requestTimeoutMs,
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
          const requestId = ++trpcRequestCounter;
          const startedAt = Date.now();
          let timedOut = false;
          const timeoutController = new AbortController();
          const existingSignal = options?.signal;
          const onExternalAbort = () => timeoutController.abort();
          if (existingSignal) {
            if (existingSignal.aborted) timeoutController.abort();
            else existingSignal.addEventListener("abort", onExternalAbort, { once: true });
          }
          const timeoutHandle = setTimeout(() => {
            timedOut = true;
            timeoutController.abort();
          }, requestTimeoutMs);
          if (__DEV__) {
            console.log("[tRPC] Request start", {
              requestId,
              method,
              url: String(url),
              apiBaseUrl: apiBaseUrl || "(relative)",
              platform: Platform.OS,
              timeoutMs: requestTimeoutMs,
            });
          }

          return fetch(url, {
            ...options,
            credentials: "include",
            signal: timeoutController.signal,
          })
            .then((response) => {
              if (__DEV__) {
                console.log("[tRPC] Request end", {
                  requestId,
                  method,
                  url: String(url),
                  status: response.status,
                  ok: response.ok,
                  durationMs: Date.now() - startedAt,
                });
              }
              return response;
            })
            .catch((error) => {
              const message = error instanceof Error ? error.message : String(error);
              const durationMs = Date.now() - startedAt;
              const timeoutDetected =
                timedOut ||
                /timed out|timeout|abort/i.test(message);
              console.error("[tRPC] Request failed", {
                requestId,
                method,
                url: String(url),
                apiBaseUrl: apiBaseUrl || "(relative)",
                platform: Platform.OS,
                timeoutDetected,
                timeoutMs: requestTimeoutMs,
                durationMs,
                message,
              });
              if (timedOut) {
                throw new Error(`Network request timed out after ${requestTimeoutMs}ms`);
              }
              throw error;
            })
            .finally(() => {
              clearTimeout(timeoutHandle);
              if (existingSignal) {
                existingSignal.removeEventListener("abort", onExternalAbort);
              }
            });
        },
      }),
    ],
  });
}
