import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    notificationOutbox: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    notificationDelivery: {
      updateMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/security/audit-log", () => ({ logNotificationSent: vi.fn() }));
// `isTest()` reads a module-load-time-frozen constant (`matchboardEnv`, resolved once from
// process.env at import time — env.ts:29), not live process.env, so mutating
// process.env.MATCHBOARD_ENV mid-test can't flip its answer. Mock only `isTest`, keeping every
// other export real (provider.ts/provider-factory.ts also depend on this module).
vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  isTest: vi.fn(),
}));

import { db } from "@/lib/db";
import { isTest } from "@/lib/env";
import { sendNotificationNow } from "../outbox";
import { setEmailProvider, resetEmailProvider } from "../provider-factory";
import { FakeEmailProvider } from "../fake-provider";

describe("outbox — subject prefix and correlation tags (ADR-0076)", () => {
  const originalEnv = process.env.MATCHBOARD_ENV;
  let fakeProvider: FakeEmailProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeProvider = new FakeEmailProvider();
    setEmailProvider(fakeProvider);

    vi.mocked(db.notificationOutbox.findUnique).mockResolvedValue({
      id: "outbox-1",
      organisationId: "org-1",
      idempotencyKey: null,
      template: "ORGANISATION_INVITATION",
      payload: {
        organisationName: "Test Club",
        inviterName: "Coach A",
        inviterEmail: "coach@example.com",
        inviteeEmail: "invitee@example.com",
        role: "COACH",
        acceptUrl: "/invite/abc123",
        organisationSlug: "test-club",
      },
      status: "PENDING",
      scheduledAt: new Date(),
      processedAt: null,
      retryCount: 0,
      maxRetries: 5,
      nextRetryAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deliveries: [{ recipientEmail: "invitee@example.com" }] as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  afterEach(() => {
    resetEmailProvider();
    if (originalEnv !== undefined) process.env.MATCHBOARD_ENV = originalEnv;
    else delete process.env.MATCHBOARD_ENV;
  });

  it("prefixes the subject with [TEST] when isTest() is true", async () => {
    vi.mocked(isTest).mockReturnValue(true);
    process.env.MATCHBOARD_ENV = "test";

    await sendNotificationNow("outbox-1");

    expect(fakeProvider.sent).toHaveLength(1);
    expect(fakeProvider.sent[0].subject.startsWith("[TEST] ")).toBe(true);
  });

  it("does not prefix the subject when isTest() is false", async () => {
    vi.mocked(isTest).mockReturnValue(false);
    process.env.MATCHBOARD_ENV = "production";

    await sendNotificationNow("outbox-1");

    expect(fakeProvider.sent).toHaveLength(1);
    expect(fakeProvider.sent[0].subject.startsWith("[TEST]")).toBe(false);
  });

  it("attaches environment, template, organisationId, and recipient correlation tags", async () => {
    vi.mocked(isTest).mockReturnValue(true);
    process.env.MATCHBOARD_ENV = "test";

    await sendNotificationNow("outbox-1");

    expect(fakeProvider.sent[0].tags).toEqual({
      template: "ORGANISATION_INVITATION",
      organisationId: "org-1",
      environment: "test",
      recipient: "invitee@example.com",
    });
  });
});
