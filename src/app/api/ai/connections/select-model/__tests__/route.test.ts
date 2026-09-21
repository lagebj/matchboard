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

import { POST } from "@/app/api/ai/connections/select-model/route";

const AI_ENV_KEYS = ["AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64", "AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64"] as const;
const originalEnv: Record<string, string | undefined> = {};

let organisationId: string;
let connectionId: string;
let fakeTransport: FakeMatchboardSecurityTransport;

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/ai/connections/select-model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  testDb = await setupTestDb();

  for (const key of AI_ENV_KEYS) {
    originalEnv[key] = process.env[key];
    const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    process.env[key] = Buffer.from(await exportPKCS8(privateKey), "utf8").toString("base64");
  }
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
    data: { id: connectionId, organisationId, provider: "OPENAI", status: "CONNECTED_NO_MODEL" },
  });
  await testDb.organisationAiSettings.create({ data: { organisationId, enabled: false } });

  fakeAdapter = new FakeProviderAdapter({ id: "openai", label: "OpenAI" });
  fakeAdapter.setModels([{ id: "gpt-5" }, { id: "gpt-5-mini" }]);
  fakeAdapter.setProbeableModelIds(["gpt-5"]);

  fakeTransport = new FakeMatchboardSecurityTransport();
  fakeTransport.seedCredential(connectionId, "sk-test-credential");
  setMatchboardSecurityTransport(fakeTransport);

  mockAuthContext({ organisationId, role: "OWNER" });
});

afterEach(() => {
  resetMatchboardSecurityTransport();
  vi.clearAllMocks();
});

describe("POST /api/ai/connections/select-model", () => {
  it("selects and probes a model, moves the connection to READY, and sets it as the active connection", async () => {
    const response = await POST(jsonRequest({ connectionId, model: "gpt-5" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ connectionId, status: "READY", model: "gpt-5" });

    const stored = await testDb.aiProviderConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(stored.status).toBe("READY");
    expect(stored.model).toBe("gpt-5");
    expect(stored.readyAt).not.toBeNull();

    const settings = await testDb.organisationAiSettings.findUniqueOrThrow({ where: { organisationId } });
    expect(settings.activeConnectionId).toBe(connectionId);
  });

  it("rejects a model ID that is not in the fresh catalogue, without calling probeModel", async () => {
    const response = await POST(jsonRequest({ connectionId, model: "not-a-real-model" }));
    expect(response.status).toBe(400);
    expect(fakeAdapter.probeModelCalls).toHaveLength(0);

    const stored = await testDb.aiProviderConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(stored.status).toBe("CONNECTED_NO_MODEL");
  });

  it("keeps the connection unselected when the probe fails on first-time selection", async () => {
    fakeAdapter.setProbeableModelIds([]);

    const response = await POST(jsonRequest({ connectionId, model: "gpt-5" }));
    expect(response.status).toBe(502);

    const stored = await testDb.aiProviderConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(stored.status).toBe("CONNECTED_NO_MODEL");
    expect(stored.model).toBeNull();
  });

  it("keeps the previous model when a change-model probe fails", async () => {
    await testDb.aiProviderConnection.update({ where: { id: connectionId }, data: { status: "READY", model: "gpt-5-mini" } });
    fakeAdapter.setProbeableModelIds(["gpt-5-mini"]); // gpt-5 (requested) is not probeable

    const response = await POST(jsonRequest({ connectionId, model: "gpt-5" }));
    expect(response.status).toBe(502);

    const stored = await testDb.aiProviderConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(stored.status).toBe("READY");
    expect(stored.model).toBe("gpt-5-mini");
  });

  it("retires the previously active connection when switching to a new READY connection (replace-key finalization)", async () => {
    const oldConnectionId = generateAiProviderConnectionId();
    await testDb.aiProviderConnection.create({
      data: { id: oldConnectionId, organisationId, provider: "OPENAI", status: "READY", model: "gpt-4" },
    });
    await testDb.organisationAiSettings.update({ where: { organisationId }, data: { activeConnectionId: oldConnectionId } });
    fakeTransport.seedCredential(oldConnectionId, "sk-old-credential");

    const response = await POST(jsonRequest({ connectionId, model: "gpt-5" }));
    expect(response.status).toBe(200);

    const settings = await testDb.organisationAiSettings.findUniqueOrThrow({ where: { organisationId } });
    expect(settings.activeConnectionId).toBe(connectionId);

    const oldConnection = await testDb.aiProviderConnection.findUniqueOrThrow({ where: { id: oldConnectionId } });
    expect(oldConnection.status).toBe("DISCONNECTED");
    expect(fakeTransport.deleteConnectionCalls).toHaveLength(1);
    expect(fakeTransport.deleteConnectionCalls[0]?.connectionId).toBe(oldConnectionId);
  });

  it("rejects a non-owner with 403", async () => {
    const auth = mockAuthContext({ organisationId, role: "COACH" });
    const { forbiddenError } = await import("@/lib/security/errors");
    auth.mockRequireOwnerRole.mockImplementation(() => {
      throw forbiddenError("Role COACH cannot perform this action. Required: OWNER.");
    });

    const response = await POST(jsonRequest({ connectionId, model: "gpt-5" }));
    expect(response.status).toBe(403);
  });

  it("returns 404 for a connection ID belonging to a different organisation", async () => {
    const otherOrg = await testDb.organisation.create({ data: { name: "Other Org", slug: `other-org-${Date.now()}-${Math.random()}` } });
    mockAuthContext({ organisationId: otherOrg.id, role: "OWNER" });

    const response = await POST(jsonRequest({ connectionId, model: "gpt-5" }));
    expect(response.status).toBe(404);
  });

  it("rejects a missing model with 400", async () => {
    const response = await POST(jsonRequest({ connectionId }));
    expect(response.status).toBe(400);
  });
});
