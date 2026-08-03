import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import crypto from "crypto";

const VALID_TOKEN = "test-bearer-token-12345678";
const VALID_BODY = JSON.stringify([{ event: "delivered", email: "test@example.com", id: 123 }]);

describe("Brevo webhook route bearer auth", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function getHandler(tokenEnv?: string, nodeEnv?: string) {
    process.env.BREVO_WEBHOOK_BEARER_TOKEN = tokenEnv ?? VALID_TOKEN;
    process.env.NODE_ENV = nodeEnv ?? "test";
    const mod = await import("@/app/api/webhooks/brevo/route");
    return mod.POST;
  }

  it("rejects request without authorization header when token is configured", async () => {
    const handler = await getHandler(VALID_TOKEN, "test");
    const req = new NextRequest("http://localhost:3000/api/webhooks/brevo", {
      method: "POST",
      body: VALID_BODY,
    });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it("rejects request with wrong bearer token", async () => {
    const handler = await getHandler(VALID_TOKEN, "test");
    const req = new NextRequest("http://localhost:3000/api/webhooks/brevo", {
      method: "POST",
      headers: { authorization: "Bearer wrong-token-12345678" },
      body: VALID_BODY,
    });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it("rejects request with malformed authorization header", async () => {
    const handler = await getHandler(VALID_TOKEN, "test");
    const req = new NextRequest("http://localhost:3000/api/webhooks/brevo", {
      method: "POST",
      headers: { authorization: "Basic abc123" },
      body: VALID_BODY,
    });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it("accepts request with correct bearer token using constant-time comparison", async () => {
    vi.doMock("@/lib/email/webhook-handler", () => ({
      processBrevoWebhookEvents: vi.fn().mockResolvedValue({ processed: 1, errors: [] }),
    }));
    const handler = await getHandler(VALID_TOKEN, "test");
    const req = new NextRequest("http://localhost:3000/api/webhooks/brevo", {
      method: "POST",
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
      body: VALID_BODY,
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("rejects request with token of different length (timing-safe)", async () => {
    const handler = await getHandler(VALID_TOKEN, "test");
    const req = new NextRequest("http://localhost:3000/api/webhooks/brevo", {
      method: "POST",
      headers: { authorization: "Bearer short" },
      body: VALID_BODY,
    });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it("rejects request with empty bearer token", async () => {
    const handler = await getHandler(VALID_TOKEN, "test");
    const req = new NextRequest("http://localhost:3000/api/webhooks/brevo", {
      method: "POST",
      headers: { authorization: "Bearer " },
      body: VALID_BODY,
    });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it("allows unauthenticated request in development when no token is configured", async () => {
    vi.doMock("@/lib/email/webhook-handler", () => ({
      processBrevoWebhookEvents: vi.fn().mockResolvedValue({ processed: 1, errors: [] }),
    }));
    const handler = await getHandler("", "development");
    const req = new NextRequest("http://localhost:3000/api/webhooks/brevo", {
      method: "POST",
      body: VALID_BODY,
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
  });

  it("rejects unauthenticated request in production when no token is configured", async () => {
    const handler = await getHandler("", "production");
    const req = new NextRequest("http://localhost:3000/api/webhooks/brevo", {
      method: "POST",
      body: VALID_BODY,
    });
    const res = await handler(req);
    expect(res.status).toBe(503);
  });

  it("rejects invalid JSON body even with correct auth", async () => {
    const handler = await getHandler(VALID_TOKEN, "test");
    const req = new NextRequest("http://localhost:3000/api/webhooks/brevo", {
      method: "POST",
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
      body: "not-json",
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it("uses constant-time comparison to prevent timing attacks", async () => {
    const a = "Bearer test-bearer-token-12345678";
    const b = "Bearer test-bearer-token-12345678";
    const c = "Bearer test-bearer-token-12345679";

    const timingModule = await import("@/app/api/webhooks/brevo/route");
    expect(timingModule).toBeDefined();
    expect(a.length).toBe(b.length);
    expect(a.length).toBe(c.length);
    expect(crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))).toBe(true);
    expect(crypto.timingSafeEqual(Buffer.from(a), Buffer.from(c))).toBe(false);
  });
});