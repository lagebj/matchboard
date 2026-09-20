import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { generateKeyPair, exportPKCS8, decodeJwt } from "jose";
import { setupTestDb, teardownTestDb } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

import { POST } from "@/app/api/ai/connections/bootstrap/route";

const AI_ENV_KEYS = [
  "AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64",
  "AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64",
  "AI_SECURITY_FUNCTION_TOKEN",
  "AI_SECURITY_ENROLLMENT_URL",
  "AI_SECURITY_RUNTIME_URL",
] as const;
const originalEnv: Record<string, string | undefined> = {};

let organisationId: string;

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/ai/connections/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  testDb = await setupTestDb();

  const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const enrollmentKeyB64 = Buffer.from(await exportPKCS8(privateKey), "utf8").toString("base64");

  for (const key of AI_ENV_KEYS) {
    originalEnv[key] = process.env[key];
  }
  process.env.AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64 = enrollmentKeyB64;
  process.env.AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64 = enrollmentKeyB64;
  process.env.AI_SECURITY_FUNCTION_TOKEN = "test-function-token";
  process.env.AI_SECURITY_ENROLLMENT_URL = "https://enroll.example.com";
  process.env.AI_SECURITY_RUNTIME_URL = "https://runtime.example.com";
});

afterAll(async () => {
  for (const key of AI_ENV_KEYS) {
    if (originalEnv[key] !== undefined) {
      process.env[key] = originalEnv[key];
    } else {
      delete process.env[key];
    }
  }
  await teardownTestDb();
});

beforeEach(async () => {
  const org = await testDb.organisation.create({ data: { name: "Org", slug: `org-${Date.now()}-${Math.random()}` } });
  organisationId = org.id;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/ai/connections/bootstrap", () => {
  it("creates a PENDING connection and returns connectionId, provider, enrollmentUrl, and a valid 90s enrollment token", async () => {
    mockAuthContext({ organisationId, role: "OWNER" });

    const response = await POST(jsonRequest({ provider: "anthropic" }));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.connectionId).toMatch(/^aic_/);
    expect(body.provider).toBe("anthropic");
    expect(body.enrollmentUrl).toBe("https://enroll.example.com");
    expect(typeof body.token).toBe("string");

    const claims = decodeJwt(body.token);
    expect(claims.iss).toBe("matchboard");
    expect(claims.aud).toBe("matchboard-ai-enrollment");
    expect(claims.op).toBe("enroll-connection");
    expect(claims.connectionId).toBe(body.connectionId);
    expect(claims.provider).toBe("anthropic");
    expect(claims.exp! - claims.iat!).toBe(90);

    const stored = await testDb.aiProviderConnection.findUnique({ where: { id: body.connectionId } });
    expect(stored?.organisationId).toBe(organisationId);
    expect(stored?.status).toBe("PENDING");
    expect(stored?.provider).toBe("ANTHROPIC");
  });

  it("rejects a non-owner with 403 and creates no connection (gate #7)", async () => {
    const auth = mockAuthContext({ organisationId, role: "COACH" });
    // The shared auth-mock's own `AuthorizationError` (from `@/lib/auth`/`actor-context`) is a
    // plain `Error` subclass with a `.status` field, not the real `AppError`-based
    // `AuthorizationError` production code actually throws — using it here would make
    // `safeErrorResponse()` fall through to a generic 500, not the 403 real production returns.
    // `forbiddenError()` (unmocked, real `@/lib/security/errors`) reproduces the real shape.
    const { forbiddenError } = await import("@/lib/security/errors");
    auth.mockRequireOwnerRole.mockImplementation(() => {
      throw forbiddenError("Role COACH cannot perform this action. Required: OWNER.");
    });

    const response = await POST(jsonRequest({ provider: "openai" }));
    expect(response.status).toBe(403);

    const remaining = await testDb.aiProviderConnection.count({ where: { organisationId } });
    expect(remaining).toBe(0);
  });

  it("rejects an unknown provider ID with 400 and creates no connection (gate #14)", async () => {
    mockAuthContext({ organisationId, role: "OWNER" });

    const response = await POST(jsonRequest({ provider: "azure_openai" }));
    expect(response.status).toBe(400);

    const remaining = await testDb.aiProviderConnection.count({ where: { organisationId } });
    expect(remaining).toBe(0);
  });

  it("rejects a missing provider field with 400", async () => {
    mockAuthContext({ organisationId, role: "OWNER" });
    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(400);
  });

  it("rejects an unparseable request body with 400", async () => {
    mockAuthContext({ organisationId, role: "OWNER" });
    const response = await POST(
      new Request("http://localhost/api/ai/connections/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 503 when the AI security boundary is not configured, without leaking which var is missing", async () => {
    mockAuthContext({ organisationId, role: "OWNER" });
    const savedUrl = process.env.AI_SECURITY_ENROLLMENT_URL;
    delete process.env.AI_SECURITY_ENROLLMENT_URL;

    try {
      const response = await POST(jsonRequest({ provider: "openai" }));
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.error).not.toContain("AI_SECURITY_ENROLLMENT_URL");
    } finally {
      process.env.AI_SECURITY_ENROLLMENT_URL = savedUrl;
    }
  });
});
