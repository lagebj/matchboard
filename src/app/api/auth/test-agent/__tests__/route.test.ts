import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("/api/auth/test-agent", () => {
  const originalEnv = process.env.MATCHBOARD_ENV;
  const originalEnabled = process.env.TEST_AGENT_AUTH_ENABLED;
  const originalSecret = process.env.TEST_AGENT_AUTH_SECRET;
  const originalNamespace = process.env.TEST_AGENT_AUTH_NAMESPACE;

  beforeEach(() => {
    process.env.MATCHBOARD_ENV = "test";
    process.env.TEST_AGENT_AUTH_ENABLED = "true";
    process.env.TEST_AGENT_AUTH_SECRET = "test-secret-for-vitest";
    process.env.TEST_AGENT_AUTH_NAMESPACE = "test-agent.matchboard.football";
  });

  afterEach(() => {
    if (originalEnv !== undefined) process.env.MATCHBOARD_ENV = originalEnv;
    else delete process.env.MATCHBOARD_ENV;
    if (originalEnabled !== undefined) process.env.TEST_AGENT_AUTH_ENABLED = originalEnabled;
    else delete process.env.TEST_AGENT_AUTH_ENABLED;
    if (originalSecret !== undefined) process.env.TEST_AGENT_AUTH_SECRET = originalSecret;
    else delete process.env.TEST_AGENT_AUTH_SECRET;
    if (originalNamespace !== undefined) process.env.TEST_AGENT_AUTH_NAMESPACE = originalNamespace;
    else delete process.env.TEST_AGENT_AUTH_NAMESPACE;
  });

  it("rejects requests when test agent auth is disabled", async () => {
    delete process.env.TEST_AGENT_AUTH_ENABLED;
    delete process.env.TEST_AGENT_AUTH_SECRET;

    const { isTestAgentAuthEnabled } = await import("@/lib/env");
    expect(isTestAgentAuthEnabled()).toBe(false);
  });

  it("rejects requests with wrong secret", async () => {
    const { isTestAgentAuthEnabled } = await import("@/lib/env");
    expect(isTestAgentAuthEnabled()).toBe(true);

    const request = new Request("http://localhost:3333/api/auth/test-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "coach-a1@test-agent.matchboard.football",
        secret: "wrong-secret",
      }),
    });

    const { POST } = await import("@/app/api/auth/test-agent/route");
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("rejects emails outside the test namespace", async () => {
    const request = new Request("http://localhost:3333/api/auth/test-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "coach-a1@gmail.com",
        secret: "test-secret-for-vitest",
      }),
    });

    const { POST } = await import("@/app/api/auth/test-agent/route");
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("namespace");
  });

  it("rejects invalid request body", async () => {
    const request = new Request("http://localhost:3333/api/auth/test-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const { POST } = await import("@/app/api/auth/test-agent/route");
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});