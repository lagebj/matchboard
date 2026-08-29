import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("/api/test-agent/seed-finalized-match", () => {
  const originalEnv = process.env.MATCHBOARD_ENV;
  const originalEnabled = process.env.TEST_AGENT_AUTH_ENABLED;
  const originalSecret = process.env.TEST_AGENT_AUTH_SECRET;

  beforeEach(() => {
    process.env.MATCHBOARD_ENV = "test";
    process.env.TEST_AGENT_AUTH_ENABLED = "true";
    process.env.TEST_AGENT_AUTH_SECRET = "test-secret-for-vitest";
  });

  afterEach(() => {
    if (originalEnv !== undefined) process.env.MATCHBOARD_ENV = originalEnv;
    else delete process.env.MATCHBOARD_ENV;
    if (originalEnabled !== undefined) process.env.TEST_AGENT_AUTH_ENABLED = originalEnabled;
    else delete process.env.TEST_AGENT_AUTH_ENABLED;
    if (originalSecret !== undefined) process.env.TEST_AGENT_AUTH_SECRET = originalSecret;
    else delete process.env.TEST_AGENT_AUTH_SECRET;
  });

  function makeRequest(body: unknown) {
    return new Request("http://localhost:3333/api/test-agent/seed-finalized-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // Regression test: this endpoint performs real privileged mutations (create + finalize a
  // match), unlike /api/auth/test-agent which only upserts a login user -- it must be
  // unreachable (404, not a revealing 403) whenever isTestAgentAuthEnabled() is false, including
  // production, with no dependency on a real auth session or database to prove that.
  it("is a 404 (not found), not just forbidden, when test agent auth is disabled", async () => {
    delete process.env.TEST_AGENT_AUTH_ENABLED;
    delete process.env.TEST_AGENT_AUTH_SECRET;

    const { POST } = await import("../route");
    const response = await POST(makeRequest({ teamName: "A1 Blues", opponentName: "X", startsAt: new Date().toISOString() }));
    expect(response.status).toBe(404);
  });

  it("rejects invalid JSON body", async () => {
    const { POST } = await import("../route");
    const request = new Request("http://localhost:3333/api/test-agent/seed-finalized-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("rejects a body missing required fields", async () => {
    const { POST } = await import("../route");
    const response = await POST(makeRequest({ teamName: "A1 Blues" }));
    expect(response.status).toBe(400);
  });

  it("rejects a non-date startsAt", async () => {
    const { POST } = await import("../route");
    const response = await POST(makeRequest({ teamName: "A1 Blues", opponentName: "X", startsAt: "not-a-date" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("startsAt");
  });
});
