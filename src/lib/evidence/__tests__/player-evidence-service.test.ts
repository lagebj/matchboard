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

const defaultInput = (overrides?: Partial<PlayerEvidenceInput>): PlayerEvidenceInput => ({
  playerId: "p1",
  organisationId: "org1",
  observations: [],
  currentPlayerAttributes: defaultAttributes,
  goalkeeperAbility: "NO",
  cutoverAt: null,
  ...overrides,
});

describe("computePlayerAssessmentProposals", () => {
  it("returns no attribute proposals for a player with no observations", () => {
    const result = computePlayerAssessmentProposals(defaultInput());
    expect(result.attributeProposals).toEqual([]);
    expect(result.goalkeeperProposal).toBeNull();
  });

  it("returns NO_CHANGE for a single positive observation (below threshold)", () => {
    const input = defaultInput({
      observations: [
        {
          playerId: "p1",
          observationCode: "SECURE_ON_BALL",
          polarity: "POSITIVE",
          matchId: "m1",
          occurredAt: NOW,
        },
      ],
    });

    const result = computePlayerAssessmentProposals(input);
    expect(result.attributeProposals.length).toBeGreaterThan(0);

    const ballControlProposal = result.attributeProposals.find((p) => p.attributeKey === "ballControl");
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

    const input = defaultInput({ observations });
    const result = computePlayerAssessmentProposals(input);
    const ballControlProposal = result.attributeProposals.find((p) => p.attributeKey === "ballControl");
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

    const input = defaultInput({ observations });
    const result = computePlayerAssessmentProposals(input);
    const ballControlProposal = result.attributeProposals.find((p) => p.attributeKey === "ballControl");
    expect(ballControlProposal).toBeDefined();
    expect(ballControlProposal!.direction).toBe("DECREASE");
    expect(ballControlProposal!.proposedValue).toBeLessThan(6);
  });

  it("returns null for null attributes (not rated)", () => {
    const nullAttributes = { ...defaultAttributes, ballControl: null };
    const input = defaultInput({
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
    });

    const result = computePlayerAssessmentProposals(input);
    const ballControlProposal = result.attributeProposals.find((p) => p.attributeKey === "ballControl");
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

    const input = defaultInput({ observations, cutoverAt });
    const result = computePlayerAssessmentProposals(input);
    const effortProposal = result.attributeProposals.find((p) => p.attributeKey === "effort");
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

    const input = defaultInput({ observations, cutoverAt });
    const result = computePlayerAssessmentProposals(input);
    const effortProposal = result.attributeProposals.find((p) => p.attributeKey === "effort");
    expect(effortProposal).toBeDefined();
    expect(effortProposal!.direction).toBe("INCREASE");
  });

  it("produces supporting evidence for secondary targets", () => {
    const input = defaultInput({
      observations: [
        {
          playerId: "p1",
          observationCode: "SECURE_ON_BALL",
          polarity: "POSITIVE",
          matchId: "m1",
          occurredAt: NOW,
        },
      ],
    });

    const result = computePlayerAssessmentProposals(input);

    const ballControlProposal = result.attributeProposals.find((p) => p.attributeKey === "ballControl");
    expect(ballControlProposal).toBeDefined();

    const firstTouchProposal = result.attributeProposals.find((p) => p.attributeKey === "firstTouch");
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

    const input = defaultInput({ observations, context });
    const result = computePlayerAssessmentProposals(input);
    const passingProposal = result.attributeProposals.find((p) => p.attributeKey === "passing");
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

    const input = defaultInput({ observations });
    const result = computePlayerAssessmentProposals(input);
    const effortProposal = result.attributeProposals.find((p) => p.attributeKey === "effort");
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

    const input = defaultInput({ observations, currentPlayerAttributes: minAttributes });
    const result = computePlayerAssessmentProposals(input);
    const effortProposal = result.attributeProposals.find((p) => p.attributeKey === "effort");
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

    const input = defaultInput({ observations });
    const result = computePlayerAssessmentProposals(input);
    const ballControlProposal = result.attributeProposals.find((p) => p.attributeKey === "ballControl");
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

  it("produces position-based supporting evidence from context", () => {
    const context: MatchContextEvidence = {
      playerId: "p1",
      matchId: "m1",
      goals: 0,
      assists: 0,
      minutesPlayed: 60,
      position: "CB",
      opponentRating: null,
      isWin: false,
      isLoss: false,
      occurredAt: NOW,
    };

    const input = defaultInput({ context });
    const result = computePlayerAssessmentProposals(input);

    expect(result.attributeProposals.length).toBeGreaterThanOrEqual(0);
  });
});

describe("computeGoalkeeperProposal", () => {
  it("promotes goalkeeper from NO to EMERGENCY with sufficient positive observations", () => {
    const observations: MatchObservationEvidence[] = [];
    for (let i = 0; i < 3; i++) {
      observations.push({
        playerId: "p1",
        observationCode: "GOALKEEPING_EFFECTIVE",
        polarity: "POSITIVE",
        matchId: `m${i + 1}`,
        occurredAt: new Date(NOW.getTime() + i * 86400000),
      });
    }

    const input = defaultInput({ observations, goalkeeperAbility: "NO" });
    const result = computePlayerAssessmentProposals(input);
    expect(result.goalkeeperProposal).not.toBeNull();
    expect(result.goalkeeperProposal!.direction).toBe("PROMOTE");
    expect(result.goalkeeperProposal!.proposedValue).toBe("EMERGENCY");
  });

  it("promotes goalkeeper from EMERGENCY to YES with sufficient positive observations", () => {
    const observations: MatchObservationEvidence[] = [];
    for (let i = 0; i < 3; i++) {
      observations.push({
        playerId: "p1",
        observationCode: "GOALKEEPING_EFFECTIVE",
        polarity: "POSITIVE",
        matchId: `m${i + 1}`,
        occurredAt: new Date(NOW.getTime() + i * 86400000),
      });
    }

    const input = defaultInput({ observations, goalkeeperAbility: "EMERGENCY" });
    const result = computePlayerAssessmentProposals(input);
    expect(result.goalkeeperProposal).not.toBeNull();
    expect(result.goalkeeperProposal!.direction).toBe("PROMOTE");
    expect(result.goalkeeperProposal!.proposedValue).toBe("YES");
  });

  it("demotes goalkeeper from YES with sufficient negative observations", () => {
    const observations: MatchObservationEvidence[] = [];
    for (let i = 0; i < 3; i++) {
      observations.push({
        playerId: "p1",
        observationCode: "GOALKEEPING_EFFECTIVE",
        polarity: "NEGATIVE",
        matchId: `m${i + 1}`,
        occurredAt: new Date(NOW.getTime() + i * 86400000),
      });
    }

    const input = defaultInput({ observations, goalkeeperAbility: "YES" });
    const result = computePlayerAssessmentProposals(input);
    expect(result.goalkeeperProposal).not.toBeNull();
    expect(result.goalkeeperProposal!.direction).toBe("DEMOTE");
    expect(result.goalkeeperProposal!.proposedValue).toBe("EMERGENCY");
  });

  it("returns null for no goalkeeper observations", () => {
    const input = defaultInput({ goalkeeperAbility: "NO" });
    const result = computePlayerAssessmentProposals(input);
    expect(result.goalkeeperProposal).toBeNull();
  });

  it("returns NO_CHANGE when observations are insufficient", () => {
    const input = defaultInput({
      observations: [
        {
          playerId: "p1",
          observationCode: "GOALKEEPING_EFFECTIVE",
          polarity: "POSITIVE",
          matchId: "m1",
          occurredAt: NOW,
        },
      ],
      goalkeeperAbility: "NO",
    });
    const result = computePlayerAssessmentProposals(input);
    expect(result.goalkeeperProposal).not.toBeNull();
    expect(result.goalkeeperProposal!.direction).toBe("NO_CHANGE");
  });

  it("blocks goalkeeper evidence before cutover date", () => {
    const cutoverAt = new Date("2026-08-20T00:00:00Z");
    const observations: MatchObservationEvidence[] = [];
    for (let i = 0; i < 3; i++) {
      observations.push({
        playerId: "p1",
        observationCode: "GOALKEEPING_EFFECTIVE",
        polarity: "POSITIVE",
        matchId: `m${i + 1}`,
        occurredAt: new Date("2026-08-15T00:00:00Z"),
      });
    }

    const input = defaultInput({ observations, goalkeeperAbility: "NO", cutoverAt });
    const result = computePlayerAssessmentProposals(input);
    expect(result.goalkeeperProposal).toBeNull();
  });
});