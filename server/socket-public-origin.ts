import type { Socket } from "socket.io";
import { ENV } from "./_core/env";

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",")[0]?.trim() || undefined;
}

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".local")
  ) {
    return true;
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    const octets = host.split(".").map((part) => Number(part));
    if (octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false;
    if (octets[0] === 10) return true;
    if (octets[0] === 127) return true;
    if (octets[0] === 192 && octets[1] === 168) return true;
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  }

  if (host.startsWith("fc") || host.startsWith("fd")) return true;
  return false;
}

function toOrigin(candidate: string | undefined): string | undefined {
  if (!candidate) return undefined;
  const trimmed = candidate.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return undefined;
  }
}

export function getSocketPublicOrigin(socket: Socket): string | undefined {
  const envOrigin = toOrigin(ENV.publicBaseUrl || ENV.oAuthServerUrl);
  if (envOrigin) return envOrigin;

  const forwardedHost = firstHeaderValue(socket.handshake.headers["x-forwarded-host"]);
  const host = firstHeaderValue(socket.handshake.headers.host);
  const selectedHost = forwardedHost || host;
  if (!selectedHost) return undefined;
  const forwardedProto = firstHeaderValue(socket.handshake.headers["x-forwarded-proto"]);
  const proto = forwardedProto || (ENV.isProduction ? "https" : "http");
  return `${proto}://${selectedHost}`;
}

export function normalizeAvatarUrlForClient(
  avatarUrl: string | undefined,
  targetOrigin: string | undefined,
): string | undefined {
  if (!avatarUrl) return undefined;
  const raw = avatarUrl.trim();
  if (!raw) return undefined;
  if (raw.startsWith("data:image/")) return raw;

  const normalizedOrigin = toOrigin(targetOrigin);

  if (raw.startsWith("/")) {
    return normalizedOrigin ? `${normalizedOrigin}${raw}` : raw;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    if (
      normalizedOrigin &&
      isPrivateOrLoopbackHost(parsed.hostname) &&
      parsed.pathname.startsWith("/uploads/")
    ) {
      return `${normalizedOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return raw;
  } catch {
    if (normalizedOrigin && /^uploads\//i.test(raw)) {
      return `${normalizedOrigin}/${raw.replace(/^\/+/, "")}`;
    }
    return undefined;
  }
}
