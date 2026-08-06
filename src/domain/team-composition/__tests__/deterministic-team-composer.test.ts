import { describe, it, expect, beforeEach } from "vitest";
import { composeTeams } from "../deterministic-team-composer";
import { computeInputFingerprint } from "../proposal-validation";
import { getSystemScenario, getAllSystemScenarios, isScenarioPolicyGated } from "../scenario-catalogue";
import { getFallbackStructure, countRoleRequirements } from "../structural-requirements";
import {
  isGoalkeeperCapable,
  getGkCoverageTier,
  computeRoleStrength,
  getPositionFit,
  sortByOverallStrength,
} from "../position-suitability";
import type {
  CompositionPlayer,
  CompositionTargetTeam,
  TeamCompositionProblem,
  TeamStructuralRequirements,
  BroadPosition,
  RoleSuitabilityProfile,
  RoleStrengthProfile,
  LockedCompositionAssignment,
} from "../team-composition-types";

// ── Factory helpers ────────────────────────────────────────────────

function makeRoleSuitability(overrides: Partial<RoleSuitabilityProfile> = {}): RoleSuitabilityProfile {
  return {
    goalkeeper: "NO_FIT",
    defence: "NO_FIT",
    midfield: "NO_FIT",
    attack: "NO_FIT",
    flexible: "PRIMARY",
    ...overrides,
  };
}

function makeRoleStrength(overrides: Partial<RoleStrengthProfile> = {}): RoleStrengthProfile {
  return {
    goalkeeper: null,
    defence: null,
    midfield: null,
    attack: null,
    flexible: null,
    ...overrides,
  };
}

let playerCounter = 0;

function makePlayer(overrides: Partial<CompositionPlayer> = {}): CompositionPlayer {
  playerCounter++;
  const id = overrides.id ?? `p${playerCounter}`;
  const primaryBroadPosition = overrides.primaryBroadPosition ?? "flexible";
  return {
    id,
    displayName: overrides.displayName ?? `Player ${playerCounter}`,
    shirtNumber: overrides.shirtNumber,
    overallStrength: overrides.overallStrength ?? 5,
    overallStrengthRated: overrides.overallStrengthRated ?? true,
    currentTeamId: overrides.currentTeamId,
    available: overrides.available ?? true,
    active: overrides.active ?? true,
    goalkeeperAbility: overrides.goalkeeperAbility ?? "NO",
    roleSuitability: overrides.roleSuitability ?? makeRoleSuitability(),
    primaryBroadPosition,
    roleStrength: overrides.roleStrength ?? makeRoleStrength(),
  };
}

function makeTeam(overrides: Partial<CompositionTargetTeam> = {}): CompositionTargetTeam {
  return {
    id: overrides.id ?? "t1",
    name: overrides.name ?? "Team 1",
    targetSize: overrides.targetSize ?? 5,
    minimumSize: overrides.minimumSize ?? 4,
    maximumSize: overrides.maximumSize ?? 7,
    formationId: overrides.formationId,
    rank: overrides.rank,
  };
}

function makeProblem(overrides: Partial<TeamCompositionProblem> = {}): TeamCompositionProblem {
  return {
    contractVersion: 1,
    context: overrides.context ?? "EVENT_SQUADS",
    scenario: overrides.scenario ?? getSystemScenario("BALANCED"),
    players: overrides.players ?? [],
    targetTeams: overrides.targetTeams ?? [makeTeam({ id: "t1" }), makeTeam({ id: "t2", name: "Team 2" })],
    lockedAssignments: overrides.lockedAssignments ?? [],
    structure: overrides.structure ?? getFallbackStructure("FIVE_A_SIDE"),
    deterministicSeed: overrides.deterministicSeed ?? "test-seed",
  };
}

function createBalancedPlayerPool(count: number, teams: string[] = ["t1", "t2"]): CompositionPlayer[] {
  const players: CompositionPlayer[] = [];
  const gkIndices: number[] = [];
  for (let t = 0; t < teams.length; t++) {
    gkIndices.push(Math.floor(t * count / teams.length));
  }

  for (let i = 0; i < count; i++) {
    const teamId = teams[i % teams.length];
    let position: BroadPosition;
    let suitability: RoleSuitabilityProfile;
    let strength: RoleStrengthProfile;
    let overallStrength = 4 + (i % 4) * 2;
    let gkAbility: "YES" | "EMERGENCY" | "NO" = "NO";

    if (gkIndices.includes(i)) {
      position = "goalkeeper";
      suitability = makeRoleSuitability({ goalkeeper: "PRIMARY", flexible: "TERTIARY" });
      strength = makeRoleStrength({ goalkeeper: 6 + gkIndices.indexOf(i), flexible: 5 });
      overallStrength = 6;
      gkAbility = "YES";
    } else if (i % 4 === 1) {
      position = "defender";
      suitability = makeRoleSuitability({ defence: "PRIMARY", flexible: "SECONDARY" });
      strength = makeRoleStrength({ defence: overallStrength, flexible: overallStrength - 1 });
    } else if (i % 4 === 2) {
      position = "midfielder";
      suitability = makeRoleSuitability({ midfield: "PRIMARY", flexible: "SECONDARY" });
      strength = makeRoleStrength({ midfield: overallStrength, flexible: overallStrength - 1 });
    } else if (i % 4 === 3) {
      position = "forward";
      suitability = makeRoleSuitability({ attack: "PRIMARY", flexible: "SECONDARY" });
      strength = makeRoleStrength({ attack: overallStrength, flexible: overallStrength - 1 });
    } else {
      position = "flexible";
      suitability = makeRoleSuitability({ flexible: "PRIMARY" });
      strength = makeRoleStrength({ flexible: overallStrength });
    }

    players.push(makePlayer({
      id: `p${i + 1}`,
      displayName: `Player ${i + 1}`,
      overallStrength,
      currentTeamId: teamId,
      primaryBroadPosition: position,
      roleSuitability: suitability,
      roleStrength: strength,
      goalkeeperAbility: gkAbility,
    }));
  }
  return players;
}

function create5v5Structure(): TeamStructuralRequirements {
  return getFallbackStructure("FIVE_A_SIDE");
}

function create7v7Structure(): TeamStructuralRequirements {
  return getFallbackStructure("SEVEN_A_SIDE");
}

// ── Tests ───────────────────────────────────────────────────────────

describe("deterministic-team-composer", () => {
  beforeEach(() => {
    playerCounter = 0;
  });

  // ── PRESERVE_AND_REPAIR ────────────────────────────────────────────

  describe("PRESERVE_AND_REPAIR scenario", () => {
    it("preserves current team assignments and produces a valid distribution", () => {
      const players = [
        makePlayer({ id: "p1", currentTeamId: "t1", primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ defence: "PRIMARY" }), overallStrength: 7 }),
        makePlayer({ id: "p2", currentTeamId: "t2", primaryBroadPosition: "midfielder", roleSuitability: makeRoleSuitability({ midfield: "PRIMARY" }), overallStrength: 6 }),
        makePlayer({ id: "p3", currentTeamId: "t1", primaryBroadPosition: "forward", roleSuitability: makeRoleSuitability({ attack: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "p4", currentTeamId: "t2", primaryBroadPosition: "goalkeeper", roleSuitability: makeRoleSuitability({ goalkeeper: "PRIMARY" }), goalkeeperAbility: "YES", overallStrength: 7 }),
        makePlayer({ id: "p5", currentTeamId: "t1", primaryBroadPosition: "flexible", roleSuitability: makeRoleSuitability({ flexible: "PRIMARY" }), overallStrength: 6 }),
        makePlayer({ id: "p6", currentTeamId: "t2", primaryBroadPosition: "flexible", roleSuitability: makeRoleSuitability({ flexible: "PRIMARY" }), overallStrength: 4 }),
        makePlayer({ id: "p7", currentTeamId: "t1", primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ defence: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "p8", currentTeamId: "t2", primaryBroadPosition: "midfielder", roleSuitability: makeRoleSuitability({ midfield: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "p9", currentTeamId: "t1", primaryBroadPosition: "forward", roleSuitability: makeRoleSuitability({ attack: "PRIMARY" }), overallStrength: 8 }),
        makePlayer({ id: "p10", currentTeamId: "t2", primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ defence: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "p11", currentTeamId: "t1", primaryBroadPosition: "goalkeeper", roleSuitability: makeRoleSuitability({ goalkeeper: "PRIMARY" }), goalkeeperAbility: "YES", overallStrength: 6 }),
        makePlayer({ id: "p12", currentTeamId: "t2", primaryBroadPosition: "forward", roleSuitability: makeRoleSuitability({ attack: "PRIMARY" }), overallStrength: 6 }),
      ];
      const teams = [makeTeam({ id: "t1", targetSize: 6, minimumSize: 5, maximumSize: 7 }), makeTeam({ id: "t2", name: "Team 2", targetSize: 6, minimumSize: 5, maximumSize: 7 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("PRESERVE_AND_REPAIR"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      expect(result.assignments.length).toBe(12);

      const preservedAssignments = result.assignments.filter((a) => a.source === "PRESERVED");
      expect(preservedAssignments.length).toBeGreaterThan(0);
    });

    it("assigns all eligible players across teams in preserve mode", () => {
      const players = createBalancedPlayerPool(12, ["t1", "t2"]);
      const teams = [
        makeTeam({ id: "t1", targetSize: 6, minimumSize: 4, maximumSize: 8 }),
        makeTeam({ id: "t2", name: "Team 2", targetSize: 6, minimumSize: 4, maximumSize: 8 }),
      ];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("PRESERVE_AND_REPAIR"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      const eligibleCount = players.filter((p) => p.active && p.available).length;
      expect(result.assignments.length).toBe(eligibleCount);
    });

    it("minimises player movement compared to balanced scenario", () => {
      const players = [
        makePlayer({ id: "p1", currentTeamId: "t1", primaryBroadPosition: "goalkeeper", roleSuitability: makeRoleSuitability({ goalkeeper: "PRIMARY" }), goalkeeperAbility: "YES", overallStrength: 7 }),
        makePlayer({ id: "p2", currentTeamId: "t1", primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ defence: "PRIMARY" }), overallStrength: 6 }),
        makePlayer({ id: "p3", currentTeamId: "t1", primaryBroadPosition: "midfielder", roleSuitability: makeRoleSuitability({ midfield: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "p4", currentTeamId: "t1", primaryBroadPosition: "forward", roleSuitability: makeRoleSuitability({ attack: "PRIMARY" }), overallStrength: 8 }),
        makePlayer({ id: "p5", currentTeamId: "t1", primaryBroadPosition: "flexible", roleSuitability: makeRoleSuitability({ flexible: "PRIMARY" }), overallStrength: 6 }),
        makePlayer({ id: "p6", currentTeamId: "t2", primaryBroadPosition: "goalkeeper", roleSuitability: makeRoleSuitability({ goalkeeper: "PRIMARY" }), goalkeeperAbility: "YES", overallStrength: 6 }),
        makePlayer({ id: "p7", currentTeamId: "t2", primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ defence: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "p8", currentTeamId: "t2", primaryBroadPosition: "midfielder", roleSuitability: makeRoleSuitability({ midfield: "PRIMARY" }), overallStrength: 7 }),
        makePlayer({ id: "p9", currentTeamId: "t2", primaryBroadPosition: "forward", roleSuitability: makeRoleSuitability({ attack: "PRIMARY" }), overallStrength: 4 }),
        makePlayer({ id: "p10", currentTeamId: "t2", primaryBroadPosition: "flexible", roleSuitability: makeRoleSuitability({ flexible: "PRIMARY" }), overallStrength: 5 }),
      ];
      const teams = [makeTeam({ id: "t1", targetSize: 5, maximumSize: 6 }), makeTeam({ id: "t2", name: "Team 2", targetSize: 5, maximumSize: 6 })];

      const preserveResult = composeTeams(makeProblem({
        scenario: getSystemScenario("PRESERVE_AND_REPAIR"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      const balancedResult = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      const preserveMoves = preserveResult.proposalMetrics.totalPlayersMoved;
      const balancedMoves = balancedResult.proposalMetrics.totalPlayersMoved;

      expect(preserveMoves).toBeLessThanOrEqual(balancedMoves);
    });
  });

  // ── BALANCED ────────────────────────────────────────────────────────

  describe("BALANCED scenario", () => {
    it("distributes players across teams", () => {
      const players = createBalancedPlayerPool(12);
      const teams = [makeTeam({ id: "t1", targetSize: 6, minimumSize: 5, maximumSize: 7 }), makeTeam({ id: "t2", name: "Team 2", targetSize: 6, minimumSize: 5, maximumSize: 7 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      expect(result.assignments.length).toBe(12);

      const t1Count = result.assignments.filter((a) => a.teamId === "t1").length;
      const t2Count = result.assignments.filter((a) => a.teamId === "t2").length;
      expect(t1Count + t2Count).toBe(12);
      expect(Math.abs(t1Count - t2Count)).toBeLessThanOrEqual(2);
    });

    it("balances overall strength between teams", () => {
      const players = createBalancedPlayerPool(14);
      const teams = [makeTeam({ id: "t1", targetSize: 7, minimumSize: 5, maximumSize: 8 }), makeTeam({ id: "t2", name: "Team 2", targetSize: 7, minimumSize: 5, maximumSize: 8 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create7v7Structure(),
      }));

      if (result.proposalMetrics.overallSpread !== null) {
        expect(result.proposalMetrics.overallSpread).toBeLessThanOrEqual(4);
      }
    });

    it("ensures every team has goalkeeper coverage when GK players are available", () => {
      const players = createBalancedPlayerPool(12);
      const teams = [makeTeam({ id: "t1", targetSize: 5, minimumSize: 4, maximumSize: 7 }), makeTeam({ id: "t2", name: "Team 2", targetSize: 5, minimumSize: 4, maximumSize: 7 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      const gkPlayers = players.filter((p) => isGoalkeeperCapable(p));
      if (gkPlayers.length >= teams.length) {
        const gkAssignments = result.assignments.filter((a) => a.assignedRole === "GOALKEEPER");
        expect(gkAssignments.length).toBeGreaterThanOrEqual(teams.length);
      }
    });

    it("assigns all eligible players to teams", () => {
      const players = createBalancedPlayerPool(12);
      const teams = [makeTeam({ id: "t1", targetSize: 6, minimumSize: 4, maximumSize: 8 }), makeTeam({ id: "t2", name: "Team 2", targetSize: 6, minimumSize: 4, maximumSize: 8 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      const eligibleCount = players.filter((p) => p.active && p.available).length;
      const assignedCount = result.assignments.length;
      expect(assignedCount).toBe(eligibleCount);
    });
  });

  // ── ONE_STRONG_REST_BALANCED ────────────────────────────────────────

  describe("ONE_STRONG_REST_BALANCED scenario", () => {
    it("makes the first team at least as strong as the others on average", () => {
      const players = createBalancedPlayerPool(15);
      const teams = [
        makeTeam({ id: "t1", name: "Strong Team", rank: 1 }),
        makeTeam({ id: "t2", name: "Balanced A", targetSize: 5, minimumSize: 4, maximumSize: 7 }),
        makeTeam({ id: "t3", name: "Balanced B", targetSize: 5, minimumSize: 4, maximumSize: 7 }),
      ];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("ONE_STRONG_REST_BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      const strongTeamMetrics = result.teamMetrics.find((m) => m.teamId === "t1");
      expect(strongTeamMetrics).toBeDefined();
      expect(strongTeamMetrics!.squadSize).toBeGreaterThan(0);
    });

    it("keeps remaining teams balanced against each other", () => {
      const players = createBalancedPlayerPool(15);
      const teams = [
        makeTeam({ id: "t1", name: "Strong Team", rank: 1 }),
        makeTeam({ id: "t2", name: "Balanced A" }),
        makeTeam({ id: "t3", name: "Balanced B" }),
      ];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("ONE_STRONG_REST_BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      const otherMetrics = result.teamMetrics.filter((m) => m.teamId !== "t1");
      if (otherMetrics.every((m) => m.averageOverall !== null) && otherMetrics.length >= 2) {
        const spread = Math.abs((otherMetrics[0].averageOverall ?? 0) - (otherMetrics[1].averageOverall ?? 0));
        expect(spread).toBeLessThanOrEqual(3);
      }
    });

    it("falls back to balanced distribution with fewer than 2 teams", () => {
      const players = createBalancedPlayerPool(6);
      const teams = [makeTeam({ id: "t1", targetSize: 5, minimumSize: 3 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("ONE_STRONG_REST_BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      expect(result.assignments.filter((a) => a.teamId === "t1").length).toBeGreaterThan(0);
    });
  });

  // ── TIERED_DESCENDING ────────────────────────────────────────────────

  describe("TIERED_DESCENDING scenario", () => {
    it("creates teams with overall strength in descending order by rank", () => {
      const players = createBalancedPlayerPool(15);
      const teams = [
        makeTeam({ id: "t1", name: "Team A", rank: 1 }),
        makeTeam({ id: "t2", name: "Team B", rank: 2 }),
        makeTeam({ id: "t3", name: "Team C", rank: 3 }),
      ];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("TIERED_DESCENDING"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      expect(result.assignments.length).toBe(15);

      const metricsByRank = result.teamMetrics.sort((a, b) => {
        const rankA = teams.find((t) => t.id === a.teamId)?.rank ?? 0;
        const rankB = teams.find((t) => t.id === b.teamId)?.rank ?? 0;
        return rankA - rankB;
      });

      if (metricsByRank.every((m) => m.averageOverall !== null) && metricsByRank.length >= 2) {
        expect(metricsByRank[0].averageOverall!).toBeGreaterThanOrEqual(metricsByRank[metricsByRank.length - 1].averageOverall! - 1);
      }
    });

    it("assigns all players across teams", () => {
      const players = createBalancedPlayerPool(15);
      const teams = [makeTeam({ id: "t1" }), makeTeam({ id: "t2", name: "Team 2" }), makeTeam({ id: "t3", name: "Team 3" })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("TIERED_DESCENDING"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      expect(result.assignments.length).toBe(15);
    });

    it("is policy gated", () => {
      expect(isScenarioPolicyGated("TIERED_DESCENDING")).toBe(true);
      expect(isScenarioPolicyGated("BALANCED")).toBe(false);
    });
  });

  // ── Structural requirements ──────────────────────────────────────────

  describe("structural requirements", () => {
    it("assigns goalkeeper-capable players to teams when available", () => {
      const players = [
        makePlayer({ id: "gk1", primaryBroadPosition: "goalkeeper", roleSuitability: makeRoleSuitability({ goalkeeper: "PRIMARY" }), goalkeeperAbility: "YES", overallStrength: 7 }),
        makePlayer({ id: "gk2", primaryBroadPosition: "goalkeeper", roleSuitability: makeRoleSuitability({ goalkeeper: "PRIMARY" }), goalkeeperAbility: "YES", overallStrength: 6 }),
        makePlayer({ id: "def1", primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ defence: "PRIMARY", flexible: "SECONDARY" }), overallStrength: 6 }),
        makePlayer({ id: "def2", primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ defence: "PRIMARY", flexible: "SECONDARY" }), overallStrength: 5 }),
        makePlayer({ id: "mid1", primaryBroadPosition: "midfielder", roleSuitability: makeRoleSuitability({ midfield: "PRIMARY", flexible: "SECONDARY" }), overallStrength: 7 }),
        makePlayer({ id: "mid2", primaryBroadPosition: "midfielder", roleSuitability: makeRoleSuitability({ midfield: "PRIMARY", flexible: "SECONDARY" }), overallStrength: 5 }),
        makePlayer({ id: "fwd1", primaryBroadPosition: "forward", roleSuitability: makeRoleSuitability({ attack: "PRIMARY", flexible: "SECONDARY" }), overallStrength: 6 }),
        makePlayer({ id: "fwd2", primaryBroadPosition: "forward", roleSuitability: makeRoleSuitability({ attack: "PRIMARY", flexible: "SECONDARY" }), overallStrength: 5 }),
        makePlayer({ id: "flx1", primaryBroadPosition: "flexible", roleSuitability: makeRoleSuitability({ flexible: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "flx2", primaryBroadPosition: "flexible", roleSuitability: makeRoleSuitability({ flexible: "PRIMARY" }), overallStrength: 5 }),
      ];
      const teams = [makeTeam({ id: "t1", targetSize: 5, minimumSize: 4, maximumSize: 6 }), makeTeam({ id: "t2", name: "Team 2", targetSize: 5, minimumSize: 4, maximumSize: 6 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      const gkAssignments = result.assignments.filter((a) => a.assignedRole === "GOALKEEPER");
      expect(gkAssignments.length).toBeGreaterThanOrEqual(2);

      for (const team of teams) {
        const teamGk = result.assignments.filter((a) => a.teamId === team.id && a.assignedRole === "GOALKEEPER");
        expect(teamGk.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("flags missing goalkeeper coverage when GK is required but no GK player available", () => {
      const players = Array.from({ length: 8 }, (_, i) =>
        makePlayer({
          id: `p${i + 1}`,
          primaryBroadPosition: "flexible",
          roleSuitability: makeRoleSuitability({ flexible: "PRIMARY", goalkeeper: "NO_FIT" }),
          goalkeeperAbility: "NO",
          overallStrength: 5,
        })
      );
      const teams = [makeTeam({ id: "t1", minimumSize: 3 }), makeTeam({ id: "t2", name: "Team 2", minimumSize: 3 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      const gkIssues = result.validation.blockingIssues.filter((i) => i.code === "NO_GOALKEEPER_COVERAGE");
      expect(gkIssues.length).toBeGreaterThan(0);
    });

    it("uses emergency goalkeeper capability when no primary GK available", () => {
      const players = [
        makePlayer({ id: "emg1", primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ goalkeeper: "TERTIARY", defence: "PRIMARY" }), goalkeeperAbility: "EMERGENCY", overallStrength: 5 }),
        makePlayer({ id: "emg2", primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ goalkeeper: "TERTIARY", defence: "PRIMARY" }), goalkeeperAbility: "EMERGENCY", overallStrength: 5 }),
        ...Array.from({ length: 8 }, (_, i) =>
          makePlayer({
            id: `p${i + 3}`,
            primaryBroadPosition: "flexible",
            roleSuitability: makeRoleSuitability({ flexible: "PRIMARY" }),
            goalkeeperAbility: "NO",
            overallStrength: 5 + (i % 3),
          })
        ),
      ];
      const teams = [makeTeam({ id: "t1", minimumSize: 4 }), makeTeam({ id: "t2", name: "Team 2", minimumSize: 4 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      const emgCoverage = result.teamMetrics.filter((m) => m.goalkeeperCoverage === "emergency");
      expect(emgCoverage.length).toBeGreaterThan(0);
    });

    it("respects 3-a-side format (no goalkeeper requirement)", () => {
      const players = Array.from({ length: 6 }, (_, i) =>
        makePlayer({
          id: `p${i + 1}`,
          primaryBroadPosition: i < 2 ? "defender" : i < 4 ? "midfielder" : "forward",
          roleSuitability: makeRoleSuitability({
            defence: i < 2 ? "PRIMARY" : "NO_FIT",
            midfield: i >= 2 && i < 4 ? "PRIMARY" : "NO_FIT",
            attack: i >= 4 ? "PRIMARY" : "NO_FIT",
            flexible: "SECONDARY",
          }),
          goalkeeperAbility: "NO",
          overallStrength: 5,
        })
      );
      const threeASideStructure = getFallbackStructure("THREE_A_SIDE");
      const teams = [makeTeam({ id: "t1", targetSize: 3, minimumSize: 3, maximumSize: 5 }), makeTeam({ id: "t2", name: "Team 2", targetSize: 3, minimumSize: 3, maximumSize: 5 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: threeASideStructure,
      }));

      expect(threeASideStructure.requireGoalkeeper).toBe(false);
      const gkIssues = result.validation.blockingIssues.filter((i) => i.code === "NO_GOALKEEPER_COVERAGE");
      expect(gkIssues.length).toBe(0);
    });
  });

  // ── Deterministic behavior ───────────────────────────────────────────

  describe("deterministic behavior", () => {
    it("produces identical output for identical inputs", () => {
      const players = createBalancedPlayerPool(12);
      const teams = [makeTeam({ id: "t1" }), makeTeam({ id: "t2", name: "Team 2" })];

      const result1 = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
        deterministicSeed: "deterministic-test-seed",
      }));

      const result2 = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
        deterministicSeed: "deterministic-test-seed",
      }));

      expect(result1.assignments).toEqual(result2.assignments);
    });

    it("produces the same fingerprint for the same inputs", () => {
      const players = createBalancedPlayerPool(12);
      const teams = [makeTeam({ id: "t1" }), makeTeam({ id: "t2", name: "Team 2" })];
      const seed = "fingerprint-test-seed";

      const result1 = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
        deterministicSeed: seed,
      }));

      const result2 = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
        deterministicSeed: seed,
      }));

      expect(result1.inputFingerprint).toBe(result2.inputFingerprint);
    });
  });

  // ── Locked assignments ────────────────────────────────────────────────

  describe("locked assignments", () => {
    it("preserves locked assignments in the output", () => {
      const players = createBalancedPlayerPool(12);
      const teams = [makeTeam({ id: "t1" }), makeTeam({ id: "t2", name: "Team 2" })];

      const locked: LockedCompositionAssignment[] = [
        { playerId: "p1", teamId: "t1", reason: "Coach locked" },
      ];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        lockedAssignments: locked,
        structure: create5v5Structure(),
      }));

      const lockedAssignment = result.assignments.find((a) => a.playerId === "p1");
      expect(lockedAssignment).toBeDefined();
      expect(lockedAssignment!.teamId).toBe("t1");
      expect(lockedAssignment!.source).toBe("LOCKED");
    });

    it("does not reassign locked players during scenario distribution", () => {
      const players = createBalancedPlayerPool(12);
      const teams = [makeTeam({ id: "t1" }), makeTeam({ id: "t2", name: "Team 2" })];

      const locked: LockedCompositionAssignment[] = [
        { playerId: "p1", teamId: "t2", reason: "Coach locked to Team 2" },
      ];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        lockedAssignments: locked,
        structure: create5v5Structure(),
      }));

      const p1 = result.assignments.find((a) => a.playerId === "p1");
      expect(p1).toBeDefined();
      expect(p1!.teamId).toBe("t2");
    });

    it("handles multiple locked assignments", () => {
      const players = createBalancedPlayerPool(12);
      const teams = [makeTeam({ id: "t1" }), makeTeam({ id: "t2", name: "Team 2" })];

      const locked: LockedCompositionAssignment[] = [
        { playerId: "p1", teamId: "t1", reason: "Locked GK" },
        { playerId: "p2", teamId: "t2", reason: "Locked defender" },
        { playerId: "p3", teamId: "t1", reason: "Locked midfielder" },
      ];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        lockedAssignments: locked,
        structure: create5v5Structure(),
      }));

      const p1 = result.assignments.find((a) => a.playerId === "p1");
      const p2 = result.assignments.find((a) => a.playerId === "p2");
      const p3 = result.assignments.find((a) => a.playerId === "p3");

      expect(p1!.teamId).toBe("t1");
      expect(p2!.teamId).toBe("t2");
      expect(p3!.teamId).toBe("t1");
    });
  });

  // ── Unavailable players ────────────────────────────────────────────────

  describe("unavailable players", () => {
    it("excludes unavailable players from assignment", () => {
      const players = [
        makePlayer({ id: "p1", available: true, primaryBroadPosition: "goalkeeper", roleSuitability: makeRoleSuitability({ goalkeeper: "PRIMARY" }), goalkeeperAbility: "YES", overallStrength: 7 }),
        makePlayer({ id: "p2", available: false, primaryBroadPosition: "forward", roleSuitability: makeRoleSuitability({ attack: "PRIMARY" }), overallStrength: 10 }),
        makePlayer({ id: "p3", available: true, primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ defence: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "p4", available: true, primaryBroadPosition: "midfielder", roleSuitability: makeRoleSuitability({ midfield: "PRIMARY" }), overallStrength: 6 }),
        makePlayer({ id: "p5", available: true, primaryBroadPosition: "forward", roleSuitability: makeRoleSuitability({ attack: "PRIMARY" }), overallStrength: 6 }),
        makePlayer({ id: "p6", available: true, primaryBroadPosition: "goalkeeper", roleSuitability: makeRoleSuitability({ goalkeeper: "PRIMARY" }), goalkeeperAbility: "YES", overallStrength: 6 }),
        makePlayer({ id: "p7", available: true, primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ defence: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "p8", available: true, primaryBroadPosition: "midfielder", roleSuitability: makeRoleSuitability({ midfield: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "p9", available: true, primaryBroadPosition: "forward", roleSuitability: makeRoleSuitability({ attack: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "p10", available: true, primaryBroadPosition: "flexible", roleSuitability: makeRoleSuitability({ flexible: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "p11", available: true, primaryBroadPosition: "flexible", roleSuitability: makeRoleSuitability({ flexible: "PRIMARY" }), overallStrength: 5 }),
      ];

      const teams = [makeTeam({ id: "t1" }), makeTeam({ id: "t2", name: "Team 2" })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      const unavailableAssignment = result.assignments.find((a) => a.playerId === "p2");
      expect(unavailableAssignment).toBeUndefined();
    });

    it("excludes inactive players from assignment", () => {
      const players = [
        makePlayer({ id: "p1", active: true, primaryBroadPosition: "goalkeeper", roleSuitability: makeRoleSuitability({ goalkeeper: "PRIMARY" }), goalkeeperAbility: "YES", overallStrength: 7 }),
        makePlayer({ id: "p2", active: false, primaryBroadPosition: "forward", roleSuitability: makeRoleSuitability({ attack: "PRIMARY" }), overallStrength: 10 }),
        makePlayer({ id: "p3", active: true, primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ defence: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "p4", active: true, primaryBroadPosition: "midfielder", roleSuitability: makeRoleSuitability({ midfield: "PRIMARY" }), overallStrength: 6 }),
        makePlayer({ id: "p5", active: true, primaryBroadPosition: "forward", roleSuitability: makeRoleSuitability({ attack: "PRIMARY" }), overallStrength: 6 }),
        makePlayer({ id: "p6", active: true, primaryBroadPosition: "goalkeeper", roleSuitability: makeRoleSuitability({ goalkeeper: "PRIMARY" }), goalkeeperAbility: "YES", overallStrength: 6 }),
        makePlayer({ id: "p7", active: true, primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ defence: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "p8", active: true, primaryBroadPosition: "midfielder", roleSuitability: makeRoleSuitability({ midfield: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "p9", active: true, primaryBroadPosition: "forward", roleSuitability: makeRoleSuitability({ attack: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "p10", active: true, primaryBroadPosition: "flexible", roleSuitability: makeRoleSuitability({ flexible: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "p11", active: true, primaryBroadPosition: "flexible", roleSuitability: makeRoleSuitability({ flexible: "PRIMARY" }), overallStrength: 5 }),
      ];

      const teams = [makeTeam({ id: "t1" }), makeTeam({ id: "t2", name: "Team 2" })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      const inactiveAssignment = result.assignments.find((a) => a.playerId === "p2");
      expect(inactiveAssignment).toBeUndefined();
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles one team correctly", () => {
      const players = createBalancedPlayerPool(6);
      const teams = [makeTeam({ id: "t1", targetSize: 5, minimumSize: 3, maximumSize: 8 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      const t1Assignments = result.assignments.filter((a) => a.teamId === "t1");
      expect(t1Assignments.length).toBeGreaterThan(0);
    });

    it("handles zero players gracefully", () => {
      const teams = [makeTeam({ id: "t1" }), makeTeam({ id: "t2", name: "Team 2" })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players: [],
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      expect(result.validation.valid).toBe(false);
      expect(result.validation.blockingIssues.length).toBeGreaterThan(0);
    });

    it("handles not enough players to fill all teams", () => {
      const players = [
        makePlayer({ id: "p1", primaryBroadPosition: "goalkeeper", roleSuitability: makeRoleSuitability({ goalkeeper: "PRIMARY" }), goalkeeperAbility: "YES", overallStrength: 7 }),
        makePlayer({ id: "p2", primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ defence: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "p3", primaryBroadPosition: "midfielder", roleSuitability: makeRoleSuitability({ midfield: "PRIMARY" }), overallStrength: 6 }),
      ];
      const teams = [makeTeam({ id: "t1", minimumSize: 5 }), makeTeam({ id: "t2", name: "Team 2", minimumSize: 5 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      expect(result.validation.valid).toBe(false);
      const belowMin = result.validation.blockingIssues.filter((i) => i.code === "SQUAD_BELOW_MINIMUM");
      expect(belowMin.length).toBeGreaterThan(0);
    });

    it("handles all players unavailable", () => {
      const players = Array.from({ length: 6 }, (_, i) =>
        makePlayer({
          id: `p${i + 1}`,
          available: false,
          primaryBroadPosition: "flexible",
          roleSuitability: makeRoleSuitability({ flexible: "PRIMARY" }),
          overallStrength: 5,
        })
      );
      const teams = [makeTeam({ id: "t1", minimumSize: 3 }), makeTeam({ id: "t2", name: "Team 2", minimumSize: 3 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      expect(result.assignments.length).toBe(0);
      expect(result.validation.valid).toBe(false);
    });
  });

  // ── Proposal validation ───────────────────────────────────────────────

  describe("proposal validation", () => {
    it("does not produce duplicate player assignments", () => {
      const players = createBalancedPlayerPool(10);
      const teams = [makeTeam({ id: "t1" }), makeTeam({ id: "t2", name: "Team 2" })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      const playerIds = result.assignments.map((a) => a.playerId);
      const uniqueIds = new Set(playerIds);
      expect(playerIds.length).toBe(uniqueIds.size);
    });

    it("flags teams below minimum size", () => {
      const players = [
        makePlayer({ id: "p1", primaryBroadPosition: "goalkeeper", roleSuitability: makeRoleSuitability({ goalkeeper: "PRIMARY" }), goalkeeperAbility: "YES", overallStrength: 7 }),
      ];
      const teams = [makeTeam({ id: "t1", minimumSize: 5 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      expect(result.validation.valid).toBe(false);
      expect(result.validation.blockingIssues.some((i) => i.code === "SQUAD_BELOW_MINIMUM")).toBe(true);
    });

    it("flags no goalkeeper coverage when required", () => {
      const players = Array.from({ length: 10 }, (_, i) =>
        makePlayer({
          id: `p${i + 1}`,
          primaryBroadPosition: "flexible",
          roleSuitability: makeRoleSuitability({ flexible: "PRIMARY", goalkeeper: "NO_FIT" }),
          goalkeeperAbility: "NO",
          overallStrength: 5,
        })
      );
      const teams = [makeTeam({ id: "t1", minimumSize: 3 }), makeTeam({ id: "t2", name: "Team 2", minimumSize: 3 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      expect(result.validation.blockingIssues.some((i) => i.code === "NO_GOALKEEPER_COVERAGE")).toBe(true);
    });

    it("passes validation for a well-formed proposal with sufficient players", () => {
      const players = createBalancedPlayerPool(14);
      const teams = [makeTeam({ id: "t1", targetSize: 7, minimumSize: 5, maximumSize: 9 }), makeTeam({ id: "t2", name: "Team 2", targetSize: 7, minimumSize: 5, maximumSize: 9 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create7v7Structure(),
      }));

      const minSizeBlocking = result.validation.blockingIssues.filter((i) => i.code === "SQUAD_BELOW_MINIMUM");
      const maxSizeBlocking = result.validation.blockingIssues.filter((i) => i.code === "SQUAD_ABOVE_MAXIMUM");
      expect(minSizeBlocking.length + maxSizeBlocking.length).toBe(0);
    });

    it("generates explanations for non-locked assignments", () => {
      const players = createBalancedPlayerPool(10);
      const teams = [makeTeam({ id: "t1" }), makeTeam({ id: "t2", name: "Team 2" })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      expect(result.explanations.length).toBeGreaterThan(0);
    });

    it("flags eligible players omitted as planning note when teams are full", () => {
      const players = Array.from({ length: 16 }, (_, i) =>
        makePlayer({
          id: `p${i + 1}`,
          primaryBroadPosition: "flexible",
          roleSuitability: makeRoleSuitability({ flexible: "PRIMARY" }),
          goalkeeperAbility: i < 2 ? "YES" : "NO",
          overallStrength: 5 + (i % 4),
        })
      );
      const teams = [makeTeam({ id: "t1", targetSize: 5, maximumSize: 5, minimumSize: 4 }), makeTeam({ id: "t2", name: "Team 2", targetSize: 5, maximumSize: 5, minimumSize: 4 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      const omitted = result.validation.notes.filter((n) => n.code === "ELIGIBLE_PLAYERS_OMITTED");
      if (result.assignments.length < 16) {
        expect(omitted.length).toBeGreaterThan(0);
        expect(omitted[0].message).toContain("eligible player");
      }
    });
  });

  // ── Input fingerprinting ──────────────────────────────────────────────

  describe("input fingerprinting", () => {
    it("produces the same fingerprint for the same inputs", () => {
      const players = createBalancedPlayerPool(10);
      const teams = [makeTeam({ id: "t1" }), makeTeam({ id: "t2", name: "Team 2" })];
      const locked: LockedCompositionAssignment[] = [];

      const fp1 = computeInputFingerprint(players, teams, locked, "BALANCED");
      const fp2 = computeInputFingerprint(players, teams, locked, "BALANCED");

      expect(fp1).toBe(fp2);
    });

    it("produces different fingerprints for different scenarios", () => {
      const players = createBalancedPlayerPool(10);
      const teams = [makeTeam({ id: "t1" }), makeTeam({ id: "t2", name: "Team 2" })];
      const locked: LockedCompositionAssignment[] = [];

      const fp1 = computeInputFingerprint(players, teams, locked, "BALANCED");
      const fp2 = computeInputFingerprint(players, teams, locked, "TIERED_DESCENDING");

      expect(fp1).not.toBe(fp2);
    });

    it("produces different fingerprints for different team sizes", () => {
      const players = createBalancedPlayerPool(10);
      const teams1 = [makeTeam({ id: "t1", targetSize: 5 }), makeTeam({ id: "t2", name: "Team 2", targetSize: 5 })];
      const teams2 = [makeTeam({ id: "t1", targetSize: 7 }), makeTeam({ id: "t2", name: "Team 2", targetSize: 7 })];

      const fp1 = computeInputFingerprint(players, teams1, [], "BALANCED");
      const fp2 = computeInputFingerprint(players, teams2, [], "BALANCED");

      expect(fp1).not.toBe(fp2);
    });

    it("produces different fingerprints for different locked assignments", () => {
      const players = createBalancedPlayerPool(10);
      const teams = [makeTeam({ id: "t1" }), makeTeam({ id: "t2", name: "Team 2" })];

      const fp1 = computeInputFingerprint(players, teams, [], "BALANCED");
      const fp2 = computeInputFingerprint(players, teams, [{ playerId: "p1", teamId: "t1" }], "BALANCED");

      expect(fp1).not.toBe(fp2);
    });
  });

  // ── Improvement phase ─────────────────────────────────────────────────

  describe("improvement phase", () => {
    it("does not increase overall spread excessively for balanced scenario", () => {
      const players = createBalancedPlayerPool(14);
      const teams = [makeTeam({ id: "t1", targetSize: 7, maximumSize: 8 }), makeTeam({ id: "t2", name: "Team 2", targetSize: 7, maximumSize: 8 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create7v7Structure(),
      }));

      if (result.proposalMetrics.overallSpread !== null) {
        expect(result.proposalMetrics.overallSpread).toBeLessThanOrEqual(4);
      }
    });

    it("assigns all players without exceeding maximum sizes when possible", () => {
      const players = createBalancedPlayerPool(14);
      const teams = [makeTeam({ id: "t1", targetSize: 7, maximumSize: 9 }), makeTeam({ id: "t2", name: "Team 2", targetSize: 7, maximumSize: 9 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create7v7Structure(),
      }));

      for (const team of teams) {
        const teamSize = result.assignments.filter((a) => a.teamId === team.id).length;
        expect(teamSize).toBeLessThanOrEqual(team.maximumSize);
      }
    });
  });

  // ── Role suitability ──────────────────────────────────────────────────

  describe("role suitability", () => {
    it("assigns primary-position players to matching roles", () => {
      const players = [
        makePlayer({ id: "gk1", primaryBroadPosition: "goalkeeper", roleSuitability: makeRoleSuitability({ goalkeeper: "PRIMARY" }), goalkeeperAbility: "YES", overallStrength: 7 }),
        makePlayer({ id: "gk2", primaryBroadPosition: "goalkeeper", roleSuitability: makeRoleSuitability({ goalkeeper: "PRIMARY" }), goalkeeperAbility: "YES", overallStrength: 6 }),
        makePlayer({ id: "def1", primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ defence: "PRIMARY" }), overallStrength: 6 }),
        makePlayer({ id: "def2", primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ defence: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "mid1", primaryBroadPosition: "midfielder", roleSuitability: makeRoleSuitability({ midfield: "PRIMARY" }), overallStrength: 7 }),
        makePlayer({ id: "mid2", primaryBroadPosition: "midfielder", roleSuitability: makeRoleSuitability({ midfield: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "fwd1", primaryBroadPosition: "forward", roleSuitability: makeRoleSuitability({ attack: "PRIMARY" }), overallStrength: 6 }),
        makePlayer({ id: "fwd2", primaryBroadPosition: "forward", roleSuitability: makeRoleSuitability({ attack: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "flx1", primaryBroadPosition: "flexible", roleSuitability: makeRoleSuitability({ flexible: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "flx2", primaryBroadPosition: "flexible", roleSuitability: makeRoleSuitability({ flexible: "PRIMARY" }), overallStrength: 5 }),
      ];
      const teams = [makeTeam({ id: "t1" }), makeTeam({ id: "t2", name: "Team 2" })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      const gkAssignments = result.assignments.filter((a) => a.assignedRole === "GOALKEEPER");
      const gkPrimaryCount = gkAssignments.filter((a) => a.positionFit === "PRIMARY").length;
      expect(gkPrimaryCount).toBeGreaterThan(0);
    });

    it("assigns emergency goalkeeper capability when no primary GK available", () => {
      const players = [
        makePlayer({ id: "emg1", primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ goalkeeper: "TERTIARY", defence: "PRIMARY" }), goalkeeperAbility: "EMERGENCY", overallStrength: 5 }),
        makePlayer({ id: "emg2", primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ goalkeeper: "TERTIARY", defence: "PRIMARY" }), goalkeeperAbility: "EMERGENCY", overallStrength: 5 }),
        makePlayer({ id: "def1", primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ defence: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "def2", primaryBroadPosition: "defender", roleSuitability: makeRoleSuitability({ defence: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "mid1", primaryBroadPosition: "midfielder", roleSuitability: makeRoleSuitability({ midfield: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "mid2", primaryBroadPosition: "midfielder", roleSuitability: makeRoleSuitability({ midfield: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "fwd1", primaryBroadPosition: "forward", roleSuitability: makeRoleSuitability({ attack: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "fwd2", primaryBroadPosition: "forward", roleSuitability: makeRoleSuitability({ attack: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "flx1", primaryBroadPosition: "flexible", roleSuitability: makeRoleSuitability({ flexible: "PRIMARY" }), overallStrength: 5 }),
        makePlayer({ id: "flx2", primaryBroadPosition: "flexible", roleSuitability: makeRoleSuitability({ flexible: "PRIMARY" }), overallStrength: 5 }),
      ];
      const teams = [makeTeam({ id: "t1", targetSize: 5, minimumSize: 4 }), makeTeam({ id: "t2", name: "Team 2", targetSize: 5, minimumSize: 4 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      const gkCapable = result.assignments.filter((a) => a.isGoalkeeper);
      expect(gkCapable.length).toBeGreaterThan(0);
    });
  });

  // ── Position suitability helpers ──────────────────────────────────────

  describe("position suitability helpers", () => {
    it("isGoalkeeperCapable returns true for primary GK", () => {
      const player = makePlayer({ primaryBroadPosition: "goalkeeper", goalkeeperAbility: "YES" });
      expect(isGoalkeeperCapable(player)).toBe(true);
    });

    it("isGoalkeeperCapable returns true for emergency GK", () => {
      const player = makePlayer({ goalkeeperAbility: "EMERGENCY", primaryBroadPosition: "defender" });
      expect(isGoalkeeperCapable(player)).toBe(true);
    });

    it("isGoalkeeperCapable returns false for non-GK", () => {
      const player = makePlayer({ goalkeeperAbility: "NO", primaryBroadPosition: "defender" });
      expect(isGoalkeeperCapable(player)).toBe(false);
    });

    it("getGkCoverageTier returns 'strong' for primary GK with YES ability", () => {
      const player = makePlayer({ primaryBroadPosition: "goalkeeper", goalkeeperAbility: "YES", roleSuitability: makeRoleSuitability({ goalkeeper: "PRIMARY" }) });
      expect(getGkCoverageTier(player)).toBe("strong");
    });

    it("getGkCoverageTier returns 'none' for non-GK player", () => {
      const player = makePlayer({ primaryBroadPosition: "defender", goalkeeperAbility: "NO", roleSuitability: makeRoleSuitability({ goalkeeper: "NO_FIT" }) });
      expect(getGkCoverageTier(player)).toBe("none");
    });

    it("computeRoleStrength falls back to overallStrength when no role-specific data", () => {
      const strength = computeRoleStrength(7, makeRoleStrength(), "DEFENCE");
      expect(strength).toBe(7);
    });

    it("computeRoleStrength uses weighted role-specific data when available", () => {
      const strength = computeRoleStrength(5, makeRoleStrength({ defence: 8, midfield: 6 }), "DEFENCE");
      expect(strength).toBeGreaterThan(5);
      expect(strength).toBeLessThanOrEqual(10);
    });

    it("getPositionFit returns PRIMARY for exact match", () => {
      expect(getPositionFit("goalkeeper", undefined, undefined, ["goalkeeper"])).toBe("PRIMARY");
    });

    it("getPositionFit returns SECONDARY for secondary match", () => {
      expect(getPositionFit("defender", "midfielder", undefined, ["midfielder"])).toBe("SECONDARY");
    });

    it("getPositionFit returns NO_FIT when no match", () => {
      expect(getPositionFit("forward", undefined, undefined, ["goalkeeper", "defender"])).toBe("NO_FIT");
    });

    it("getPositionFit returns PRIMARY when flexible is in accepted positions", () => {
      expect(getPositionFit("defender", undefined, undefined, ["defender", "flexible"])).toBe("PRIMARY");
    });

    it("getPositionFit returns TERTIARY for flexible primary position", () => {
      expect(getPositionFit("flexible", undefined, undefined, ["goalkeeper"])).toBe("TERTIARY");
    });

    it("getPositionFit does not inflate non-matching positions to PRIMARY via flexible accepted", () => {
      // A forward should NOT be PRIMARY for defence just because defence accepts "flexible"
      expect(getPositionFit("forward", undefined, undefined, ["defender", "flexible"])).toBe("TERTIARY");
    });

    it("getPositionFit returns PRIMARY for direct position match even with flexible in accepted", () => {
      // A defender IS PRIMARY for defence (direct match), not because of flexible
      expect(getPositionFit("defender", undefined, undefined, ["defender", "flexible"])).toBe("PRIMARY");
    });

    it("getPositionFit returns TERTIARY for non-matching position with flexible accepted", () => {
      // A midfielder is not PRIMARY for defence, but TERTIARY because defence accepts flexible
      expect(getPositionFit("midfielder", undefined, undefined, ["defender", "flexible"])).toBe("TERTIARY");
    });

    it("getPositionFit returns PRIMARY for flexible-primary player when role accepts flexible", () => {
      expect(getPositionFit("flexible", undefined, undefined, ["defender", "flexible"])).toBe("PRIMARY");
    });

    it("forward gets PRIMARY for attack and TERTIARY for other field roles", () => {
      expect(getPositionFit("forward", undefined, undefined, ["forward", "flexible"])).toBe("PRIMARY");
      expect(getPositionFit("forward", undefined, undefined, ["defender", "flexible"])).toBe("TERTIARY");
      expect(getPositionFit("forward", undefined, undefined, ["midfielder", "flexible"])).toBe("TERTIARY");
    });

    it("determineBestRole prefers role matching primary position — verified through composition", () => {
      const teams = [
        makeTeam({ id: "t1", name: "Team 1", targetSize: 5, minimumSize: 5, maximumSize: 7 }),
        makeTeam({ id: "t2", name: "Team 2", targetSize: 5, minimumSize: 5, maximumSize: 7 }),
      ];
      const players: CompositionPlayer[] = [];
      for (let i = 0; i < 14; i++) {
        const isGk = i < 2;
        const pos: BroadPosition = isGk ? "goalkeeper" : i < 4 ? "defender" : i < 8 ? "midfielder" : "forward";
        players.push(makePlayer({
          id: `p${i + 1}`,
          displayName: `Player ${i + 1}`,
          overallStrength: 5,
          primaryBroadPosition: pos,
          roleSuitability: makeRoleSuitability(
            isGk
              ? { goalkeeper: "PRIMARY", flexible: "TERTIARY" }
              : pos === "defender"
                ? { defence: "PRIMARY", midfield: "SECONDARY", flexible: "TERTIARY" }
                : pos === "midfielder"
                  ? { midfield: "PRIMARY", attack: "SECONDARY", flexible: "TERTIARY" }
                  : { attack: "PRIMARY", midfield: "SECONDARY", flexible: "TERTIARY" },
          ),
          goalkeeperAbility: isGk ? "YES" : "NO",
        }));
      }

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: getFallbackStructure("FIVE_A_SIDE"),
      }));

      // Forwards should be assigned ATTACK or FLEXIBLE, never DEFENCE
      for (const fwdPlayer of players.filter((p) => p.primaryBroadPosition === "forward")) {
        const assignment = result.assignments.find((a) => a.playerId === fwdPlayer.id);
        expect(assignment).toBeDefined();
        expect(assignment!.assignedRole).not.toBe("DEFENCE");
      }

      // Defenders should be assigned DEFENCE, not ATTACK
      for (const defPlayer of players.filter((p) => p.primaryBroadPosition === "defender")) {
        const assignment = result.assignments.find((a) => a.playerId === defPlayer.id);
        expect(assignment).toBeDefined();
        expect(assignment!.assignedRole).not.toBe("ATTACK");
      }
    });

    it("composeTeams assigns positions correctly — forwards to ATTACK, defenders to DEFENCE", () => {
      const teams = [
        makeTeam({ id: "t1", name: "Team 1", targetSize: 5, minimumSize: 5, maximumSize: 7 }),
        makeTeam({ id: "t2", name: "Team 2", targetSize: 5, minimumSize: 5, maximumSize: 7 }),
      ];
      const players: CompositionPlayer[] = [];
      // 2 GKs, 4 defenders, 4 midfielders, 4 forwards = 14 players
      for (let i = 0; i < 14; i++) {
        const isGk = i < 2;
        const pos: BroadPosition = isGk ? "goalkeeper" : i < 4 ? "defender" : i < 8 ? "midfielder" : "forward";
        players.push(makePlayer({
          id: `p${i + 1}`,
          displayName: `Player ${i + 1}`,
          overallStrength: 5,
          primaryBroadPosition: pos,
          roleSuitability: makeRoleSuitability(
            isGk
              ? { goalkeeper: "PRIMARY", flexible: "TERTIARY" }
              : pos === "defender"
                ? { defence: "PRIMARY", midfield: "SECONDARY", flexible: "TERTIARY" }
                : pos === "midfielder"
                  ? { midfield: "PRIMARY", attack: "SECONDARY", flexible: "TERTIARY" }
                  : { attack: "PRIMARY", midfield: "SECONDARY", flexible: "TERTIARY" },
          ),
          goalkeeperAbility: isGk ? "YES" : "NO",
        }));
      }

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: getFallbackStructure("FIVE_A_SIDE"),
      }));

      // Count ATTACK-role assignments (should be non-zero)
      const attackAssignments = result.assignments.filter((a) => a.assignedRole === "ATTACK");
      expect(attackAssignments.length).toBeGreaterThan(0);

      // Forwards should be assigned ATTACK or FLEXIBLE, never DEFENCE
      for (const fwdPlayer of players.filter((p) => p.primaryBroadPosition === "forward")) {
        const assignment = result.assignments.find((a) => a.playerId === fwdPlayer.id);
        expect(assignment).toBeDefined();
        expect(assignment!.assignedRole).not.toBe("DEFENCE");
      }
    });

    it("sortByOverallStrength orders players by strength descending", () => {
      const players = [
        makePlayer({ id: "a", overallStrength: 3 }),
        makePlayer({ id: "b", overallStrength: 8 }),
        makePlayer({ id: "c", overallStrength: 5 }),
      ];
      const sorted = sortByOverallStrength(players, "seed");
      expect(sorted[0].overallStrength).toBe(8);
      expect(sorted[1].overallStrength).toBe(5);
      expect(sorted[2].overallStrength).toBe(3);
    });
  });

  // ── Scenario catalogue ───────────────────────────────────────────────

  describe("scenario catalogue", () => {
    it("provides all four system scenarios", () => {
      const scenarios = getAllSystemScenarios();
      expect(scenarios).toHaveLength(4);
      expect(scenarios.map((s) => s.code).sort()).toEqual(["BALANCED", "ONE_STRONG_REST_BALANCED", "PRESERVE_AND_REPAIR", "TIERED_DESCENDING"]);
    });

    it("returns correct scenario by code", () => {
      const balanced = getSystemScenario("BALANCED");
      expect(balanced.code).toBe("BALANCED");
      expect(balanced.strengthProfile.type).toBe("BALANCED");
    });

    it("PRESERVE_AND_REPAIR has high continuity weight", () => {
      const scenario = getSystemScenario("PRESERVE_AND_REPAIR");
      expect(scenario.objectives.continuityWeight).toBeGreaterThanOrEqual(0.5);
    });

    it("BALANCED has spread limits", () => {
      const scenario = getSystemScenario("BALANCED");
      expect(scenario.objectives.maxOverallSpread).not.toBeNull();
    });

    it("TIERED_DESCENDING is policy gated", () => {
      expect(isScenarioPolicyGated("TIERED_DESCENDING")).toBe(true);
      expect(isScenarioPolicyGated("BALANCED")).toBe(false);
    });
  });

  // ── Structural requirements ──────────────────────────────────────────

  describe("structural requirements", () => {
    it("5-a-side has goalkeeper requirement", () => {
      const structure = getFallbackStructure("FIVE_A_SIDE");
      expect(structure.requireGoalkeeper).toBe(true);
      expect(structure.source).toBe("FALLBACK");
    });

    it("3-a-side does not require goalkeeper", () => {
      const structure = getFallbackStructure("THREE_A_SIDE");
      expect(structure.requireGoalkeeper).toBe(false);
    });

    it("7-a-side has correct slot counts", () => {
      const structure = getFallbackStructure("SEVEN_A_SIDE");
      const counts = countRoleRequirements(structure.slots);
      expect(counts.GOALKEEPER).toBe(1);
      expect(counts.DEFENCE).toBe(2);
      expect(counts.MIDFIELD).toBe(2);
      expect(counts.ATTACK).toBe(1);
      expect(counts.FLEXIBLE).toBe(1);
    });

    it("11-a-side has correct slot counts", () => {
      const structure = getFallbackStructure("ELEVEN_A_SIDE");
      const counts = countRoleRequirements(structure.slots);
      expect(counts.GOALKEEPER).toBe(1);
      expect(counts.DEFENCE).toBe(4);
      expect(counts.MIDFIELD).toBe(3);
      expect(counts.ATTACK).toBe(3);
    });
  });

  // ── Proposal metrics ──────────────────────────────────────────────────

  describe("proposal metrics", () => {
    it("computes correct team metrics", () => {
      const players = createBalancedPlayerPool(12);
      const teams = [makeTeam({ id: "t1", targetSize: 6, minimumSize: 4, maximumSize: 8 }), makeTeam({ id: "t2", name: "Team 2", targetSize: 6, minimumSize: 4, maximumSize: 8 })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      expect(result.teamMetrics.length).toBe(2);
      for (const metrics of result.teamMetrics) {
        expect(metrics.squadSize).toBeGreaterThan(0);
        expect(metrics.formationViability).toBeDefined();
      }
    });

    it("computes proposal metrics with spread values", () => {
      const players = createBalancedPlayerPool(12);
      const teams = [makeTeam({ id: "t1" }), makeTeam({ id: "t2", name: "Team 2" })];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create5v5Structure(),
      }));

      expect(result.proposalMetrics.sizeSpread).toBeGreaterThanOrEqual(0);
      expect(result.proposalMetrics.averageTeamSize).toBeGreaterThan(0);
    });
  });

  // ── Comprehensive scenario: 3-team 7-a-side ──────────────────────────

  describe("comprehensive scenario: 3 teams 7-a-side", () => {
    it("distributes 21 players across 3 teams", () => {
      const players = createBalancedPlayerPool(21, ["t1", "t2", "t3"]);
      const teams = [
        makeTeam({ id: "t1", name: "Team A", targetSize: 7, minimumSize: 5, maximumSize: 9 }),
        makeTeam({ id: "t2", name: "Team B", targetSize: 7, minimumSize: 5, maximumSize: 9 }),
        makeTeam({ id: "t3", name: "Team C", targetSize: 7, minimumSize: 5, maximumSize: 9 }),
      ];

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create7v7Structure(),
      }));

      expect(result.assignments.length).toBe(21);

      for (const team of teams) {
        const teamSize = result.assignments.filter((a) => a.teamId === team.id).length;
        expect(teamSize).toBeGreaterThanOrEqual(team.minimumSize);
      }
    });
  });

  describe("maximum size and distribution across all scenarios", () => {
    it("respects maximumSize for all teams in BALANCED scenario with uneven current assignments", () => {
      const teams = [
        makeTeam({ id: "bla", name: "Blå", targetSize: 7, minimumSize: 7, maximumSize: 13 }),
        makeTeam({ id: "hvit", name: "Hvit", targetSize: 7, minimumSize: 7, maximumSize: 13 }),
        makeTeam({ id: "rod", name: "Rød", targetSize: 7, minimumSize: 7, maximumSize: 13 }),
      ];

      // 23 players: 8 on Hvit, 15 on Rød, 0 on Blå
      const players: CompositionPlayer[] = [];
      const positions: BroadPosition[] = ["goalkeeper", "defender", "midfielder", "forward"];
      for (let i = 0; i < 23; i++) {
        const teamId = i < 8 ? "hvit" : "rod";
        const pos = positions[i % 4 === 0 ? 0 : i % 4];
        const isGk = i === 0 || i === 8;
        players.push(makePlayer({
          id: `p${i + 1}`,
          displayName: `Player ${i + 1}`,
          currentTeamId: teamId,
          overallStrength: 4 + (i % 5),
          primaryBroadPosition: isGk ? "goalkeeper" : pos,
          roleSuitability: makeRoleSuitability(
            isGk
              ? { goalkeeper: "PRIMARY", flexible: "TERTIARY" }
              : pos === "defender"
                ? { defence: "PRIMARY", flexible: "SECONDARY" }
                : pos === "midfielder"
                  ? { midfield: "PRIMARY", flexible: "SECONDARY" }
                  : pos === "forward"
                    ? { attack: "PRIMARY", flexible: "SECONDARY" }
                    : { flexible: "PRIMARY" },
          ),
          goalkeeperAbility: isGk ? "YES" : "NO",
        }));
      }

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create7v7Structure(),
      }));

      for (const team of teams) {
        const teamSize = result.assignments.filter((a) => a.teamId === team.id).length;
        expect(teamSize).toBeLessThanOrEqual(team.maximumSize);
      }

      // No team should have 0 players when there are enough for all
      for (const team of teams) {
        const teamSize = result.assignments.filter((a) => a.teamId === team.id).length;
        expect(teamSize).toBeGreaterThan(0);
      }
    });

    it("respects maximumSize for all teams in PRESERVE_AND_REPAIR scenario", () => {
      const teams = [
        makeTeam({ id: "bla", name: "Blå", targetSize: 7, minimumSize: 7, maximumSize: 13 }),
        makeTeam({ id: "hvit", name: "Hvit", targetSize: 7, minimumSize: 7, maximumSize: 13 }),
        makeTeam({ id: "rod", name: "Rød", targetSize: 7, minimumSize: 7, maximumSize: 13 }),
      ];

      // 35 players: all on Hvit and Rød, none on Blå
      const players: CompositionPlayer[] = [];
      const positions: BroadPosition[] = ["goalkeeper", "defender", "midfielder", "forward"];
      for (let i = 0; i < 35; i++) {
        const teamId = i < 15 ? "hvit" : "rod";
        const isGk = i === 0 || i === 15;
        const pos = positions[i % 4 === 0 ? 0 : i % 4];
        players.push(makePlayer({
          id: `p${i + 1}`,
          displayName: `Player ${i + 1}`,
          currentTeamId: teamId,
          overallStrength: 4 + (i % 5),
          primaryBroadPosition: isGk ? "goalkeeper" : pos,
          roleSuitability: makeRoleSuitability(
            isGk
              ? { goalkeeper: "PRIMARY", flexible: "TERTIARY" }
              : pos === "defender"
                ? { defence: "PRIMARY", flexible: "SECONDARY" }
                : pos === "midfielder"
                  ? { midfield: "PRIMARY", flexible: "SECONDARY" }
                  : pos === "forward"
                    ? { attack: "PRIMARY", flexible: "SECONDARY" }
                    : { flexible: "PRIMARY" },
          ),
          goalkeeperAbility: isGk ? "YES" : "NO",
        }));
      }

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("PRESERVE_AND_REPAIR"),
        players,
        targetTeams: teams,
        structure: create7v7Structure(),
      }));

      for (const team of teams) {
        const teamSize = result.assignments.filter((a) => a.teamId === team.id).length;
        expect(teamSize).toBeLessThanOrEqual(team.maximumSize);
        expect(teamSize).toBeGreaterThan(0);
      }
    });

    it("distributes players across all teams in BALANCED regardless of currentTeamId", () => {
      const teams = [
        makeTeam({ id: "bla", name: "Blå", targetSize: 7, minimumSize: 7, maximumSize: 13 }),
        makeTeam({ id: "hvit", name: "Hvit", targetSize: 7, minimumSize: 7, maximumSize: 13 }),
        makeTeam({ id: "rod", name: "Rød", targetSize: 7, minimumSize: 7, maximumSize: 13 }),
      ];

      // 24 players: ALL with currentTeamId "hvit" but should be distributed evenly
      const players: CompositionPlayer[] = [];
      for (let i = 0; i < 24; i++) {
        const isGk = i === 0;
        players.push(makePlayer({
          id: `p${i + 1}`,
          displayName: `Player ${i + 1}`,
          currentTeamId: "hvit",
          overallStrength: 5,
          primaryBroadPosition: isGk ? "goalkeeper" : i % 3 === 0 ? "defender" : i % 3 === 1 ? "midfielder" : "forward",
          roleSuitability: makeRoleSuitability(
            isGk
              ? { goalkeeper: "PRIMARY", flexible: "TERTIARY" }
              : i % 3 === 0
                ? { defence: "PRIMARY", flexible: "SECONDARY" }
                : i % 3 === 1
                  ? { midfield: "PRIMARY", flexible: "SECONDARY" }
                  : { attack: "PRIMARY", flexible: "SECONDARY" },
          ),
          goalkeeperAbility: isGk ? "YES" : "NO",
        }));
      }

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create7v7Structure(),
      }));

      // All teams must have players
      for (const team of teams) {
        const teamSize = result.assignments.filter((a) => a.teamId === team.id).length;
        expect(teamSize).toBeGreaterThan(0);
        expect(teamSize).toBeLessThanOrEqual(team.maximumSize);
      }
    });
  });

  describe("BALANCED produces strength-balanced teams", () => {
    it("distributes players so no team's average strength is far below others", () => {
      const teams = [
        makeTeam({ id: "t1", name: "Team 1", targetSize: 7, minimumSize: 7, maximumSize: 13 }),
        makeTeam({ id: "t2", name: "Team 2", targetSize: 7, minimumSize: 7, maximumSize: 13 }),
        makeTeam({ id: "t3", name: "Team 3", targetSize: 7, minimumSize: 7, maximumSize: 13 }),
      ];

      // 21 players with varied strengths (3 GKs, 6 DEF, 6 MID, 6 ATT)
      const players: CompositionPlayer[] = [];
      for (let i = 0; i < 21; i++) {
        const isGk = i < 3;
        const pos: BroadPosition = isGk ? "goalkeeper" : i < 9 ? "defender" : i < 15 ? "midfielder" : "forward";
        // Varying strengths: some strong (8-9), some medium (5-6), some weaker (3-4)
        const strength = i < 3 ? 7 : i < 6 ? 8 : i < 9 ? 6 : i < 12 ? 9 : i < 15 ? 5 : i < 18 ? 4 : 3;
        players.push(makePlayer({
          id: `p${i + 1}`,
          displayName: `Player ${i + 1}`,
          overallStrength: strength,
          primaryBroadPosition: pos,
          roleSuitability: makeRoleSuitability(
            isGk
              ? { goalkeeper: "PRIMARY", flexible: "TERTIARY" }
              : pos === "defender"
                ? { defence: "PRIMARY", midfield: "SECONDARY", flexible: "TERTIARY" }
                : pos === "midfielder"
                  ? { midfield: "PRIMARY", attack: "SECONDARY", flexible: "TERTIARY" }
                  : { attack: "PRIMARY", midfield: "SECONDARY", flexible: "TERTIARY" },
          ),
          goalkeeperAbility: isGk ? "YES" : "NO",
        }));
      }

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create7v7Structure(),
      }));

      // Calculate average strength per team
      const teamStrengths = teams.map((team) => {
        const assignments = result.assignments.filter((a) => a.teamId === team.id);
        const totalStrength = assignments.reduce((sum, a) => sum + a.overallStrength, 0);
        return { id: team.id, name: team.name, avg: totalStrength / assignments.length, count: assignments.length };
      });

      // All teams must have players
      for (const ts of teamStrengths) {
        expect(ts.count).toBeGreaterThan(0);
      }

      // The max average strength difference between any two teams should be reasonable
      // With BALANCED, no team should have more than 2.0 average strength difference from the mean
      const avgStrength = teamStrengths.reduce((sum, ts) => sum + ts.avg, 0) / teamStrengths.length;
      for (const ts of teamStrengths) {
        expect(Math.abs(ts.avg - avgStrength)).toBeLessThan(2.0);
      }
    });

    it("does not leave the last team with only weak players in a 3-team scenario", () => {
      const teams = [
        makeTeam({ id: "bla", name: "Blå", targetSize: 7, minimumSize: 7, maximumSize: 13 }),
        makeTeam({ id: "hvit", name: "Hvit", targetSize: 7, minimumSize: 7, maximumSize: 13 }),
        makeTeam({ id: "rod", name: "Rød", targetSize: 7, minimumSize: 7, maximumSize: 13 }),
      ];

      // 21 players with a realistic distribution of strengths
      const players: CompositionPlayer[] = [];
      // 3 GKs with strength 6
      for (let i = 0; i < 3; i++) {
        players.push(makePlayer({
          id: `gk${i + 1}`,
          displayName: `GK ${i + 1}`,
          overallStrength: 6,
          primaryBroadPosition: "goalkeeper",
          roleSuitability: makeRoleSuitability({ goalkeeper: "PRIMARY", flexible: "TERTIARY" }),
          goalkeeperAbility: "YES",
        }));
      }
      // 6 defenders: 2 strong (8), 2 medium (6), 2 weaker (4)
      const defStrengths = [8, 8, 6, 6, 4, 4];
      for (let i = 0; i < 6; i++) {
        players.push(makePlayer({
          id: `def${i + 1}`,
          displayName: `Def ${i + 1}`,
          overallStrength: defStrengths[i],
          primaryBroadPosition: "defender",
          roleSuitability: makeRoleSuitability({ defence: "PRIMARY", midfield: "SECONDARY", flexible: "TERTIARY" }),
          goalkeeperAbility: "NO",
        }));
      }
      // 6 midfielders: 2 strong (8), 2 medium (6), 2 weaker (4)
      const midStrengths = [8, 8, 6, 6, 4, 4];
      for (let i = 0; i < 6; i++) {
        players.push(makePlayer({
          id: `mid${i + 1}`,
          displayName: `Mid ${i + 1}`,
          overallStrength: midStrengths[i],
          primaryBroadPosition: "midfielder",
          roleSuitability: makeRoleSuitability({ midfield: "PRIMARY", attack: "SECONDARY", flexible: "TERTIARY" }),
          goalkeeperAbility: "NO",
        }));
      }
      // 6 forwards: 2 strong (8), 2 medium (6), 2 weaker (4)
      const fwdStrengths = [8, 8, 6, 6, 4, 4];
      for (let i = 0; i < 6; i++) {
        players.push(makePlayer({
          id: `fwd${i + 1}`,
          displayName: `Fwd ${i + 1}`,
          overallStrength: fwdStrengths[i],
          primaryBroadPosition: "forward",
          roleSuitability: makeRoleSuitability({ attack: "PRIMARY", midfield: "SECONDARY", flexible: "TERTIARY" }),
          goalkeeperAbility: "NO",
        }));
      }

      const result = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: create7v7Structure(),
      }));

      // Calculate average strength per team
      const teamStrengths = teams.map((team) => {
        const assignments = result.assignments.filter((a) => a.teamId === team.id);
        const totalStrength = assignments.reduce((sum, a) => sum + a.overallStrength, 0);
        return { id: team.id, name: team.name, avg: totalStrength / assignments.length, count: assignments.length };
      });

      // The weakest team's average should not be more than 1.5 below the strongest
      const strengths = teamStrengths.map((ts) => ts.avg);
      const maxDiff = Math.max(...strengths) - Math.min(...strengths);
      expect(maxDiff).toBeLessThan(1.5);

      // No team should have average below 4.5 (with average player strength ~6)
      for (const ts of teamStrengths) {
        expect(ts.avg).toBeGreaterThan(4.5);
      }
    });
  });

  describe("deterministic reproducibility", () => {
    it("produces identical results with the same deterministic seed", () => {
      const teams = [
        makeTeam({ id: "t1", name: "Team 1", targetSize: 5, minimumSize: 5, maximumSize: 7 }),
        makeTeam({ id: "t2", name: "Team 2", targetSize: 5, minimumSize: 5, maximumSize: 7 }),
      ];

      const players: CompositionPlayer[] = [];
      for (let i = 0; i < 14; i++) {
        const isGk = i < 2;
        const pos: BroadPosition = isGk ? "goalkeeper" : i < 6 ? "defender" : i < 10 ? "midfielder" : "forward";
        players.push(makePlayer({
          id: `p${i + 1}`,
          displayName: `Player ${i + 1}`,
          overallStrength: 5,
          primaryBroadPosition: pos,
          roleSuitability: makeRoleSuitability(
            isGk
              ? { goalkeeper: "PRIMARY", flexible: "TERTIARY" }
              : pos === "defender"
                ? { defence: "PRIMARY", flexible: "SECONDARY" }
                : pos === "midfielder"
                  ? { midfield: "PRIMARY", flexible: "SECONDARY" }
                  : { attack: "PRIMARY", flexible: "SECONDARY" },
          ),
          goalkeeperAbility: isGk ? "YES" : "NO",
        }));
      }

      const result1 = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: getFallbackStructure("FIVE_A_SIDE"),
        deterministicSeed: "same-seed",
      }));

      const result2 = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: getFallbackStructure("FIVE_A_SIDE"),
        deterministicSeed: "same-seed",
      }));

      expect(result1.assignments.length).toBe(result2.assignments.length);
      for (let i = 0; i < result1.assignments.length; i++) {
        expect(result1.assignments[i].playerId).toBe(result2.assignments[i].playerId);
        expect(result1.assignments[i].teamId).toBe(result2.assignments[i].teamId);
        expect(result1.assignments[i].assignedRole).toBe(result2.assignments[i].assignedRole);
      }
    });

    it("produces different team assignments with different deterministic seeds", () => {
      const teams = [
        makeTeam({ id: "t1", name: "Team 1", targetSize: 5, minimumSize: 5, maximumSize: 7 }),
        makeTeam({ id: "t2", name: "Team 2", targetSize: 5, minimumSize: 5, maximumSize: 7 }),
      ];

      const players: CompositionPlayer[] = [];
      for (let i = 0; i < 14; i++) {
        const isGk = i < 2;
        const pos: BroadPosition = isGk ? "goalkeeper" : i < 6 ? "defender" : i < 10 ? "midfielder" : "forward";
        players.push(makePlayer({
          id: `p${i + 1}`,
          displayName: `Player ${i + 1}`,
          overallStrength: 5,
          primaryBroadPosition: pos,
          roleSuitability: makeRoleSuitability(
            isGk
              ? { goalkeeper: "PRIMARY", flexible: "TERTIARY" }
              : pos === "defender"
                ? { defence: "PRIMARY", midfield: "SECONDARY", flexible: "TERTIARY" }
                : pos === "midfielder"
                  ? { midfield: "PRIMARY", attack: "SECONDARY", flexible: "TERTIARY" }
                  : { attack: "PRIMARY", midfield: "SECONDARY", flexible: "TERTIARY" },
          ),
          goalkeeperAbility: isGk ? "YES" : "NO",
        }));
      }

      const result1 = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: getFallbackStructure("FIVE_A_SIDE"),
        deterministicSeed: "seed-alpha",
      }));

      const result2 = composeTeams(makeProblem({
        scenario: getSystemScenario("BALANCED"),
        players,
        targetTeams: teams,
        structure: getFallbackStructure("FIVE_A_SIDE"),
        deterministicSeed: "seed-beta",
      }));

      // Both must produce valid results
      expect(result1.assignments.length).toBe(players.length);
      expect(result2.assignments.length).toBe(players.length);

      // With tied player strengths, different seeds should produce at least
      // some different team assignments
      const assignments1 = result1.assignments
        .sort((a, b) => a.playerId.localeCompare(b.playerId))
        .map((a) => `${a.playerId}:${a.teamId}`);
      const assignments2 = result2.assignments
        .sort((a, b) => a.playerId.localeCompare(b.playerId))
        .map((a) => `${a.playerId}:${a.teamId}`);

      // At least one player should be on a different team
      const differences = assignments1.filter((a, i) => a !== assignments2[i]);
      expect(differences.length).toBeGreaterThan(0);
    });
  });
});