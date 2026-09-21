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

import { FakeMatchboardSecurityTransport } from "@/lib/ai/security-client/fake-transport";
import { setMatchboardSecurityTransport, resetMatchboardSecurityTransport } from "@/lib/ai/security-client/transport-factory";

import { POST } from "@/app/api/ai/connections/disconnect/route";

const AI_ENV_KEYS = ["AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64", "AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64"] as const;
const originalEnv: Record<string, string | undefined> = {};

let organisationId: string;
let connectionId: string;
let fakeTransport: FakeMatchboardSecurityTransport;

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
    data: { id: connectionId, organisationId, provider: "OPENAI", status: "READY", model: "gpt-5" },
  });
  await testDb.organisationAiSettings.create({ data: { organisationId, enabled: true, activeConnectionId: connectionId } });

  fakeTransport = new FakeMatchboardSecurityTransport();
  fakeTransport.seedCredential(connectionId, "sk-test-credential");
  setMatchboardSecurityTransport(fakeTransport);

  mockAuthContext({ organisationId, role: "OWNER" });
});

afterEach(() => {
  resetMatchboardSecurityTransport();
  vi.clearAllMocks();
});

describe("POST /api/ai/connections/disconnect", () => {
  it("clears the active connection, retires it, and leaves the master enabled switch untouched", async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "disconnected" });

    const settings = await testDb.organisationAiSettings.findUniqueOrThrow({ where: { organisationId } });
    expect(settings.activeConnectionId).toBeNull();
    expect(settings.enabled).toBe(true); // connection and enablement are separate

    const connection = await testDb.aiProviderConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(connection.status).toBe("DISCONNECTED");
    expect(fakeTransport.deleteConnectionCalls).toHaveLength(1);
    expect(fakeTransport.deleteConnectionCalls[0]?.connectionId).toBe(connectionId);
  });

  it("leaves the connection DELETE_PENDING for later retry when the security transport delete fails", async () => {
    fakeTransport.forceNextDeleteFailure("PROVIDER_UNAVAILABLE");

    const response = await POST();
    expect(response.status).toBe(200);

    const settings = await testDb.organisationAiSettings.findUniqueOrThrow({ where: { organisationId } });
    expect(settings.activeConnectionId).toBeNull();

    const connection = await testDb.aiProviderConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(connection.status).toBe("DELETE_PENDING");
  });

  it("returns 404 when there is no active connection to disconnect", async () => {
    await testDb.organisationAiSettings.update({ where: { organisationId }, data: { activeConnectionId: null } });

    const response = await POST();
    expect(response.status).toBe(404);
  });

  it("rejects a non-owner with 403", async () => {
    const auth = mockAuthContext({ organisationId, role: "COACH" });
    const { forbiddenError } = await import("@/lib/security/errors");
    auth.mockRequireOwnerRole.mockImplementation(() => {
      throw forbiddenError("Role COACH cannot perform this action. Required: OWNER.");
    });

    const response = await POST();
    expect(response.status).toBe(403);
  });
});
