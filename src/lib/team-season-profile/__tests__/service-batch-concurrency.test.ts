import { describe, it, expect, vi } from "vitest";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import type { ProfileSources } from "@/lib/team-season-profile/load-profile-sources";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    teamSeasonProfile: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}));

let activeCount = 0;
let maxActiveCount = 0;

function fakeSources(params: { organisationId: string; teamId: string; leagueSeasonId: string }): ProfileSources {
  return {
    organisationId: params.organisationId,
    teamId: params.teamId,
    leagueSeasonId: params.leagueSeasonId,
    seasonStart: new Date("2026-08-01"),
    seasonEnd: new Date("2026-12-01"),
    eligibleMatches: [],
    recentMatchIds: new Set(),
    rhythmSamples: [],
    combinationEvidenceRows: [],
    opponentByMatch: new Map(),
    themeObservations: [],
    playerExposures: [],
    realPlayerIds: new Set(),
    qualitativeObservationCount: 0,
    combinationEvidenceCount: 0,
    totalResolvedMinutes: 0,
    fingerprintInput: { teamId: params.teamId },
  };
}

vi.mock("@/lib/team-season-profile/load-profile-sources", () => ({
  loadTeamSeasonProfileSources: vi.fn(async (params: { organisationId: string; teamId: string; leagueSeasonId: string }) => {
    activeCount += 1;
    maxActiveCount = Math.max(maxActiveCount, activeCount);
    await new Promise((resolve) => setTimeout(resolve, 15));
    activeCount -= 1;
    return fakeSources(params);
  }),
}));

describe("team-season-profile/service — getTeamSeasonProfiles batch concurrency (G.10)", () => {
  it("never runs more than 3 concurrent profile builds regardless of team count", async () => {
    const { getTeamSeasonProfiles } = await import("@/lib/team-season-profile/service");
    const orgFilter: OrgFilterMode = { type: "org", filter: { organisationId: "org1" }, filterNullable: { organisationId: "org1" }, organisationId: "org1" };
    const teamIds = Array.from({ length: 10 }, (_, i) => `team${i}`);

    const results = await getTeamSeasonProfiles({ organisationId: "org1", teamIds, leagueSeasonId: "season1", orgFilter });

    expect(results.size).toBe(10);
    expect(maxActiveCount).toBeLessThanOrEqual(3);
    expect(maxActiveCount).toBeGreaterThan(1);
  });
});
