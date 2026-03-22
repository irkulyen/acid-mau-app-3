// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
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

const env = {
  // App branding - update these values directly (do not use env vars)
  appName: "CrazyAmsel",
  appSlug: "crazyamsel",
  scheme: "crazyamsel",
  iosBundleId: "com.maikscheibe.crazyamsel",
  androidPackage: "com.maikscheibe.crazyamsel",
};

// React Compiler slows down first-time Metro bundle compilation in dev tunnel mode.
// Keep it enabled for production builds, allow explicit opt-in for development.
const enableReactCompiler =
  process.env.NODE_ENV === "production" || process.env.EXPO_ENABLE_REACT_COMPILER === "1";

/** @type {import("expo/config").ExpoConfig} */
const includeBuildPropertiesPlugin = process.env.EXPO_SKIP_BUILD_PROPERTIES !== "1";

const plugins: Array<string | [string, Record<string, unknown>]> = [
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
];

if (includeBuildPropertiesPlugin) {
  plugins.push([
    "expo-build-properties",
    {
      android: {
        buildArchs: ["armeabi-v7a", "arm64-v8a"],
        minSdkVersion: 24,
      },
    },
  ]);
}

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
  plugins,
  experiments: {
    typedRoutes: true,
    reactCompiler: enableReactCompiler,
  },
};

export default config;
