import { describe, it, expect } from "vitest";
import { checkScenarioPermission, checkCompositionProposalPolicy } from "../composition-policy";
import type { TeamCompositionProposal } from "@/domain/team-composition/team-composition-types";

describe("composition-policy", () => {
  describe("checkScenarioPermission", () => {
    it("allows BALANCED without acknowledgement", () => {
      const result = checkScenarioPermission("BALANCED");
      expect(result.allowed).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("allows PRESERVE_AND_REPAIR without acknowledgement", () => {
      const result = checkScenarioPermission("PRESERVE_AND_REPAIR");
      expect(result.allowed).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("allows ONE_STRONG_REST_BALANCED without acknowledgement", () => {
      const result = checkScenarioPermission("ONE_STRONG_REST_BALANCED");
      expect(result.allowed).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("blocks TIERED_DESCENDING without acknowledgement", () => {
      const result = checkScenarioPermission("TIERED_DESCENDING");
      expect(result.allowed).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe("DECISION_REQUIRED");
      expect(result.issues[0].code).toBe("policy_gated_scenario_requires_acknowledgement");
      expect(result.reason).toContain("acknowledgement");
    });

    it("allows TIERED_DESCENDING with acknowledgement", () => {
      const result = checkScenarioPermission("TIERED_DESCENDING", {
        coachAcknowledgedPolicyGate: true,
      });
      expect(result.allowed).toBe(true);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe("PLANNING_NOTE");
      expect(result.issues[0].code).toBe("policy_gated_scenario_acknowledged");
    });
  });

  describe("checkCompositionProposalPolicy", () => {
    function makeProposal(overrides: Partial<TeamCompositionProposal> = {}): TeamCompositionProposal {
      return {
        assignments: [],
        teamMetrics: [],
        proposalMetrics: {
          overallSpread: 0.5,
          defensiveSpread: 0.3,
          midfieldSpread: 0.4,
          attackingSpread: 0.2,
          sizeSpread: 1,
          totalPlayersMoved: 0,
          averageTeamSize: 7,
        },
        validation: {
          valid: true,
          blockingIssues: [],
          warnings: [],
          notes: [],
        },
        explanations: [],
        scenarioCode: "BALANCED",
        scenarioVersion: 1,
        deterministicSeed: "test-seed",
        inputFingerprint: "test-fingerprint",
        ...overrides,
      };
    }

    it("returns no issues for a viable proposal with GK coverage", () => {
      const proposal = makeProposal({
        teamMetrics: [
          {
            teamId: "t1",
            teamName: "Team A",
            squadSize: 7,
            averageOverall: 6.0,
            goalkeeperCoverage: "full",
            goalkeeperQuality: 8,
            defensiveStrength: 6,
            midfieldStrength: 6,
            attackingStrength: 6,
            primaryPositionCount: 5,
            secondaryPositionCount: 1,
            tertiaryPositionCount: 1,
            noFitCount: 0,
            flexiblePlayerCount: 1,
            playersMovedFromCurrentTeam: 0,
            formationViability: "viable",
            structuralWarnings: [],
          },
        ],
      });
      const issues = checkCompositionProposalPolicy(proposal);
      expect(issues).toHaveLength(0);
    });

    it("flags no GK coverage as BLOCKED", () => {
      const proposal = makeProposal({
        teamMetrics: [
          {
            teamId: "t1",
            teamName: "Team A",
            squadSize: 7,
            averageOverall: 6.0,
            goalkeeperCoverage: "none",
            goalkeeperQuality: null,
            defensiveStrength: 6,
            midfieldStrength: 6,
            attackingStrength: 6,
            primaryPositionCount: 5,
            secondaryPositionCount: 1,
            tertiaryPositionCount: 1,
            noFitCount: 0,
            flexiblePlayerCount: 1,
            playersMovedFromCurrentTeam: 0,
            formationViability: "degraded",
            structuralWarnings: [],
          },
        ],
      });
      const issues = checkCompositionProposalPolicy(proposal);
      const blocked = issues.filter((i) => i.severity === "BLOCKED");
      expect(blocked).toHaveLength(1);
      expect(blocked[0].code).toBe("policy_no_goalkeeper_coverage");
    });

    it("flags broken formation as DECISION_REQUIRED", () => {
      const proposal = makeProposal({
        teamMetrics: [
          {
            teamId: "t1",
            teamName: "Team A",
            squadSize: 7,
            averageOverall: 6.0,
            goalkeeperCoverage: "full",
            goalkeeperQuality: 7,
            defensiveStrength: 6,
            midfieldStrength: 6,
            attackingStrength: 6,
            primaryPositionCount: 3,
            secondaryPositionCount: 2,
            tertiaryPositionCount: 1,
            noFitCount: 1,
            flexiblePlayerCount: 1,
            playersMovedFromCurrentTeam: 0,
            formationViability: "broken",
            structuralWarnings: [],
          },
        ],
      });
      const issues = checkCompositionProposalPolicy(proposal);
      const decisions = issues.filter((i) => i.severity === "DECISION_REQUIRED");
      expect(decisions).toHaveLength(1);
      expect(decisions[0].code).toBe("policy_broken_formation");
    });

    it("flags high no-fit percentage as DECISION_REQUIRED", () => {
      const proposal = makeProposal({
        teamMetrics: [
          {
            teamId: "t1",
            teamName: "Team A",
            squadSize: 5,
            averageOverall: 5.0,
            goalkeeperCoverage: "full",
            goalkeeperQuality: 5,
            defensiveStrength: 5,
            midfieldStrength: 5,
            attackingStrength: 5,
            primaryPositionCount: 2,
            secondaryPositionCount: 1,
            tertiaryPositionCount: 0,
            noFitCount: 3,
            flexiblePlayerCount: 0,
            playersMovedFromCurrentTeam: 0,
            formationViability: "viable",
            structuralWarnings: [],
          },
        ],
      });
      const issues = checkCompositionProposalPolicy(proposal);
      const decisions = issues.filter((i) => i.severity === "DECISION_REQUIRED");
      expect(decisions.some((i) => i.code === "policy_high_no_fit_percentage")).toBe(true);
    });

    it("flags large size spread as DECISION_REQUIRED", () => {
      const proposal = makeProposal({
        proposalMetrics: {
          overallSpread: 0.5,
          defensiveSpread: 0.3,
          midfieldSpread: 0.4,
          attackingSpread: 0.2,
          sizeSpread: 5,
          totalPlayersMoved: 3,
          averageTeamSize: 7,
        },
      });
      const issues = checkCompositionProposalPolicy(proposal);
      const decisions = issues.filter((i) => i.severity === "DECISION_REQUIRED");
      expect(decisions.some((i) => i.code === "policy_large_size_spread")).toBe(true);
    });

    it("does not flag small size spread", () => {
      const proposal = makeProposal({
        teamMetrics: [
          {
            teamId: "t1",
            teamName: "Team A",
            squadSize: 7,
            averageOverall: 6.0,
            goalkeeperCoverage: "full",
            goalkeeperQuality: 7,
            defensiveStrength: 6,
            midfieldStrength: 6,
            attackingStrength: 6,
            primaryPositionCount: 5,
            secondaryPositionCount: 1,
            tertiaryPositionCount: 1,
            noFitCount: 0,
            flexiblePlayerCount: 1,
            playersMovedFromCurrentTeam: 0,
            formationViability: "viable",
            structuralWarnings: [],
          },
        ],
        proposalMetrics: {
          overallSpread: 0.5,
          defensiveSpread: 0.3,
          midfieldSpread: 0.4,
          attackingSpread: 0.2,
          sizeSpread: 2,
          totalPlayersMoved: 1,
          averageTeamSize: 7,
        },
      });
      const issues = checkCompositionProposalPolicy(proposal);
      expect(issues).toHaveLength(0);
    });

    it("skips GK check for empty teams", () => {
      const proposal = makeProposal({
        teamMetrics: [
          {
            teamId: "t1",
            teamName: "Team A",
            squadSize: 0,
            averageOverall: null,
            goalkeeperCoverage: "none",
            goalkeeperQuality: null,
            defensiveStrength: null,
            midfieldStrength: null,
            attackingStrength: null,
            primaryPositionCount: 0,
            secondaryPositionCount: 0,
            tertiaryPositionCount: 0,
            noFitCount: 0,
            flexiblePlayerCount: 0,
            playersMovedFromCurrentTeam: 0,
            formationViability: "broken",
            structuralWarnings: [],
          },
        ],
      });
      const issues = checkCompositionProposalPolicy(proposal);
      expect(issues.filter((i) => i.code === "policy_no_goalkeeper_coverage")).toHaveLength(0);
    });
  });
});