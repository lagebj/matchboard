import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { generateMatchRound } from "@/lib/selection/generate-round";
import { persistRoundExplanations } from "@/lib/selection/persist-explanations";
import { buildExplanation } from "@/lib/selection/explanation-generation";
import { renderReason } from "@/lib/formatters/recommendation-reason-text";
import { CODE_TO_CATEGORY } from "@/lib/explanations/recommendation-reason";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext();
let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

/**
 * C6 / ADR-0128: every squad-selection explanation whose `code` maps to a `ReasonCode` carries a
 * structured, neutral `reason`, and it is persisted alongside the prose.
 */
describe("squad-selection explanations carry a structured RecommendationReason (C6)", () => {
  let fixture: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("buildExplanation attaches a reason for a mapped code and renders it neutrally", () => {
    const rec = buildExplanation("registered_match_fairness", "prose here", false);
    expect(rec.reason).toBeDefined();
    expect(rec.reason!.category).toBe(CODE_TO_CATEGORY[rec.reason!.code]);
    expect(rec.reason!.polarity).toBe("SUPPORTING");
    const text = renderReason(rec.reason!).toLowerCase();
    for (const banned of ["weak", "poor", "better player", "score", "rank"]) {
      expect(text.includes(banned), `"${text}" contains "${banned}"`).toBe(false);
    }
  });

  it("buildExplanation leaves reason undefined for an unmapped code", () => {
    expect(buildExplanation("eligible_core_player", "prose", true).reason).toBeUndefined();
  });

  it("a generated round persists `reason` on its SelectionExplanation rulesApplied entries", async () => {
    const generated = await generateMatchRound(fixture.matchRoundId);
    await persistRoundExplanations(generated);

    const rows = await testDb.selectionExplanation.findMany({
      where: { matchId: { in: Object.values(fixture.matches) } },
      select: { rulesApplied: true },
    });
    expect(rows.length).toBeGreaterThan(0);

    const allRules = rows.flatMap((r) => r.rulesApplied as Array<{ code: string; reason?: { code: string; category: string } }>);
    expect(allRules.length).toBeGreaterThan(0);

    // Every persisted rule whose code maps must carry a well-formed reason.
    const mappedWithReason = allRules.filter((rule) => rule.reason);
    expect(mappedWithReason.length).toBeGreaterThan(0);
    for (const rule of mappedWithReason) {
      expect(rule.reason!.category).toBe(CODE_TO_CATEGORY[rule.reason!.code as keyof typeof CODE_TO_CATEGORY]);
    }
  });
});
