import { describe, it, expect } from "vitest";
import { aggregateSportingLevel } from "../sporting-level-aggregation";
import { FORMULA_VERSION } from "../sporting-level-calculation";
import type { OpponentSportingEvidence } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";

function makeEvidence(overrides: Record<string, unknown> = {}): OpponentSportingEvidence {
  return {
    id: "e1",
    organisationId: "org1",
    matchId: "m1",
    opponentTeamId: "opp1",
    occurredAt: new Date("2026-06-01"),
    gameFormat: "SEVEN_A_SIDE",
    goalsFor: 3,
    goalsAgainst: 2,
    fieldedRatingSnapshot: new Prisma.Decimal("7.00"),
    participantCount: 7,
    ratedParticipantCount: 7,
    weightingMethod: "PARTICIPANT_AVERAGE",
    estimate: new Prisma.Decimal("7.40"),
    formulaVersion: FORMULA_VERSION,
    excludedAt: null,
    exclusionReason: null,
    fieldedRatingDetails: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    ...overrides,
  } as OpponentSportingEvidence;
}

describe("Sporting level query integration", () => {
  it("excluded evidence is filtered out by aggregation", () => {
    const active = makeEvidence({ id: "e1", excludedAt: null, estimate: new Prisma.Decimal("7.00") });
    const excluded = makeEvidence({
      id: "e2",
      matchId: "m2",
      excludedAt: new Date("2026-07-01"),
      exclusionReason: "Auto-excluded: match fit CHAOTIC",
      estimate: new Prisma.Decimal("2.00"),
    });

    const result = aggregateSportingLevel([active, excluded]);
    expect(result).not.toBeNull();
    expect(result!.validEncounterCount).toBe(1);
    expect(result!.estimatedLevel).toBe(7.0);
  });

  it("all excluded evidence yields null aggregate", () => {
    const excluded = makeEvidence({
      excludedAt: new Date("2026-07-01"),
      exclusionReason: "Coach manual exclusion",
    });

    const result = aggregateSportingLevel([excluded]);
    expect(result).toBeNull();
  });

  it("game format boost applies when matching format", () => {
    const sameFormat = makeEvidence({
      id: "e1",
      gameFormat: "SEVEN_A_SIDE",
      estimate: new Prisma.Decimal("7.00"),
      occurredAt: new Date("2026-06-01"),
    });
    const otherFormat = makeEvidence({
      id: "e2",
      matchId: "m2",
      gameFormat: "FIVE_A_SIDE",
      estimate: new Prisma.Decimal("5.00"),
      occurredAt: new Date("2026-05-15"),
    });

    const result = aggregateSportingLevel([sameFormat, otherFormat], new Date("2026-07-01"), "SEVEN_A_SIDE");
    expect(result).not.toBeNull();
    expect(result!.estimatedLevel).toBeGreaterThan(6.0);
  });
});