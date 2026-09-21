import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { generateKeyPair, exportPKCS8 } from "jose";

vi.mock("server-only", () => ({}));

import { setupTestDb, teardownTestDb } from "@/test/test-db";
import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

import { FakeMatchboardSecurityTransport } from "@/lib/ai/security-client/fake-transport";
import { setMatchboardSecurityTransport, resetMatchboardSecurityTransport } from "@/lib/ai/security-client/transport-factory";

import { retryPendingConnectionDeletions } from "@/lib/ai/jobs/connection-maintenance";

const AI_ENV_KEYS = ["AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64", "AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64"] as const;
const originalEnv: Record<string, string | undefined> = {};

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

afterEach(() => {
  resetMatchboardSecurityTransport();
  vi.clearAllMocks();
});

async function seedDeletePendingConnection() {
  const org = await testDb.organisation.create({ data: { name: "Org", slug: `org-${Date.now()}-${Math.random()}` } });
  const connectionId = generateAiProviderConnectionId();
  await testDb.aiProviderConnection.create({
    data: { id: connectionId, organisationId: org.id, provider: "OPENAI", status: "DELETE_PENDING", model: "gpt-5" },
  });
  await testDb.organisationAiSettings.create({ data: { organisationId: org.id, enabled: true } });
  return { organisationId: org.id, connectionId };
}

describe("retryPendingConnectionDeletions", () => {
  it("returns scanned: 0 when there are no DELETE_PENDING connections", async () => {
    fakeTransport = new FakeMatchboardSecurityTransport();
    setMatchboardSecurityTransport(fakeTransport);

    const result = await retryPendingConnectionDeletions();
    expect(result.scanned).toBe(0);
  });

  it("retires every DELETE_PENDING connection across organisations that the security transport can delete", async () => {
    fakeTransport = new FakeMatchboardSecurityTransport();
    const a = await seedDeletePendingConnection();
    const b = await seedDeletePendingConnection();
    fakeTransport.seedCredential(a.connectionId, "sk-a");
    fakeTransport.seedCredential(b.connectionId, "sk-b");
    setMatchboardSecurityTransport(fakeTransport);

    const result = await retryPendingConnectionDeletions();
    expect(result.scanned).toBe(2);

    const connA = await testDb.aiProviderConnection.findUniqueOrThrow({ where: { id: a.connectionId } });
    const connB = await testDb.aiProviderConnection.findUniqueOrThrow({ where: { id: b.connectionId } });
    expect(connA.status).toBe("DISCONNECTED");
    expect(connB.status).toBe("DISCONNECTED");
    expect(fakeTransport.deleteConnectionCalls).toHaveLength(2);
  });

  it("leaves a connection DELETE_PENDING when the delete call fails, without aborting the rest of the sweep", async () => {
    fakeTransport = new FakeMatchboardSecurityTransport();
    const a = await seedDeletePendingConnection();
    const b = await seedDeletePendingConnection();
    fakeTransport.seedCredential(a.connectionId, "sk-a");
    fakeTransport.seedCredential(b.connectionId, "sk-b");
    fakeTransport.forceNextDeleteFailure("PROVIDER_UNAVAILABLE");
    setMatchboardSecurityTransport(fakeTransport);

    const result = await retryPendingConnectionDeletions();
    expect(result.scanned).toBe(2);

    const connA = await testDb.aiProviderConnection.findUniqueOrThrow({ where: { id: a.connectionId } });
    const connB = await testDb.aiProviderConnection.findUniqueOrThrow({ where: { id: b.connectionId } });
    // Order of the scan is DB-determined; exactly one of the two absorbs the forced single failure.
    const statuses = [connA.status, connB.status].sort();
    expect(statuses).toEqual(["DELETE_PENDING", "DISCONNECTED"]);
  });
});
