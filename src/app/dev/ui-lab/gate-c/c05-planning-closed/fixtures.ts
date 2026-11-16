import { WarningSeverity } from "@/generated/prisma/client";
import { ROD, HVIT, buildRoster, KICKOFF_LAST_WEEK, KICKOFF_SATURDAY, W2_ORG_SLUG, type FixturePlayerSeed } from "../w2-shared/round-identities";
import type { RoundBoardFixtureInitial } from "../w2-shared/round-board-fixture-harness";

/**
 * C05 — Planning closed, historical warnings (Gate C W2).
 *
 * Primary candidate: a genuinely MIXED planning boundary — Rød's match kicked off last week and
 * is closed (`isFinalized: true`), carrying a retained historical BLOCKED warning; Hvit's match
 * is this coming Saturday and is still open, with its own genuine unresolved decision. Round-level
 * `planningBoundaryOpen` is false (every match must be open for the round-level gate — ADR-0109),
 * but Hvit's own per-match boundary remains open, so a valid action must still be reachable for it
 * (brief §4: "Do not disable valid open-match actions merely because another match is closed.").
 *
 * Historical warning provenance (remediation of a review finding): Rød's retained warning is
 * `SQUAD_BELOW_MINIMUM` — only 6 of 11 eligible Rød players were ever selected, below the
 * minimum accepted squad size of 7. `computeRoundPlanIntegrity()` evaluates this rule across
 * BOTH draft and finalized selections, for every non-cancelled match regardless of its planning
 * boundary (`compute-plan-integrity.ts` lines ~186-222) — so this is a warning the real engine
 * could actually still produce for a closed match, unlike an earlier draft of this fixture's
 * `SELECTED_PLAYER_UNAVAILABLE`, which the engine only ever generates for DRAFT selections
 * (lines ~224-253) and therefore can never legitimately co-occur with a finalized/closed match.
 * This rule is also match-scoped, not player-scoped — no `playerId` is set, matching the real
 * signal's own shape.
 */

function toAssigned(seed: FixturePlayerSeed, role: "CORE" | "SUPPORT" | "BACKFILL" | "DEVELOPMENT" = "CORE") {
  return {
    id: seed.id,
    name: seed.name,
    coreTeamName: seed.coreTeamName,
    coreTeamId: seed.coreTeamId,
    playerCoreTeamId: seed.coreTeamId,
    primaryPosition: seed.primaryPosition,
    role,
    shirtNumber: seed.shirtNumber,
    kitColor: seed.kitColor,
  };
}

function toAvailable(seed: FixturePlayerSeed) {
  return {
    id: seed.id,
    name: seed.name,
    coreTeamName: seed.coreTeamName,
    coreTeamId: seed.coreTeamId,
    primaryPosition: seed.primaryPosition,
    shirtNumber: seed.shirtNumber,
    kitColor: seed.kitColor,
  };
}

export function buildC05PlanningClosedFixture(): RoundBoardFixtureInitial {
  const rodRoster = buildRoster(ROD, 11, 1);
  const hvitRoster = buildRoster(HVIT, 11, 21);
  const erikHvit = hvitRoster.find((p) => p.name === "Erik")!;
  const hvitAssigned = hvitRoster.filter((p) => p.id !== erikHvit.id);
  // Only 6 of Rød's 11 eligible players were ever selected for this match — genuinely below the
  // minimum accepted squad size of 7, a fact that remains true forever now that the match is
  // closed. The other 5 are simply never assigned here (a real, if unfortunate, planning
  // outcome) — they are not individually "missing an opportunity" signals in this fixture.
  const rodAssigned = rodRoster.slice(0, 6);

  return {
    roundLabel: "Week 45",
    orgSlug: W2_ORG_SLUG,
    planningBoundaryOpen: false,
    matchRoundId: "w2-c05-round",
    matches: [
      {
        matchId: "w2-c05-rod",
        teamId: ROD.teamId,
        teamName: ROD.teamName,
        teamKitColor: ROD.kitColor,
        opponent: "Asker SK",
        matchDate: KICKOFF_LAST_WEEK,
        targetSquadSize: 12,
        minSquadSize: 7,
        isFinalized: true,
        players: rodAssigned.map((p) => toAssigned(p)),
      },
      {
        matchId: "w2-c05-hvit",
        teamId: HVIT.teamId,
        teamName: HVIT.teamName,
        teamKitColor: HVIT.kitColor,
        opponent: "Nittedal IL",
        matchDate: KICKOFF_SATURDAY,
        targetSquadSize: 12,
        minSquadSize: 7,
        isFinalized: false,
        players: hvitAssigned.map((p) => toAssigned(p)),
      },
    ],
    availablePlayers: [...rodRoster, ...hvitRoster].map(toAvailable),
    rotationPathMap: {},
    warnings: [
      {
        code: "SQUAD_BELOW_MINIMUM",
        message: `${ROD.teamName} is below minimum squad size. 6 players selected. Minimum accepted squad size is 7.`,
        severity: WarningSeverity.HARD_BLOCK,
        matchId: "w2-c05-rod",
        teamName: ROD.teamName,
      },
      {
        code: "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY",
        message: `${erikHvit.name} is available but has no planned match opportunity this round.`,
        severity: WarningSeverity.REQUIRES_OVERRIDE,
        playerId: erikHvit.id,
        playerName: erikHvit.name,
        teamName: HVIT.teamName,
      },
    ],
    signalSummary: { blocked: 1, decisionRequired: 1, planningNote: 0 },
    movementSummary: { supportSent: 0, supportReceived: 0, developmentSent: 0, developmentReceived: 0, squadRepairReceived: 0, drops: 0 },
    fairnessMetrics: [
      { label: "Players selected", value: 16 },
      { label: "Matches this round", value: 2 },
      { label: "Cross-team movers", value: 0 },
      { label: "Squad fill rate", value: "67%" },
    ],
    eligiblePlayerIds: [...rodRoster, ...hvitRoster].map((p) => p.id),
  };
}

/** Edge case: closed round, but no unresolved historical warning remains. */
export function buildC05ClosedNoWarningFixture(): RoundBoardFixtureInitial {
  const rodRoster = buildRoster(ROD, 11, 1);
  return {
    roundLabel: "Week 44",
    orgSlug: W2_ORG_SLUG,
    planningBoundaryOpen: false,
    matchRoundId: "w2-c05-closed-clean",
    matches: [
      {
        matchId: "w2-c05-rod-clean",
        teamId: ROD.teamId,
        teamName: ROD.teamName,
        teamKitColor: ROD.kitColor,
        opponent: "Asker SK",
        matchDate: KICKOFF_LAST_WEEK,
        targetSquadSize: 11,
        minSquadSize: 7,
        isFinalized: true,
        players: rodRoster.map((p) => toAssigned(p)),
      },
    ],
    availablePlayers: rodRoster.map(toAvailable),
    rotationPathMap: {},
    warnings: [],
    signalSummary: { blocked: 0, decisionRequired: 0, planningNote: 0 },
    movementSummary: { supportSent: 0, supportReceived: 0, developmentSent: 0, developmentReceived: 0, squadRepairReceived: 0, drops: 0 },
    fairnessMetrics: [],
    eligiblePlayerIds: rodRoster.map((p) => p.id),
  };
}

/** Edge case: a match-specific warning (no player) on a match that is still OPEN — Resolve must
 * route into that match's own context, distinct from the player-specific case above. */
export function buildC05OpenMatchWarningFixture(): RoundBoardFixtureInitial {
  const rodRoster = buildRoster(ROD, 11, 1);
  const rodAssigned = rodRoster.slice(0, 5); // below minimum (7), but the match is still open.

  return {
    roundLabel: "Week 47",
    orgSlug: W2_ORG_SLUG,
    planningBoundaryOpen: true,
    matchRoundId: "w2-c05-open-match-warning",
    matches: [
      {
        matchId: "w2-c05-rod-open-warning",
        teamId: ROD.teamId,
        teamName: ROD.teamName,
        teamKitColor: ROD.kitColor,
        opponent: "Asker SK",
        matchDate: KICKOFF_SATURDAY,
        targetSquadSize: 12,
        minSquadSize: 7,
        isFinalized: false,
        players: rodAssigned.map((p) => toAssigned(p)),
      },
    ],
    availablePlayers: rodRoster.map(toAvailable),
    rotationPathMap: {},
    warnings: [
      {
        code: "SQUAD_BELOW_MINIMUM",
        message: `${ROD.teamName} is below minimum squad size. 5 players selected. Minimum accepted squad size is 7.`,
        severity: WarningSeverity.HARD_BLOCK,
        matchId: "w2-c05-rod-open-warning",
        teamName: ROD.teamName,
      },
    ],
    signalSummary: { blocked: 1, decisionRequired: 0, planningNote: 0 },
    movementSummary: { supportSent: 0, supportReceived: 0, developmentSent: 0, developmentReceived: 0, squadRepairReceived: 0, drops: 0 },
    fairnessMetrics: [],
    eligiblePlayerIds: rodRoster.map((p) => p.id),
  };
}

/**
 * Same round as `buildC05OpenMatchWarningFixture`, plus one deliberately denied destination for
 * the first genuinely unassigned candidate (Isak) into the short match itself — third
 * remediation pass §5 "Rejection scenario": a match-targeted Resolve's commit must show the real
 * reason and leave the target/candidate/assignment unchanged on a server rejection, not just on
 * the happy path. Same fixture-safe `deniedAssignments` mechanism C06 already established.
 */
export function buildC05OpenMatchWarningDeniedFixture(): RoundBoardFixtureInitial {
  const base = buildC05OpenMatchWarningFixture();
  const candidate = base.availablePlayers.find(
    (p) => !base.matches.some((m) => m.players.some((mp) => mp.id === p.id)),
  )!;
  return {
    ...base,
    deniedAssignments: [
      {
        playerId: candidate.id,
        matchId: "w2-c05-rod-open-warning",
        reason: "Fixture: Rød's squad is already at its accepted cap for a cross-team placement without an override.",
      },
    ],
  };
}

/** Edge case: a warning with neither a player nor a match identity — must fail safe to
 * read-only, never guess which match or player to route a Resolve action into. */
export function buildC05InsufficientIdentityFixture(): RoundBoardFixtureInitial {
  const rodRoster = buildRoster(ROD, 11, 1);

  return {
    roundLabel: "Week 47",
    orgSlug: W2_ORG_SLUG,
    planningBoundaryOpen: true,
    matchRoundId: "w2-c05-insufficient-identity",
    matches: [
      {
        matchId: "w2-c05-rod-insufficient",
        teamId: ROD.teamId,
        teamName: ROD.teamName,
        teamKitColor: ROD.kitColor,
        opponent: "Asker SK",
        matchDate: KICKOFF_SATURDAY,
        targetSquadSize: 11,
        minSquadSize: 7,
        isFinalized: false,
        players: rodRoster.map((p) => toAssigned(p)),
      },
    ],
    availablePlayers: rodRoster.map(toAvailable),
    rotationPathMap: {},
    warnings: [
      {
        // A policy-derived signal that, in this fixture, carries neither a playerId nor a
        // matchId — the fail-safe case the brief's §2 requires: "Do not guess which match or
        // player to modify. Fail safe to read-only presentation."
        code: "ROUND_LEVEL_POLICY_NOTE",
        message: "A round-level policy condition was flagged without a specific player or match.",
        severity: WarningSeverity.HARD_BLOCK,
        teamName: ROD.teamName,
      },
    ],
    signalSummary: { blocked: 1, decisionRequired: 0, planningNote: 0 },
    movementSummary: { supportSent: 0, supportReceived: 0, developmentSent: 0, developmentReceived: 0, squadRepairReceived: 0, drops: 0 },
    fairnessMetrics: [],
    eligiblePlayerIds: rodRoster.map((p) => p.id),
  };
}

/** Control case: a fully open round (no closed matches at all) — Resolve remains a genuinely valid action. */
export function buildC05FullyOpenControlFixture(): RoundBoardFixtureInitial {
  const rodRoster = buildRoster(ROD, 11, 1);
  const noah = rodRoster.find((p) => p.name === "Noah")!;
  const rodAssigned = rodRoster.filter((p) => p.id !== noah.id);

  return {
    roundLabel: "Week 47",
    orgSlug: W2_ORG_SLUG,
    planningBoundaryOpen: true,
    matchRoundId: "w2-c05-fully-open",
    matches: [
      {
        matchId: "w2-c05-rod-open",
        teamId: ROD.teamId,
        teamName: ROD.teamName,
        teamKitColor: ROD.kitColor,
        opponent: "Asker SK",
        matchDate: KICKOFF_SATURDAY,
        targetSquadSize: 11,
        minSquadSize: 7,
        isFinalized: false,
        players: rodAssigned.map((p) => toAssigned(p)),
      },
    ],
    availablePlayers: rodRoster.map(toAvailable),
    rotationPathMap: {},
    warnings: [
      {
        code: "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY",
        message: `${noah.name} is available but has no planned match opportunity this round.`,
        severity: WarningSeverity.REQUIRES_OVERRIDE,
        playerId: noah.id,
        playerName: noah.name,
        teamName: ROD.teamName,
      },
    ],
    signalSummary: { blocked: 0, decisionRequired: 1, planningNote: 0 },
    movementSummary: { supportSent: 0, supportReceived: 0, developmentSent: 0, developmentReceived: 0, squadRepairReceived: 0, drops: 0 },
    fairnessMetrics: [],
    eligiblePlayerIds: rodRoster.map((p) => p.id),
  };
}
