function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wildcardPatternToRegExp(pattern: string): RegExp {
  const normalized = normalizeOrigin(pattern);
  const regexBody = normalized
    .split("*")
    .map((part) => escapeRegExp(part))
    .join(".*");
  return new RegExp(`^${regexBody}$`, "i");
}

export function createCorsOriginMatcher(params?: {
  nodeEnv?: string;
  corsAllowedOrigins?: string;
}) {
  const nodeEnv = params?.nodeEnv ?? process.env.NODE_ENV;
  const rawOrigins = params?.corsAllowedOrigins ?? process.env.CORS_ALLOWED_ORIGINS ?? "";
  const configuredOrigins = rawOrigins
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

  if (nodeEnv === "production" && configuredOrigins.length === 0) {
    throw new Error("CORS_ALLOWED_ORIGINS must be set in production");
  }

  // In non-production, allow all origins by default to simplify LAN/tunnel testing.
  const allowAllOrigins = nodeEnv !== "production" || configuredOrigins.length === 0;

  const exactOrigins = new Set<string>();
  const wildcardOrigins: RegExp[] = [];

  for (const origin of configuredOrigins) {
    if (origin.includes("*")) {
      wildcardOrigins.push(wildcardPatternToRegExp(origin));
      continue;
    }
    exactOrigins.add(origin.toLowerCase());
  }

  const isAllowedOrigin = (origin?: string): boolean => {
    if (!origin) return true;
    if (allowAllOrigins) return true;

    const normalizedOrigin = normalizeOrigin(origin).toLowerCase();
    if (exactOrigins.has(normalizedOrigin)) return true;
    return wildcardOrigins.some((pattern) => pattern.test(normalizedOrigin));
  };

  return {
    isAllowedOrigin,
    allowAllOrigins,
    configuredOrigins,
  };
}
