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

import { POST } from "@/app/api/ai/connections/complete/route";

const AI_ENV_KEYS = ["AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64"] as const;
const originalEnv: Record<string, string | undefined> = {};

let organisationId: string;
let connectionId: string;
let fakeTransport: FakeMatchboardSecurityTransport;

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/ai/connections/complete", {
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
  await testDb.aiProviderConnection.create({ data: { id: connectionId, organisationId, provider: "OPENAI", status: "PENDING" } });

  fakeAdapter = new FakeProviderAdapter({ id: "openai", label: "OpenAI" });
  fakeTransport = new FakeMatchboardSecurityTransport();
  fakeTransport.seedCredential(connectionId, "sk-test-credential");
  setMatchboardSecurityTransport(fakeTransport);

  mockAuthContext({ organisationId, role: "OWNER" });
});

afterEach(() => {
  resetMatchboardSecurityTransport();
  vi.clearAllMocks();
});

describe("POST /api/ai/connections/complete", () => {
  it("moves a PENDING connection to CONNECTED_NO_MODEL and returns the model list on success", async () => {
    fakeAdapter.setModels([{ id: "gpt-5" }, { id: "gpt-5-mini" }]);

    const response = await POST(jsonRequest({ connectionId }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("CONNECTED_NO_MODEL");
    expect(body.models).toEqual([{ id: "gpt-5" }, { id: "gpt-5-mini" }]);

    const stored = await testDb.aiProviderConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(stored.status).toBe("CONNECTED_NO_MODEL");
    expect(stored.connectedAt).not.toBeNull();
    expect(stored.lastValidatedAt).not.toBeNull();
    expect(stored.lastErrorCode).toBeNull();
  });

  it("moves the connection to ERROR when the credential is rejected", async () => {
    fakeAdapter.forceNextListModelsFailure("PROVIDER_AUTH_FAILED");

    const response = await POST(jsonRequest({ connectionId }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.errorCode).toBe("PROVIDER_AUTH_FAILED");

    const stored = await testDb.aiProviderConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(stored.status).toBe("ERROR");
    expect(stored.lastErrorCode).toBe("PROVIDER_AUTH_FAILED");
  });

  it("moves the connection to ERROR with PROVIDER_MODEL_LIST_EMPTY when the provider returns no models", async () => {
    fakeAdapter.setModels([]);

    const response = await POST(jsonRequest({ connectionId }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.errorCode).toBe("PROVIDER_MODEL_LIST_EMPTY");

    const stored = await testDb.aiProviderConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(stored.status).toBe("ERROR");
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

  it("returns 404 for a connection ID belonging to a different organisation (no field leaked)", async () => {
    const otherOrg = await testDb.organisation.create({ data: { name: "Other Org", slug: `other-org-${Date.now()}-${Math.random()}` } });
    mockAuthContext({ organisationId: otherOrg.id, role: "OWNER" });

    const response = await POST(jsonRequest({ connectionId }));
    expect(response.status).toBe(404);
  });

  it("returns 404 for a connection that is not PENDING", async () => {
    await testDb.aiProviderConnection.update({ where: { id: connectionId }, data: { status: "READY", model: "gpt-5" } });

    const response = await POST(jsonRequest({ connectionId }));
    expect(response.status).toBe(404);
  });

  it("rejects a missing connectionId with 400", async () => {
    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(400);
  });
});
