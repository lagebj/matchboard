import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { generateKeyPair, exportPKCS8 } from "jose";

vi.mock("server-only", () => ({}));

import { setupTestDb, teardownTestDb } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";
import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

import { FakeProviderAdapter } from "@/lib/ai/providers/fake-provider-adapter";

let fakeAdapter: FakeProviderAdapter;

vi.mock("@/lib/ai/providers/provider-adapter-registry", () => ({
  getProviderAdapter: () => fakeAdapter,
}));

import { FakeMatchboardSecurityTransport } from "@/lib/ai/security-client/fake-transport";
import { setMatchboardSecurityTransport, resetMatchboardSecurityTransport } from "@/lib/ai/security-client/transport-factory";

import { POST } from "@/app/api/ai/connections/models/route";

const AI_ENV_KEYS = ["AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64"] as const;
const originalEnv: Record<string, string | undefined> = {};

let organisationId: string;
let connectionId: string;

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/ai/connections/models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  testDb = await setupTestDb();

  const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const keyB64 = Buffer.from(await exportPKCS8(privateKey), "utf8").toString("base64");
  for (const key of AI_ENV_KEYS) originalEnv[key] = process.env[key];
  process.env.AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64 = keyB64;
});

afterAll(async () => {
  for (const key of AI_ENV_KEYS) {
    if (originalEnv[key] !== undefined) process.env[key] = originalEnv[key];
    else delete process.env[key];
  }
  await teardownTestDb();
});

beforeEach(async () => {
  const org = await testDb.organisation.create({ data: { name: "Org", slug: `org-${Date.now()}-${Math.random()}` } });
  organisationId = org.id;

  connectionId = generateAiProviderConnectionId();
  await testDb.aiProviderConnection.create({
    data: { id: connectionId, organisationId, provider: "OPENAI", status: "READY", model: "gpt-5" },
  });

  fakeAdapter = new FakeProviderAdapter({ id: "openai", label: "OpenAI" });
  fakeAdapter.setModels([{ id: "gpt-5" }, { id: "gpt-5-mini" }]);

  const fakeTransport = new FakeMatchboardSecurityTransport();
  fakeTransport.seedCredential(connectionId, "sk-test-credential");
  setMatchboardSecurityTransport(fakeTransport);

  mockAuthContext({ organisationId, role: "OWNER" });
});

afterEach(() => {
  resetMatchboardSecurityTransport();
  vi.clearAllMocks();
});

describe("POST /api/ai/connections/models", () => {
  it("returns the refreshed model list and updates lastValidatedAt on success", async () => {
    const response = await POST(jsonRequest({ connectionId }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.models).toEqual([{ id: "gpt-5" }, { id: "gpt-5-mini" }]);

    const stored = await testDb.aiProviderConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(stored.lastValidatedAt).not.toBeNull();
    expect(stored.status).toBe("READY");
  });

  it("keeps the connection READY (never downgrades status) when a refresh call transiently fails", async () => {
    fakeAdapter.forceNextListModelsFailure("PROVIDER_RATE_LIMITED");

    const response = await POST(jsonRequest({ connectionId }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.errorCode).toBe("PROVIDER_RATE_LIMITED");

    const stored = await testDb.aiProviderConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(stored.status).toBe("READY");
    expect(stored.model).toBe("gpt-5");
    expect(stored.lastErrorCode).toBe("PROVIDER_RATE_LIMITED");
  });

  it("rejects a non-owner with 403", async () => {
    const auth = mockAuthContext({ organisationId, role: "COACH" });
    const { forbiddenError } = await import("@/lib/security/errors");
    auth.mockRequireOwnerRole.mockImplementation(() => {
      throw forbiddenError("Role COACH cannot perform this action. Required: OWNER.");
    });

    const response = await POST(jsonRequest({ connectionId }));
    expect(response.status).toBe(403);
  });

  it("returns 404 for a connection ID belonging to a different organisation", async () => {
    const otherOrg = await testDb.organisation.create({ data: { name: "Other Org", slug: `other-org-${Date.now()}-${Math.random()}` } });
    mockAuthContext({ organisationId: otherOrg.id, role: "OWNER" });

    const response = await POST(jsonRequest({ connectionId }));
    expect(response.status).toBe(404);
  });

  it("returns 404 for a PENDING connection (nothing to refresh yet)", async () => {
    const pendingId = generateAiProviderConnectionId();
    await testDb.aiProviderConnection.create({ data: { id: pendingId, organisationId, provider: "OPENAI", status: "PENDING" } });

    const response = await POST(jsonRequest({ connectionId: pendingId }));
    expect(response.status).toBe(404);
  });

  it("rejects a missing connectionId with 400", async () => {
    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(400);
  });
});
