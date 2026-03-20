// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import { execSync } from "child_process";
import os from "os";

function isTunnelStartMode(): boolean {
  const args = process.argv.map((arg) => arg.toLowerCase());
  if (args.includes("--tunnel")) return true;
  const hostIndex = args.findIndex((arg) => arg === "--host");
  if (hostIndex >= 0) {
    const hostValue = args[hostIndex + 1] || "";
    return hostValue === "tunnel";
  }
  return false;
}

function getLocalLanIp(): string | null {
  const networkInterfaces = os.networkInterfaces();
  const privateRanges = [
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
  ];

  for (const entries of Object.values(networkInterfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      const isIpv4 = entry.family === "IPv4";
      if (!isIpv4 || entry.internal) continue;
      if (privateRanges.some((pattern) => pattern.test(entry.address))) {
        return entry.address;
      }
    }
  }

  for (const entries of Object.values(networkInterfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      const isIpv4 = entry.family === "IPv4";
      if (isIpv4 && !entry.internal) {
        return entry.address;
      }
    }
  }

  try {
    const ipEn0 = execSync("ipconfig getifaddr en0", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    if (ipEn0) return ipEn0;
  } catch {}

  try {
    const ipEn1 = execSync("ipconfig getifaddr en1", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    if (ipEn1) return ipEn1;
  } catch {}

  return null;
}

// Backend URL fallback for local development only.
if (!process.env.EXPO_PUBLIC_API_URL && process.env.NODE_ENV !== "production") {
  if (isTunnelStartMode()) {
    console.warn(
      "⚠️ EXPO_PUBLIC_API_URL nicht gesetzt im Tunnel-Modus – kein LAN-Fallback. Runtime nutzt externe Tunnel-API-Auflösung.",
    );
  } else {
    const lanIp = getLocalLanIp();
    if (lanIp) {
      process.env.EXPO_PUBLIC_API_URL = `http://${lanIp}:3000`;
      console.warn(
        `⚠️ EXPO_PUBLIC_API_URL nicht gesetzt – nutze DEV-LAN-Fallback (${process.env.EXPO_PUBLIC_API_URL})`,
      );
    } else {
      console.warn(
        "⚠️ EXPO_PUBLIC_API_URL nicht gesetzt und keine LAN-IP erkannt – nutze Runtime-Host-Ermittlung in der App",
      );
    }
  }
}

// In production, EXPO_PUBLIC_API_URL must always be explicit.
if (!process.env.EXPO_PUBLIC_API_URL && process.env.NODE_ENV === "production") {
  throw new Error("EXPO_PUBLIC_API_URL ist nicht gesetzt");
}

// Bundle ID format: space.manus.<project_name_dots>.<timestamp>
// e.g., "my-app" created at 2024-01-15 10:30:45 -> "space.manus.my.app.t20240115103045"
// Bundle ID can only contain letters, numbers, and dots
// Android requires each dot-separated segment to start with a letter
const rawBundleId = "space.manus.acid.mau.app.t20260130220313";
const bundleId =
  rawBundleId
    .replace(/[-_]/g, ".") // Replace hyphens/underscores with dots
    .replace(/[^a-zA-Z0-9.]/g, "") // Remove invalid chars
    .replace(/\.+/g, ".") // Collapse consecutive dots
    .replace(/^\.+|\.+$/g, "") // Trim leading/trailing dots
    .toLowerCase()
    .split(".")
    .map((segment) => {
      // Android requires each segment to start with a letter
      // Prefix with 'x' if segment starts with a digit
      return /^[a-zA-Z]/.test(segment) ? segment : "x" + segment;
    })
    .join(".") || "space.manus.app";
// Extract timestamp from bundle ID and prefix with "manus" for deep link scheme
// e.g., "space.manus.my.app.t20240115103045" -> "manus20240115103045"
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  // App branding - update these values directly (do not use env vars)
  appName: "Acid-Mau",
  appSlug: "{{project_name}}",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

/** @type {import("expo/config").ExpoConfig} */
const config = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/game-logo.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/game-logo.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/game-logo.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/game-logo.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-audio",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/game-logo.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
