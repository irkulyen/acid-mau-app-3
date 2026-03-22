import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { getBotProfileByName } from "@/lib/bot-profiles";
import { resolveAvatarUrl } from "@/lib/avatar-url";

/** Mini card backs for opponent hand display */
export function MiniCardFan({
  count,
  maxShow = 6,
  compact = false,
}: {
  count: number;
  maxShow?: number;
  compact?: boolean;
}) {
  const shown = Math.min(count, maxShow);
  const cardWidth = compact ? 14 : 18;
  const cardHeight = compact ? 22 : 26;
  const overlap = compact ? -6 : -8;
  const fontSize = compact ? 9 : 10;
  return (
    <View style={{ flexDirection: "row", marginTop: compact ? 2 : 4 }}>
      {Array.from({ length: shown }).map((_, i) => (
        <View
          key={i}
          style={{
            width: cardWidth,
            height: cardHeight,
            backgroundColor: "#1a3a5c",
            borderRadius: 4,
            borderWidth: 1,
            borderColor: "#2a5a8c",
            marginLeft: i === 0 ? 0 : overlap,
            transform: [{ rotate: `${(i - (shown - 1) / 2) * 5}deg` }],
          }}
        >
          <View
            style={{
              flex: 1,
              margin: 2,
              borderRadius: 2,
              borderWidth: 0.5,
              borderColor: "#3a6a9c",
              backgroundColor: "#1e4a7a",
            }}
          />
        </View>
      ))}
      {count > maxShow && (
        <View
          style={{
            marginLeft: 5,
            alignSelf: "center",
            backgroundColor: "rgba(4, 10, 16, 0.82)",
            borderRadius: 999,
            borderWidth: 1,
            borderColor: "rgba(157, 182, 209, 0.55)",
            paddingHorizontal: 5,
            paddingVertical: 1,
          }}
        >
          <Text style={{ color: "#E2EAF1", fontSize: fontSize + 1, fontWeight: "800" }}>
            +{count - maxShow}
          </Text>
        </View>
      )}
    </View>
  );
}

export function PlayerAvatar({
  name,
  avatarUrl,
  active,
  isBot = false,
  size = 56,
}: {
  name: string;
  avatarUrl?: string;
  active?: boolean;
  isBot?: boolean;
  size?: number;
}) {
  const botProfile = isBot ? getBotProfileByName(name) : undefined;
  const initial = (botProfile?.fallbackInitial || (name || "?").charAt(0)).toUpperCase();
  const [remoteAvatarFailed, setRemoteAvatarFailed] = useState(false);
  const resolvedAvatarUrl = useMemo(() => resolveAvatarUrl(avatarUrl), [avatarUrl]);
  const frameSize = Math.max(44, Math.min(64, size));
  const imageSize = Math.max(40, frameSize - 8);
  const avatarRadius = frameSize / 2;

  useEffect(() => {
    setRemoteAvatarFailed(false);
  }, [resolvedAvatarUrl, name, isBot]);

  useEffect(() => {
    if (!__DEV__) return;
    if (!avatarUrl) return;
    console.log("[avatar] player avatar source", {
      player: name,
      rawAvatarUrl: avatarUrl,
      resolvedAvatarUrl: resolvedAvatarUrl ?? null,
      isBot,
    });
  }, [avatarUrl, resolvedAvatarUrl, name, isBot]);

  const handleAvatarError = useCallback(() => {
    if (__DEV__) {
      console.warn("[avatar] image load failed", {
        player: name,
        avatarUrl: resolvedAvatarUrl ?? avatarUrl ?? null,
        isBot,
      });
    }
    setRemoteAvatarFailed(true);
  }, [name, resolvedAvatarUrl, avatarUrl, isBot]);

  const source = resolvedAvatarUrl && !remoteAvatarFailed ? { uri: resolvedAvatarUrl } : botProfile?.imagePath;

  return (
    <View
      style={{
        width: frameSize,
        height: frameSize,
        borderRadius: avatarRadius,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: active ? "rgba(62, 212, 122, 0.9)" : "rgba(255,255,255,0.18)",
        backgroundColor: "rgba(10, 20, 18, 0.95)",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: active ? "#3ED47A" : "#000",
        shadowOpacity: active ? 0.36 : 0.14,
        shadowRadius: active ? 10 : 5,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      {source ? (
        <Image
          source={source}
          style={{ width: imageSize, height: imageSize, borderRadius: imageSize / 2 }}
          contentFit="cover"
          onError={handleAvatarError}
        />
      ) : (
        <Text style={{ color: "#E8E8E8", fontSize: Math.floor(frameSize * 0.38), fontWeight: "800" }}>
          {initial}
        </Text>
      )}
    </View>
  );
}
