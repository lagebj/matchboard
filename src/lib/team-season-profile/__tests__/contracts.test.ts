import { describe, it, expect } from "vitest";
import {
  parseTeamSeasonProfileV1,
  safeParseTeamSeasonProfileV1,
  teamSeasonPatternSchema,
  TEAM_SEASON_PROFILE_VERSION,
  type TeamSeasonPattern,
  type TeamSeasonProfileV1,
} from "@/lib/team-season-profile/contracts";

function validPattern(overrides: Partial<TeamSeasonPattern> = {}): TeamSeasonPattern {
  return {
    key: "rhythm:first-half:opening-10:for",
    family: "MATCH_RHYTHM",
    subtype: "OPENING_FOR",
    subjects: {},
    evidenceStrength: "EMERGING",
    trajectory: "PERSISTENT",
    tone: "POSITIVE",
    firstObservedAt: "2026-08-01T00:00:00.000Z",
    lastObservedAt: "2026-09-20T00:00:00.000Z",
    approximateTiming: false,
    sample: { matches: 5 },
    metrics: { candidateGoals: 5, candidateExposureMinutes: 42 },
    sourceRefs: ["match:m1", "match:m2"],
    ...overrides,
  };
}

function validProfile(overrides: Partial<TeamSeasonProfileV1> = {}): TeamSeasonProfileV1 {
  return {
    version: TEAM_SEASON_PROFILE_VERSION,
    organisationId: "org1",
    teamId: "team1",
    leagueSeasonId: "season1",
    seasonStart: "2026-08-01T00:00:00.000Z",
    seasonEnd: "2026-12-01T00:00:00.000Z",
    computedAt: "2026-09-27T00:00:00.000Z",
    sourceFingerprint: "abc123",
    sample: {
      completedMatches: 6,
      matchesWithUsableTiming: 6,
      totalResolvedMinutes: 360,
      qualitativeObservationCount: 4,
      combinationEvidenceCount: 2,
    },
    patterns: [validPattern()],
    topPatternKeys: ["rhythm:first-half:opening-10:for"],
    ...overrides,
  };
}

describe("team-season-profile/contracts", () => {
  it("validates a well-formed V1 payload", () => {
    const profile = validProfile();
    expect(() => parseTeamSeasonProfileV1(profile)).not.toThrow();
  });

  it("rejects an unknown profile version rather than coercing it", () => {
    const payload = { ...validProfile(), version: 2 };
    const result = safeParseTeamSeasonProfileV1(payload);
    expect(result.success).toBe(false);
  });

  it("rejects a missing version", () => {
    const payload = validProfile() as unknown as Record<string, unknown>;
    delete payload.version;
    const result = safeParseTeamSeasonProfileV1(payload);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid evidenceStrength enum value", () => {
    const pattern = validPattern({ evidenceStrength: "HIGH" as never });
    const result = teamSeasonPatternSchema.safeParse(pattern);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid trajectory enum value", () => {
    const pattern = validPattern({ trajectory: "IMPROVING" as never });
    const result = teamSeasonPatternSchema.safeParse(pattern);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid tone enum value", () => {
    const pattern = validPattern({ tone: "GOOD" as never });
    const result = teamSeasonPatternSchema.safeParse(pattern);
    expect(result.success).toBe(false);
  });

  it("accepts the full confidence vocabulary", () => {
    for (const evidenceStrength of ["INSUFFICIENT", "EMERGING", "ESTABLISHED"] as const) {
      const result = teamSeasonPatternSchema.safeParse(validPattern({ evidenceStrength }));
      expect(result.success).toBe(true);
    }
  });

  it("accepts the full trajectory vocabulary", () => {
    for (const trajectory of ["NEW", "PERSISTENT", "STRENGTHENING", "WEAKENING", "MIXED", "DORMANT"] as const) {
      const result = teamSeasonPatternSchema.safeParse(validPattern({ trajectory }));
      expect(result.success).toBe(true);
    }
  });

  it("allows combination subjects with sorted player IDs and a corridor", () => {
    const pattern = validPattern({
      family: "COMBINATION",
      subtype: "CORRIDOR",
      subjects: { playerIds: ["p1", "p2", "p3"], corridor: "RIGHT" },
    });
    const result = teamSeasonPatternSchema.safeParse(pattern);
    expect(result.success).toBe(true);
  });

  it("rejects a corridor value outside LEFT|CENTRE|RIGHT", () => {
    const pattern = validPattern({ subjects: { corridor: "MIDDLE" as never } });
    const result = teamSeasonPatternSchema.safeParse(pattern);
    expect(result.success).toBe(false);
  });

  it("rejects metrics with a non-primitive value", () => {
    const pattern = { ...validPattern(), metrics: { bad: { nested: true } } };
    const result = teamSeasonPatternSchema.safeParse(pattern);
    expect(result.success).toBe(false);
  });

  it("round-trips through JSON without losing fidelity", () => {
    const profile = validProfile({ patterns: [validPattern(), validPattern({ key: "theme:build-up:working", family: "TACTICAL_THEME" })] });
    const roundTripped = JSON.parse(JSON.stringify(profile));
    const parsed = parseTeamSeasonProfileV1(roundTripped);
    expect(parsed).toEqual(profile);
  });

  it("safeParse reports failure without throwing on garbage input", () => {
    const result = safeParseTeamSeasonProfileV1({ nonsense: true });
    expect(result.success).toBe(false);
  });
});
