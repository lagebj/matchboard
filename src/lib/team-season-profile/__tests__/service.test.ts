import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { getTeamSeasonProfile, rebuildTeamSeasonProfile } from "@/lib/team-season-profile/service";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;
let orgFilter: OrgFilterMode;

/**
 * DB-integration coverage for the Team Season Profile cache/tenancy mechanism (ADR-0156 Slice
 * 2, Test plan §G). Deliberately does not re-seed deep goal/combination/qualitative evidence --
 * that content is already exhaustively covered by Slice 1's pure tests
 * (`pattern-catalogue.test.ts` etc.). This file only proves the cache/staleness/tenancy
 * mechanism itself: a PostMatchReport's own fingerprint-relevant fields are enough to exercise
 * "builds, caches, rebuilds on change, fails safe on corruption, rejects cross-tenant access".
 */
describe("team-season-profile/service", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 2 });
    orgFilter = {
      type: "org",
      filter: { organisationId: fixtureIds.organisationId },
      filterNullable: { organisationId: fixtureIds.organisationId },
      organisationId: fixtureIds.organisationId,
    };

    await testDb.postMatchReport.create({
      data: {
        organisationId: fixtureIds.organisationId,
        matchId: fixtureIds.matches["Bla"],
        status: "REPORTED",
        homeGoals: 2,
        awayGoals: 1,
      },
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("builds and persists a profile on the first read (G.1)", async () => {
    const profile = await getTeamSeasonProfile({
      organisationId: fixtureIds.organisationId,
      teamId: fixtureIds.teams["Bla"],
      leagueSeasonId: fixtureIds.leagueSeasonId,
      orgFilter,
    });
    expect(profile).not.toBeNull();
    expect(profile?.sample.completedMatches).toBe(1);

    const row = await testDb.teamSeasonProfile.findUnique({
      where: {
        organisationId_teamId_leagueSeasonId: {
          organisationId: fixtureIds.organisationId,
          teamId: fixtureIds.teams["Bla"],
          leagueSeasonId: fixtureIds.leagueSeasonId,
        },
      },
    });
    expect(row).not.toBeNull();
  });

  it("returns the cached payload unchanged on a second read (G.2)", async () => {
    const first = await getTeamSeasonProfile({
      organisationId: fixtureIds.organisationId,
      teamId: fixtureIds.teams["Bla"],
      leagueSeasonId: fixtureIds.leagueSeasonId,
      orgFilter,
    });
    const second = await getTeamSeasonProfile({
      organisationId: fixtureIds.organisationId,
      teamId: fixtureIds.teams["Bla"],
      leagueSeasonId: fixtureIds.leagueSeasonId,
      orgFilter,
    });
    // computedAt is set to `new Date()` only on an actual rebuild -- an unchanged second read
    // must return the exact same computedAt the first read produced.
    expect(second?.computedAt).toBe(first?.computedAt);
    expect(second?.sourceFingerprint).toBe(first?.sourceFingerprint);
  });

  it("rebuilds when the canonical source changes (G.3)", async () => {
    const before = await getTeamSeasonProfile({
      organisationId: fixtureIds.organisationId,
      teamId: fixtureIds.teams["Bla"],
      leagueSeasonId: fixtureIds.leagueSeasonId,
      orgFilter,
    });

    await testDb.postMatchReport.update({
      where: { matchId: fixtureIds.matches["Bla"] },
      data: { homeGoals: 5 },
    });

    const after = await getTeamSeasonProfile({
      organisationId: fixtureIds.organisationId,
      teamId: fixtureIds.teams["Bla"],
      leagueSeasonId: fixtureIds.leagueSeasonId,
      orgFilter,
    });

    expect(after?.sourceFingerprint).not.toBe(before?.sourceFingerprint);
    expect(after?.computedAt).not.toBe(before?.computedAt);
  });

  it("fails safe and rebuilds when the stored payload is invalid JSON for the contract (G.9)", async () => {
    await rebuildTeamSeasonProfile({
      organisationId: fixtureIds.organisationId,
      teamId: fixtureIds.teams["Hvit"],
      leagueSeasonId: fixtureIds.leagueSeasonId,
      orgFilter,
    });

    await testDb.teamSeasonProfile.update({
      where: {
        organisationId_teamId_leagueSeasonId: {
          organisationId: fixtureIds.organisationId,
          teamId: fixtureIds.teams["Hvit"],
          leagueSeasonId: fixtureIds.leagueSeasonId,
        },
      },
      data: { payload: { nonsense: true } },
    });

    const profile = await getTeamSeasonProfile({
      organisationId: fixtureIds.organisationId,
      teamId: fixtureIds.teams["Hvit"],
      leagueSeasonId: fixtureIds.leagueSeasonId,
      orgFilter,
    });
    expect(profile).not.toBeNull();
    expect(profile?.version).toBe(1);
  });

  it("returns null for a team that does not belong to the requested organisation (G.6/G.7)", async () => {
    const otherOrg = await testDb.organisation.create({ data: { name: "Other Org", slug: `other-org-${Date.now()}` } });
    const otherOrgFilter: OrgFilterMode = {
      type: "org",
      filter: { organisationId: otherOrg.id },
      filterNullable: { organisationId: otherOrg.id },
      organisationId: otherOrg.id,
    };

    const profile = await getTeamSeasonProfile({
      organisationId: otherOrg.id,
      teamId: fixtureIds.teams["Bla"],
      leagueSeasonId: fixtureIds.leagueSeasonId,
      orgFilter: otherOrgFilter,
    });
    expect(profile).toBeNull();
  });

  it("returns null for a season id that does not resolve under the requested organisation (G.8)", async () => {
    const profile = await getTeamSeasonProfile({
      organisationId: fixtureIds.organisationId,
      teamId: fixtureIds.teams["Bla"],
      leagueSeasonId: "does-not-exist-season",
      orgFilter,
    });
    expect(profile).toBeNull();
  });
});
