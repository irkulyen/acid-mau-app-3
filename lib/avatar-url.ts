import { getApiBaseUrl } from "@/constants/oauth";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function parseOrigin(candidate: string | undefined): string | undefined {
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

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (LOOPBACK_HOSTS.has(host) || host.endsWith(".local")) return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split(".").map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false;
    if (parts[0] === 10 || parts[0] === 127) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  }
  if (host.startsWith("fc") || host.startsWith("fd")) return true;
  return false;
}

export function resolveAvatarUrl(rawAvatarUrl?: string | null): string | undefined {
  const raw = typeof rawAvatarUrl === "string" ? rawAvatarUrl.trim() : "";
  if (!raw) return undefined;
  if (raw.startsWith("data:image/")) return raw;

  const apiOrigin = (() => {
    try {
      return parseOrigin(getApiBaseUrl());
    } catch {
      return undefined;
    }
  })();

  if (raw.startsWith("/")) {
    return apiOrigin ? `${apiOrigin}${raw}` : raw;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    if (apiOrigin && isPrivateOrLoopbackHost(parsed.hostname) && parsed.pathname.startsWith("/uploads/")) {
      return `${apiOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return raw;
  } catch {
    if (apiOrigin && /^uploads\//i.test(raw)) {
      return `${apiOrigin}/${raw.replace(/^\/+/, "")}`;
    }
    return /^uploads\//i.test(raw) ? `/${raw.replace(/^\/+/, "")}` : undefined;
  }
}
