import { describe, it, expect } from "vitest";

describe("Login Flow", () => {
  it("should login successfully with correct credentials", async () => {
    const response = await fetch("http://localhost:3000/api/trpc/auth.login?batch=1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "0": {
          json: {
            email: "test@test.com",
            password: "test123",
          },
        },
      }),
      credentials: "include",
    });

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveLength(1);
    expect(data[0].result).toBeDefined();
    expect(data[0].result.data.json.token).toBeDefined();
    expect(data[0].result.data.json.userId).toBe(30001);
    
    // Check if cookie was set
    const cookies = response.headers.get("set-cookie");
    expect(cookies).toContain("app_session_id");
  });

  it("should fail login with wrong password", async () => {
    const response = await fetch("http://localhost:3000/api/trpc/auth.login?batch=1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "0": {
          json: {
            email: "test@test.com",
            password: "wrongpassword",
          },
        },
      }),
    });

    const data = await response.json();
    expect(data[0].error).toBeDefined();
    expect(data[0].error.json.message).toContain("Ungültige Anmeldedaten");
  });
});
