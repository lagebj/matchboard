import { describe, it, expect } from "vitest";
import {
  computePlayerAssessmentProposals,
  type PlayerEvidenceInput,
  type MatchObservationEvidence,
  type MatchContextEvidence,
} from "../player-evidence-service";
import type { RatingAttributeKey } from "@/lib/ratings/player-rating";
import { ALL_OBSERVATION_CODES } from "@/lib/evidence/observation-vocabulary";
import { getDirectTargets } from "@/lib/evidence/observation-mapping";

const NOW = new Date("2026-08-26T12:00:00Z");

const defaultAttributes: Record<RatingAttributeKey, number | null> = {
  ballControl: 6,
  passing: 5,
  firstTouch: 6,
  oneVOneAttacking: 5,
  positioning: 6,
  oneVOneDefending: 4,
  decisionMaking: 5,
  effort: 7,
  teamplay: 6,
  concentration: 5,
  speed: 6,
  strength: 5,
};

describe("computePlayerAssessmentProposals", () => {
  it("returns no proposals for a player with no observations", () => {
    const input: PlayerEvidenceInput = {
      playerId: "p1",
      organisationId: "org1",
      observations: [],
      currentPlayerAttributes: defaultAttributes,
      cutoverAt: null,
    };

    const proposals = computePlayerAssessmentProposals(input);
    expect(proposals).toEqual([]);
  });

  it("returns NO_CHANGE for a single positive observation (below threshold)", () => {
    const input: PlayerEvidenceInput = {
      playerId: "p1",
      organisationId: "org1",
      observations: [
        {
          playerId: "p1",
          observationCode: "SECURE_ON_BALL",
          polarity: "POSITIVE",
          matchId: "m1",
          occurredAt: NOW,
        },
      ],
      currentPlayerAttributes: defaultAttributes,
      cutoverAt: null,
    };

    const proposals = computePlayerAssessmentProposals(input);
    expect(proposals.length).toBeGreaterThan(0);

    const ballControlProposal = proposals.find((p) => p.attributeKey === "ballControl");
    expect(ballControlProposal).toBeDefined();
    expect(ballControlProposal!.direction).toBe("NO_CHANGE");
    expect(ballControlProposal!.proposedValue).toBe(6);
  });

  it("returns INCREASE for multiple positive observations above threshold", () => {
    const observations: MatchObservationEvidence[] = [];
    for (let i = 0; i < 3; i++) {
      observations.push({
        playerId: "p1",
        observationCode: "SECURE_ON_BALL",
        polarity: "POSITIVE",
        matchId: `m${i + 1}`,
        occurredAt: new Date(NOW.getTime() + i * 86400000),
      });
    }

    const input: PlayerEvidenceInput = {
      playerId: "p1",
      organisationId: "org1",
      observations,
      currentPlayerAttributes: defaultAttributes,
      cutoverAt: null,
    };

    const proposals = computePlayerAssessmentProposals(input);
    const ballControlProposal = proposals.find((p) => p.attributeKey === "ballControl");
    expect(ballControlProposal).toBeDefined();
    expect(ballControlProposal!.direction).toBe("INCREASE");
    expect(ballControlProposal!.proposedValue).toBeGreaterThan(6);
  });

  it("returns DECREASE for multiple negative observations above threshold", () => {
    const observations: MatchObservationEvidence[] = [];
    for (let i = 0; i < 4; i++) {
      observations.push({
        playerId: "p1",
        observationCode: "SECURE_ON_BALL",
        polarity: "NEGATIVE",
        matchId: `m${i + 1}`,
        occurredAt: new Date(NOW.getTime() + i * 86400000),
      });
    }

    const input: PlayerEvidenceInput = {
      playerId: "p1",
      organisationId: "org1",
      observations,
      currentPlayerAttributes: defaultAttributes,
      cutoverAt: null,
    };

    const proposals = computePlayerAssessmentProposals(input);
    const ballControlProposal = proposals.find((p) => p.attributeKey === "ballControl");
    expect(ballControlProposal).toBeDefined();
    expect(ballControlProposal!.direction).toBe("DECREASE");
    expect(ballControlProposal!.proposedValue).toBeLessThan(6);
  });

  it("returns null for null attributes (not rated)", () => {
    const nullAttributes = { ...defaultAttributes, ballControl: null };
    const input: PlayerEvidenceInput = {
      playerId: "p1",
      organisationId: "org1",
      observations: [
        {
          playerId: "p1",
          observationCode: "SECURE_ON_BALL",
          polarity: "POSITIVE",
          matchId: "m1",
          occurredAt: NOW,
        },
      ],
      currentPlayerAttributes: nullAttributes,
      cutoverAt: null,
    };

    const proposals = computePlayerAssessmentProposals(input);
    const ballControlProposal = proposals.find((p) => p.attributeKey === "ballControl");
    expect(ballControlProposal).toBeUndefined();
  });

  it("blocks evidence before cutover date", () => {
    const cutoverAt = new Date("2026-08-20T00:00:00Z");
    const observations: MatchObservationEvidence[] = [];
    for (let i = 0; i < 4; i++) {
      observations.push({
        playerId: "p1",
        observationCode: "WORK_RATE_EFFECTIVE",
        polarity: "POSITIVE",
        matchId: `m${i + 1}`,
        occurredAt: new Date("2026-08-15T00:00:00Z"),
      });
    }

    const input: PlayerEvidenceInput = {
      playerId: "p1",
      organisationId: "org1",
      observations,
      currentPlayerAttributes: defaultAttributes,
      cutoverAt,
    };

    const proposals = computePlayerAssessmentProposals(input);
    const effortProposal = proposals.find((p) => p.attributeKey === "effort");
    expect(effortProposal).toBeUndefined();
  });

  it("allows evidence after cutover date", () => {
    const cutoverAt = new Date("2026-08-20T00:00:00Z");
    const observations: MatchObservationEvidence[] = [];
    for (let i = 0; i < 4; i++) {
      observations.push({
        playerId: "p1",
        observationCode: "WORK_RATE_EFFECTIVE",
        polarity: "POSITIVE",
        matchId: `m${i + 1}`,
        occurredAt: new Date("2026-08-25T00:00:00Z"),
      });
    }

    const input: PlayerEvidenceInput = {
      playerId: "p1",
      organisationId: "org1",
      observations,
      currentPlayerAttributes: defaultAttributes,
      cutoverAt,
    };

    const proposals = computePlayerAssessmentProposals(input);
    const effortProposal = proposals.find((p) => p.attributeKey === "effort");
    expect(effortProposal).toBeDefined();
    expect(effortProposal!.direction).toBe("INCREASE");
  });

  it("produces supporting evidence for secondary targets", () => {
    const input: PlayerEvidenceInput = {
      playerId: "p1",
      organisationId: "org1",
      observations: [
        {
          playerId: "p1",
          observationCode: "SECURE_ON_BALL",
          polarity: "POSITIVE",
          matchId: "m1",
          occurredAt: NOW,
        },
      ],
      currentPlayerAttributes: defaultAttributes,
      cutoverAt: null,
    };

    const proposals = computePlayerAssessmentProposals(input);

    const ballControlProposal = proposals.find((p) => p.attributeKey === "ballControl");
    expect(ballControlProposal).toBeDefined();

    const firstTouchProposal = proposals.find((p) => p.attributeKey === "firstTouch");
    expect(firstTouchProposal).toBeDefined();
    expect(firstTouchProposal!.direction).toBe("NO_CHANGE");
  });

  it("includes context evidence from goals and assists", () => {
    const observations: MatchObservationEvidence[] = [];
    for (let i = 0; i < 3; i++) {
      observations.push({
        playerId: "p1",
        observationCode: "PASSING_EFFECTIVE",
        polarity: "POSITIVE",
        matchId: `m${i + 1}`,
        occurredAt: new Date(NOW.getTime() + i * 86400000),
      });
    }

    const context: MatchContextEvidence = {
      playerId: "p1",
      matchId: "m1",
      goals: 1,
      assists: 2,
      minutesPlayed: 45,
      position: "CM",
      opponentRating: 6.5,
      isWin: true,
      isLoss: false,
      occurredAt: NOW,
    };

    const input: PlayerEvidenceInput = {
      playerId: "p1",
      organisationId: "org1",
      observations,
      context,
      currentPlayerAttributes: defaultAttributes,
      cutoverAt: null,
    };

    const proposals = computePlayerAssessmentProposals(input);
    const passingProposal = proposals.find((p) => p.attributeKey === "passing");
    expect(passingProposal).toBeDefined();
    expect(passingProposal!.direction).toBe("INCREASE");
  });

  it("caps change at MAX_CHANGE_PER_STEP", () => {
    const observations: MatchObservationEvidence[] = [];
    for (let i = 0; i < 10; i++) {
      observations.push({
        playerId: "p1",
        observationCode: "WORK_RATE_EFFECTIVE",
        polarity: "POSITIVE",
        matchId: `m${i + 1}`,
        occurredAt: new Date(NOW.getTime() + i * 86400000),
      });
    }

    const input: PlayerEvidenceInput = {
      playerId: "p1",
      organisationId: "org1",
      observations,
      currentPlayerAttributes: defaultAttributes,
      cutoverAt: null,
    };

    const proposals = computePlayerAssessmentProposals(input);
    const effortProposal = proposals.find((p) => p.attributeKey === "effort");
    expect(effortProposal).toBeDefined();
    expect(effortProposal!.proposedValue).toBe(8);
    expect(effortProposal!.currentValue).toBe(7);
    expect(effortProposal!.magnitude).toBeLessThanOrEqual(1);
  });

  it("clamps to MIN_RATING and MAX_RATING", () => {
    const minAttributes = { ...defaultAttributes, effort: 1 };
    const observations: MatchObservationEvidence[] = [];
    for (let i = 0; i < 5; i++) {
      observations.push({
        playerId: "p1",
        observationCode: "WORK_RATE_EFFECTIVE",
        polarity: "NEGATIVE",
        matchId: `m${i + 1}`,
        occurredAt: new Date(NOW.getTime() + i * 86400000),
      });
    }

    const input: PlayerEvidenceInput = {
      playerId: "p1",
      organisationId: "org1",
      observations,
      currentPlayerAttributes: minAttributes,
      cutoverAt: null,
    };

    const proposals = computePlayerAssessmentProposals(input);
    const effortProposal = proposals.find((p) => p.attributeKey === "effort");
    expect(effortProposal).toBeDefined();
    expect(effortProposal!.proposedValue).toBeGreaterThanOrEqual(1);
  });

  it("handles conflicting positive and negative evidence", () => {
    const observations: MatchObservationEvidence[] = [
      {
        playerId: "p1",
        observationCode: "SECURE_ON_BALL",
        polarity: "POSITIVE",
        matchId: "m1",
        occurredAt: NOW,
      },
      {
        playerId: "p1",
        observationCode: "SECURE_ON_BALL",
        polarity: "NEGATIVE",
        matchId: "m2",
        occurredAt: NOW,
      },
      {
        playerId: "p1",
        observationCode: "SECURE_ON_BALL",
        polarity: "POSITIVE",
        matchId: "m3",
        occurredAt: NOW,
      },
      {
        playerId: "p1",
        observationCode: "SECURE_ON_BALL",
        polarity: "NEGATIVE",
        matchId: "m4",
        occurredAt: NOW,
      },
    ];

    const input: PlayerEvidenceInput = {
      playerId: "p1",
      organisationId: "org1",
      observations,
      currentPlayerAttributes: defaultAttributes,
      cutoverAt: null,
    };

    const proposals = computePlayerAssessmentProposals(input);
    const ballControlProposal = proposals.find((p) => p.attributeKey === "ballControl");
    expect(ballControlProposal).toBeDefined();
    expect(ballControlProposal!.direction).toBe("NO_CHANGE");
  });

  it("covers all 12 mutable attributes via DIRECT observations", () => {
    const coveredAttributes = new Set<string>();

    for (const code of ALL_OBSERVATION_CODES) {
      const targets = getDirectTargets(code);
      for (const t of targets) {
        coveredAttributes.add(t);
      }
    }

    const expectedAttributes = [
      "ballControl", "passing", "firstTouch", "oneVOneAttacking",
      "positioning", "oneVOneDefending", "decisionMaking", "effort",
      "teamplay", "concentration", "speed", "strength",
    ];

    for (const attr of expectedAttributes) {
      expect(coveredAttributes.has(attr)).toBe(true);
    }
  });
});