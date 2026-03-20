import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as ReactNative from "react-native";

// Extract scheme from bundle ID (last segment timestamp, prefixed with "manus")
// e.g., "space.manus.my.app.t20240115103045" -> "manus20240115103045"
const bundleId = "space.manus.acid.mau.app.t20260130220313";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  portal: process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL ?? "",
  server: process.env.EXPO_PUBLIC_OAUTH_SERVER_URL ?? "",
  appId: process.env.EXPO_PUBLIC_APP_ID ?? "",
  ownerId: process.env.EXPO_PUBLIC_OWNER_OPEN_ID ?? "",
  ownerName: process.env.EXPO_PUBLIC_OWNER_NAME ?? "",
  // Zentrale Backend-URL für REST + WebSocket.
  // In Produktion ist EXPO_PUBLIC_API_URL verpflichtend.
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
  deepLinkScheme: schemeFromBundleId,
};

export const OAUTH_PORTAL_URL = env.portal;
export const OAUTH_SERVER_URL = env.server;
export const APP_ID = env.appId;
export const OWNER_OPEN_ID = env.ownerId;
export const OWNER_NAME = env.ownerName;
export const API_BASE_URL = env.apiBaseUrl;
const runtimeConstants = Constants as unknown as {
  expoConfig?: { hostUri?: string };
  expoGoConfig?: { debuggerHost?: string };
  manifest?: { debuggerHost?: string; hostUri?: string };
};
const configuredDevApiPort = parseInt(process.env.EXPO_PUBLIC_API_PORT ?? "3000", 10);
const DEV_API_PORT = Number.isInteger(configuredDevApiPort) && configuredDevApiPort > 0
  ? configuredDevApiPort
  : 3000;
let lastBaseUrlLogKey = "";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function isExpoTunnelHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return normalized.endsWith(".exp.direct") || normalized.endsWith(".exp.host");
}

function extractHost(candidate: unknown): string | null {
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;

  const urlLike = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
  try {
    const parsed = new URL(urlLike);
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

function extractPort(candidate: string): number | null {
  const urlLike = candidate.includes("://") ? candidate : `http://${candidate}`;
  try {
    const parsed = new URL(urlLike);
    if (!parsed.port) return null;
    const parsedPort = parseInt(parsed.port, 10);
    return Number.isInteger(parsedPort) ? parsedPort : null;
  } catch {
    return null;
  }
}

function inferDevServerHost(): string | null {
  const linkingUrl = (() => {
    try {
      return Linking.createURL("/");
    } catch {
      return undefined;
    }
  })();
  const sourceCode = (ReactNative.NativeModules as Record<string, unknown> | undefined)
    ?.SourceCode as { scriptURL?: string } | undefined;

  const candidates = [
    runtimeConstants.expoConfig?.hostUri,
    runtimeConstants.expoGoConfig?.debuggerHost,
    runtimeConstants.manifest?.debuggerHost,
    runtimeConstants.manifest?.hostUri,
    linkingUrl,
    sourceCode?.scriptURL,
  ];

  for (const candidate of candidates) {
    const host = extractHost(candidate);
    if (host && !isLoopbackHost(host) && !isExpoTunnelHost(host)) {
      return host;
    }
  }

  for (const candidate of candidates) {
    const host = extractHost(candidate);
    if (host && !isExpoTunnelHost(host)) {
      return host;
    }
  }

  return null;
}

function logResolvedApiBaseUrl(reason: string, url: string, details?: Record<string, unknown>) {
  if (!__DEV__) return;
  const key = `${reason}:${url}`;
  if (key === lastBaseUrlLogKey) return;
  lastBaseUrlLogKey = key;
  console.log("[API] Resolved base URL", {
    reason,
    url,
    platform: ReactNative.Platform.OS,
    isDevice: Constants.isDevice,
    ...details,
  });
}

/**
 * Get the API base URL.
 * - Production: explicit EXPO_PUBLIC_API_URL required
 * - Development: safe local defaults to keep local startup/test flows usable
 */
export function getApiBaseUrl(): string {
  if (API_BASE_URL) {
    const explicitUrl = trimTrailingSlash(API_BASE_URL);
    if (__DEV__ && ReactNative.Platform.OS !== "web") {
      const explicitHost = extractHost(explicitUrl);
      if (explicitHost && isLoopbackHost(explicitHost)) {
        const inferredHost = inferDevServerHost();
        if (inferredHost && !isLoopbackHost(inferredHost)) {
          const protocol = explicitUrl.startsWith("https://") ? "https" : "http";
          const port = extractPort(explicitUrl) ?? DEV_API_PORT;
          const rewrittenUrl = `${protocol}://${inferredHost}:${port}`;
          console.warn(
            `[API] EXPO_PUBLIC_API_URL points to loopback on physical device (${explicitUrl}); using ${rewrittenUrl} instead.`,
          );
          logResolvedApiBaseUrl("explicit-loopback-rewritten", rewrittenUrl, {
            explicitUrl,
            inferredHost,
          });
          return rewrittenUrl;
        }
        console.error(
          `[API] EXPO_PUBLIC_API_URL (${explicitUrl}) points to loopback and no LAN host could be inferred.`,
        );
      }
    }
    logResolvedApiBaseUrl("explicit-env", explicitUrl);
    return explicitUrl;
  }

  if (__DEV__ && ReactNative.Platform.OS === "web") {
    // Web development can use same-origin requests.
    logResolvedApiBaseUrl("web-dev-relative", "");
    return "";
  }

  if (__DEV__) {
    const inferredHost = inferDevServerHost();
    if (ReactNative.Platform.OS !== "web" && inferredHost && !isLoopbackHost(inferredHost)) {
      const resolved = `http://${inferredHost}:${DEV_API_PORT}`;
      logResolvedApiBaseUrl("native-inferred-host", resolved, { inferredHost });
      return resolved;
    }

    if (ReactNative.Platform.OS === "android") {
      // Android emulator maps host localhost to 10.0.2.2
      const resolved = `http://10.0.2.2:${DEV_API_PORT}`;
      logResolvedApiBaseUrl("android-emulator-default", resolved);
      return resolved;
    }

    const resolved = `http://localhost:${DEV_API_PORT}`;
    if (ReactNative.Platform.OS !== "web") {
      console.error(
        "[API] No reachable LAN host inferred; falling back to localhost. Set EXPO_PUBLIC_API_URL if running on a physical device.",
      );
    }
    logResolvedApiBaseUrl("native-localhost-fallback", resolved);
    return resolved;
  }

  throw new Error("EXPO_PUBLIC_API_URL ist nicht gesetzt");
}

export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "manus-runtime-user-info";

const encodeState = (value: string) => {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }
  const BufferImpl = (globalThis as Record<string, any>).Buffer;
  if (BufferImpl) {
    return BufferImpl.from(value, "utf-8").toString("base64");
  }
  return value;
};

/**
 * Get the redirect URI for OAuth callback.
 * - Web: uses API server callback endpoint
 * - Native: uses deep link scheme
 */
export const getRedirectUri = () => {
  if (ReactNative.Platform.OS === "web") {
    return `${getApiBaseUrl()}/api/oauth/callback`;
  } else {
    return Linking.createURL("/oauth/callback", {
      scheme: env.deepLinkScheme,
    });
  }
};

export const getLoginUrl = () => {
  const redirectUri = getRedirectUri();
  const state = encodeState(redirectUri);

  const url = new URL(`${OAUTH_PORTAL_URL}/app-auth`);
  url.searchParams.set("appId", APP_ID);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

/**
 * Start OAuth login flow.
 *
 * On native platforms (iOS/Android), open the system browser directly so
 * the OAuth callback returns via deep link to the app.
 *
 * On web, this simply redirects to the login URL.
 *
 * @returns Always null, the callback is handled via deep link.
 */
export async function startOAuthLogin(): Promise<string | null> {
  const loginUrl = getLoginUrl();

  if (ReactNative.Platform.OS === "web") {
    // On web, just redirect
    if (typeof window !== "undefined") {
      window.location.href = loginUrl;
    }
    return null;
  }

  const supported = await Linking.canOpenURL(loginUrl);
  if (!supported) {
    console.warn("[OAuth] Cannot open login URL: URL scheme not supported");
    // 可考虑抛出错误或返回错误状态，让调用方处理
    return null;
  }

  try {
    await Linking.openURL(loginUrl);
  } catch (error) {
    console.error("[OAuth] Failed to open login URL:", error);
    // 可考虑抛出错误让调用方处理
  }

  // The OAuth callback will reopen the app via deep link.
  return null;
}
