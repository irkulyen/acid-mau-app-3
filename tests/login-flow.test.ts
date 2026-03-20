import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "../server/_core/context";

type CookieCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function createPublicContext(): { ctx: TrpcContext; cookies: CookieCall[] } {
  const cookies: CookieCall[] = [];
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
      hostname: "localhost",
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
      clearCookie: () => undefined,
    } as unknown as TrpcContext["res"],
  };
  return { ctx, cookies };
}

describe("Login Flow", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const dbTest = hasDatabaseUrl ? it : it.skip;

  beforeEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
  });

  dbTest("should login successfully with correct credentials", async () => {
    const { ctx, cookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      email: "test@test.com",
      password: "test123",
    });

    expect(result.token).toBeTypeOf("string");
    expect(result.userId).toBe(1);
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe(COOKIE_NAME);
    expect(cookies[0]?.value).toBeTypeOf("string");
  });

  dbTest("should fail login with wrong password", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: "test@test.com",
        password: "wrongpassword",
      }),
    ).rejects.toThrow("Ungültige Anmeldedaten");
  });
});
