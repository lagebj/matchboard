// ARR-0029 Bug 2 regression, at the real production call-site level (not just the primitive --
// see src/lib/__tests__/db-tenant-fail-closed.test.ts for that). scheduled-triggers.test.ts
// mocks @/lib/db to the raw, unextended test client, so it can never catch a tenantRLS-extension
// failure -- this file exercises the REAL extended `db` export, matching
// db-tenant-fail-closed.test.ts's own established pattern for that reason.
//
// Found live in production (2026-09-22): every /api/cron/ai invocation's match_prep scan,
// weekly_team_review scan, and connection-deletion retry scan threw TenantContextError on their
// own cross-tenant `db.match.findMany()`/`db.team.findMany()`/`db.aiProviderConnection.findMany()`
// calls -- each wrapped in `runWithSystemPrivilege(reason, () => db.X.findMany(...))`, the exact
// "callback returns the bare un-awaited lazy PrismaPromise" anti-pattern ARR-0029 already
// documented and warned against. Net effect: `match_prep` (which has no other trigger -- it is
// purely cron-scheduled) never ran for any match, ever, in production.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@/test/test-db";

describe("ai/jobs/scheduled-triggers: real tenantRLS extension (ARR-0029 Bug 2 regression)", () => {
  let testDb: PrismaClient;
  let enqueueDueMatchPrepJobs: () => Promise<{ scanned: number }>;
  let enqueueDueWeeklyTeamReviewJobs: () => Promise<{ scanned: number }>;

  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    testDb = await setupTestDb();

    // src/lib/db.ts reads DATABASE_URL at module-load time -- point it at the same disposable
    // database TEST_DATABASE_URL already uses before importing anything that pulls it in, so
    // this file exercises the real tenantRLS extension without ever touching dev/prod.
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

    // register-capabilities.ts's handler-registration side effect is irrelevant to this test
    // (it only asserts the outer cross-tenant scan queries themselves don't throw, not the
    // per-match trigger outcome -- already covered by scheduled-triggers.test.ts's mocked-db
    // suite), and pulling in the real capability context builders here would require far more
    // scaffolding for no additional coverage of the bug this file exists to catch.
    const module = await import("@/lib/ai/jobs/scheduled-triggers");
    enqueueDueMatchPrepJobs = module.enqueueDueMatchPrepJobs;
    enqueueDueWeeklyTeamReviewJobs = module.enqueueDueWeeklyTeamReviewJobs;
  });

  afterAll(async () => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    await teardownTestDb();
  });

  it("enqueueDueMatchPrepJobs scans due matches without throwing TenantContextError", async () => {
    await cleanTestDb(testDb);
    const org = await testDb.organisation.create({ data: { name: "Org", slug: `org-${Date.now()}-${Math.random()}` } });
    const group = await testDb.footballGroup.create({ data: { name: "Group", slug: `group-${Date.now()}-${Math.random()}`, type: "AGE_GROUP", organisationId: org.id } });
    const season = await testDb.season.create({ data: { name: "Season", year: 2026, organisationId: org.id } });
    const period = await testDb.leagueSeason.create({
      data: { name: "Period", part: "SPRING", seasonId: season.id, startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31"), organisationId: org.id, footballGroupId: group.id },
    });
    const round = await testDb.matchRound.create({ data: { name: "Round", leagueSeasonId: period.id, status: "DRAFT", organisationId: org.id } });
    const team = await testDb.team.create({ data: { name: "Team", organisationId: org.id, footballGroupId: group.id } });
    await testDb.match.create({
      data: {
        matchRoundId: round.id,
        teamId: team.id,
        opponent: "Opponent",
        startsAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
        homeAway: "HOME",
        status: "SCHEDULED",
        organisationId: org.id,
      },
    });

    const result = await enqueueDueMatchPrepJobs();
    expect(result.scanned).toBeGreaterThanOrEqual(1);
  });

  it("enqueueDueWeeklyTeamReviewJobs scans teams without throwing TenantContextError", async () => {
    await cleanTestDb(testDb);
    const org = await testDb.organisation.create({ data: { name: "Org", slug: `org-${Date.now()}-${Math.random()}` } });
    const group = await testDb.footballGroup.create({ data: { name: "Group", slug: `group-${Date.now()}-${Math.random()}`, type: "AGE_GROUP", organisationId: org.id } });
    await testDb.team.create({ data: { name: "Team", organisationId: org.id, footballGroupId: group.id } });

    const result = await enqueueDueWeeklyTeamReviewJobs();
    expect(result.scanned).toBeGreaterThanOrEqual(1);
  });
});
