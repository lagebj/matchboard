import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));

import { setupTestDb, teardownTestDb } from "@/test/test-db";

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  getOrganisationAiSettings,
  ensureOrganisationAiSettings,
  setAiMasterEnabled,
  setAiCapabilityEnabled,
  setActiveConnection,
  AiMasterEnableError,
} from "@/lib/ai/organisation-ai-settings";
import { createPendingProviderConnection } from "@/lib/ai/provider-connections";

let testDb: PrismaClient;
let organisationId: string;

beforeAll(async () => {
  testDb = await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  const org = await testDb.organisation.create({ data: { name: "Org", slug: `org-${Date.now()}-${Math.random()}` } });
  organisationId = org.id;
});

describe("ai/organisation-ai-settings: defaults (gates #25, #27)", () => {
  it("a new organisation has no settings row and is therefore AI-disabled", async () => {
    const settings = await getOrganisationAiSettings(organisationId);
    expect(settings).toBeNull();
  });

  it("ensureOrganisationAiSettings creates a row with the master switch and every capability false", async () => {
    const settings = await ensureOrganisationAiSettings(organisationId);
    expect(settings.enabled).toBe(false);
    expect(settings.activeConnectionId).toBeNull();
    expect(settings.roundReviewEnabled).toBe(false);
    expect(settings.lineupReviewEnabled).toBe(false);
    expect(settings.matchPrepEnabled).toBe(false);
    expect(settings.postMatchReviewEnabled).toBe(false);
    expect(settings.weeklyTeamReviewEnabled).toBe(false);
  });

  it("ensureOrganisationAiSettings is idempotent — a second call returns the same row, not a duplicate", async () => {
    const first = await ensureOrganisationAiSettings(organisationId);
    const second = await ensureOrganisationAiSettings(organisationId);
    expect(second.id).toBe(first.id);
  });
});

describe("ai/organisation-ai-settings: setAiMasterEnabled (gate #26 + 04_ORG_CONNECTION_FLOW.md)", () => {
  it("rejects enabling AI when there is no active connection at all", async () => {
    await expect(setAiMasterEnabled(organisationId, true)).rejects.toBeInstanceOf(AiMasterEnableError);
  });

  it("rejects enabling AI when the active connection exists but is not READY", async () => {
    const connection = await createPendingProviderConnection({ organisationId, provider: "openai", createdByUserId: "u" });
    await setActiveConnection(organisationId, connection.id);

    await expect(setAiMasterEnabled(organisationId, true)).rejects.toThrow("active connection is ready");
  });

  it("connecting a provider (even a READY one, via setActiveConnection) does not itself enable AI", async () => {
    const connection = await createPendingProviderConnection({ organisationId, provider: "openai", createdByUserId: "u" });
    await testDb.aiProviderConnection.update({ where: { id: connection.id }, data: { status: "READY", model: "gpt-5" } });
    await setActiveConnection(organisationId, connection.id);

    const settings = await getOrganisationAiSettings(organisationId);
    expect(settings?.enabled).toBe(false);
  });

  it("allows enabling AI once the active connection is READY", async () => {
    const connection = await createPendingProviderConnection({ organisationId, provider: "anthropic", createdByUserId: "u" });
    await testDb.aiProviderConnection.update({ where: { id: connection.id }, data: { status: "READY", model: "claude-sonnet-5" } });
    await setActiveConnection(organisationId, connection.id);

    const settings = await setAiMasterEnabled(organisationId, true);
    expect(settings.enabled).toBe(true);
  });

  it("always allows disabling AI, without any connection validation", async () => {
    const settings = await setAiMasterEnabled(organisationId, false);
    expect(settings.enabled).toBe(false);
  });
});

describe("ai/organisation-ai-settings: setAiCapabilityEnabled", () => {
  it("toggles exactly the targeted capability, leaving the other four untouched", async () => {
    const settings = await setAiCapabilityEnabled(organisationId, "POST_MATCH_REVIEW", true);
    expect(settings.postMatchReviewEnabled).toBe(true);
    expect(settings.roundReviewEnabled).toBe(false);
    expect(settings.lineupReviewEnabled).toBe(false);
    expect(settings.matchPrepEnabled).toBe(false);
    expect(settings.weeklyTeamReviewEnabled).toBe(false);
  });

  it("can be enabled even while the master switch is off (independently configurable)", async () => {
    const settings = await setAiCapabilityEnabled(organisationId, "ROUND_REVIEW", true);
    expect(settings.enabled).toBe(false);
    expect(settings.roundReviewEnabled).toBe(true);
  });
});

describe("ai/organisation-ai-settings: setActiveConnection", () => {
  it("sets and clears the active connection pointer", async () => {
    const connection = await createPendingProviderConnection({ organisationId, provider: "mistral", createdByUserId: "u" });
    const set = await setActiveConnection(organisationId, connection.id);
    expect(set.activeConnectionId).toBe(connection.id);

    const cleared = await setActiveConnection(organisationId, null);
    expect(cleared.activeConnectionId).toBeNull();
  });
});
