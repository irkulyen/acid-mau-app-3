import { describe, expect, it } from "vitest";
import { createCorsOriginMatcher } from "./cors";

describe("createCorsOriginMatcher", () => {
  it("allows all origins by default outside production", () => {
    const matcher = createCorsOriginMatcher({
      nodeEnv: "development",
      corsAllowedOrigins: "",
    });

    expect(matcher.allowAllOrigins).toBe(true);
    expect(matcher.isAllowedOrigin("https://example.com")).toBe(true);
    expect(matcher.isAllowedOrigin("http://localhost:8081")).toBe(true);
  });

  it("requires CORS_ALLOWED_ORIGINS in production", () => {
    expect(() =>
      createCorsOriginMatcher({
        nodeEnv: "production",
        corsAllowedOrigins: "",
      }),
    ).toThrow("CORS_ALLOWED_ORIGINS must be set in production");
  });

  it("matches exact origins in production", () => {
    const matcher = createCorsOriginMatcher({
      nodeEnv: "production",
      corsAllowedOrigins: "https://app.example.com,http://localhost:8081",
    });

    expect(matcher.allowAllOrigins).toBe(false);
    expect(matcher.isAllowedOrigin("https://app.example.com")).toBe(true);
    expect(matcher.isAllowedOrigin("https://app.example.com/")).toBe(true);
    expect(matcher.isAllowedOrigin("https://evil.example.com")).toBe(false);
  });

  it("matches wildcard origins in production", () => {
    const matcher = createCorsOriginMatcher({
      nodeEnv: "production",
      corsAllowedOrigins: "https://*.expo.dev,https://*.exp.direct",
    });

    expect(matcher.isAllowedOrigin("https://abc.expo.dev")).toBe(true);
    expect(matcher.isAllowedOrigin("https://foo.bar.expo.dev")).toBe(true);
    expect(matcher.isAllowedOrigin("https://abc.exp.direct")).toBe(true);
    expect(matcher.isAllowedOrigin("https://expo.dev.evil.com")).toBe(false);
  });
});
