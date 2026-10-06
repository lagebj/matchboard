import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { rankPatterns, selectTopPatternKeys, buildTeamSeasonProfile } from "@/lib/team-season-profile/build-profile";
import { teamSeasonProfileV1Schema, type TeamSeasonPattern } from "@/lib/team-season-profile/contracts";
import type { ProfileSources } from "@/lib/team-season-profile/load-profile-sources";

function pattern(overrides: Partial<TeamSeasonPattern>): TeamSeasonPattern {
  return {
    key: "p",
    family: "MATCH_RHYTHM",
    subtype: "X",
    subjects: {},
    evidenceStrength: "EMERGING",
    trajectory: "PERSISTENT",
    tone: "NEUTRAL",
    firstObservedAt: null,
    lastObservedAt: null,
    approximateTiming: false,
    sample: { matches: 3 },
    metrics: {},
    sourceRefs: [],
    ...overrides,
  };
}

describe("team-season-profile/build-profile — rankPatterns", () => {
  it("ranks ESTABLISHED before EMERGING", () => {
    const a = pattern({ key: "a", evidenceStrength: "EMERGING", sample: { matches: 10 } });
    const b = pattern({ key: "b", evidenceStrength: "ESTABLISHED", sample: { matches: 3 } });
    expect(rankPatterns([a, b]).map((p) => p.key)).toEqual(["b", "a"]);
  });

  it("ranks higher match count ahead within the same confidence tier", () => {
    const a = pattern({ key: "a", sample: { matches: 3 } });
    const b = pattern({ key: "b", sample: { matches: 6 } });
    expect(rankPatterns([a, b]).map((p) => p.key)).toEqual(["b", "a"]);
  });

  it("is deterministic regardless of input array order", () => {
    const a = pattern({ key: "a", sample: { matches: 3 } });
    const b = pattern({ key: "b", sample: { matches: 3 } });
    const c = pattern({ key: "c", sample: { matches: 3 } });
    const order1 = rankPatterns([a, b, c]).map((p) => p.key);
    const order2 = rankPatterns([c, a, b]).map((p) => p.key);
    expect(order1).toEqual(order2);
  });
});

describe("team-season-profile/build-profile — selectTopPatternKeys", () => {
  it("returns a plain top-N slice without diversity preference", () => {
    const patterns = [
      pattern({ key: "a", family: "MATCH_RHYTHM" }),
      pattern({ key: "b", family: "MATCH_RHYTHM" }),
      pattern({ key: "c", family: "TACTICAL_THEME" }),
    ];
    expect(selectTopPatternKeys(patterns, 2)).toEqual(["a", "b"]);
  });

  it("prefers family diversity when enabled and another family still has room", () => {
    const patterns = [
      pattern({ key: "rhythm-1", family: "MATCH_RHYTHM" }),
      pattern({ key: "rhythm-2", family: "MATCH_RHYTHM" }),
      pattern({ key: "theme-1", family: "TACTICAL_THEME" }),
    ];
    const selected = selectTopPatternKeys(patterns, 2, true);
    expect(selected).toContain("rhythm-1");
    expect(selected).toContain("theme-1");
    expect(selected).not.toContain("rhythm-2");
  });

  it("backfills with the same family if no other family exists", () => {
    const patterns = [pattern({ key: "a", family: "MATCH_RHYTHM" }), pattern({ key: "b", family: "MATCH_RHYTHM" })];
    expect(selectTopPatternKeys(patterns, 2, true)).toEqual(["a", "b"]);
  });
});

function emptySources(overrides: Partial<ProfileSources> = {}): ProfileSources {
  return {
    organisationId: "org1",
    teamId: "team1",
    leagueSeasonId: "season1",
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
    fingerprintInput: { empty: true },
    ...overrides,
  };
}

describe("team-season-profile/build-profile — buildTeamSeasonProfile", () => {
  it("produces a valid, empty profile when there is no eligible evidence", () => {
    const profile = buildTeamSeasonProfile(emptySources());
    expect(() => teamSeasonProfileV1Schema.parse(profile)).not.toThrow();
    expect(profile.patterns).toEqual([]);
    expect(profile.topPatternKeys).toEqual([]);
    expect(profile.sample.completedMatches).toBe(0);
  });

  it("is a no-op fingerprint-wise when the same sources are built twice", () => {
    const sources = emptySources({ fingerprintInput: { leagueSeasonId: "season1", matches: [{ matchId: "m1", reportUpdatedAt: "2026-08-01" }] } });
    const first = buildTeamSeasonProfile(sources);
    const second = buildTeamSeasonProfile(sources);
    expect(first.sourceFingerprint).toBe(second.sourceFingerprint);
  });
});
