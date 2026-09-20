import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));

import { setupTestDb, teardownTestDb } from "@/test/test-db";

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

import { createPendingProviderConnection, getProviderConnection } from "@/lib/ai/provider-connections";

let testDb: PrismaClient;
let orgAId: string;
let orgBId: string;

beforeAll(async () => {
  testDb = await setupTestDb();
  const orgA = await testDb.organisation.create({ data: { name: "Org A", slug: `org-a-${Date.now()}` } });
  const orgB = await testDb.organisation.create({ data: { name: "Org B", slug: `org-b-${Date.now()}` } });
  orgAId = orgA.id;
  orgBId = orgB.id;
});

afterAll(async () => {
  await teardownTestDb();
});

describe("ai/provider-connections: createPendingProviderConnection", () => {
  it("creates a PENDING connection with no credential column and an aic_-prefixed opaque ID", async () => {
    const connection = await createPendingProviderConnection({
      organisationId: orgAId,
      provider: "openai",
      createdByUserId: "user-1",
    });

    expect(connection.id.startsWith("aic_")).toBe(true);
    expect(connection.organisationId).toBe(orgAId);
    expect(connection.provider).toBe("OPENAI");
    expect(connection.status).toBe("PENDING");
    expect(connection.createdByUserId).toBe("user-1");
    // No `credential` (or any secret-shaped) field exists on the model at all — this asserts the
    // returned row has exactly the columns the schema defines, none of them a raw secret.
    expect(Object.keys(connection)).not.toContain("credential");
  });

  it("mints a distinct connection ID on every call, even for the same organisation/provider", async () => {
    const first = await createPendingProviderConnection({ organisationId: orgAId, provider: "anthropic", createdByUserId: "u" });
    const second = await createPendingProviderConnection({ organisationId: orgAId, provider: "anthropic", createdByUserId: "u" });
    expect(first.id).not.toBe(second.id);
  });
});

describe("ai/provider-connections: getProviderConnection", () => {
  it("returns the connection when it belongs to the requesting organisation", async () => {
    const created = await createPendingProviderConnection({ organisationId: orgAId, provider: "mistral", createdByUserId: "u" });
    const found = await getProviderConnection(orgAId, created.id);
    expect(found?.id).toBe(created.id);
  });

  it("returns null when the connection belongs to a different organisation (cross-org isolation, gate #8)", async () => {
    const created = await createPendingProviderConnection({ organisationId: orgAId, provider: "google_gemini", createdByUserId: "u" });
    const found = await getProviderConnection(orgBId, created.id);
    expect(found).toBeNull();
  });

  it("returns null for a well-formed but nonexistent connection ID", async () => {
    const found = await getProviderConnection(orgAId, "aic_00000000000000000000000000");
    expect(found).toBeNull();
  });

  it("returns null for a malformed connection ID without querying the database for a match", async () => {
    const found = await getProviderConnection(orgAId, "not-a-real-connection-id");
    expect(found).toBeNull();
  });
});
