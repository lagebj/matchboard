import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { addPlayerToDraftMatch, removePlayerFromDraftMatch } from "@/lib/selection/manual-draft-edit";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import { getFloatingHistory } from "@/lib/selection/get-floating-history";
import { getSuitabilityAndReadinessScore } from "@/lib/selection/selection-eligibility";
import { getNegativeReadinessSignals, type ReadinessSignalEntry } from "@/lib/selection/readiness-scoring";
import { getSeasonCombinationEvidence, aggregateSeasonCombinations } from "@/lib/evidence/combination-aggregation";
import { getCombinationScoreModifier, deriveCombinationIntentMode, explainCombinationEvidence, type CombinationScoringInput } from "@/lib/selection/combination-scoring";
import { getActiveCoachingIntentForMatch } from "@/lib/coaching/coaching-intent";
import { classifyExactSuitability } from "@/domain/positions/suitability";
import { normalizeSourceRole } from "@/domain/positions/aliases";
import { isExactRole } from "@/domain/positions/roles";
import type { SelectionRole } from "@/generated/prisma/client";

/** Exact-fit tiers that are automatically eligible for a required role (ADR-0129 §13). */
type EligiblePositionFit = "NATURAL" | "STRONG" | "PLAUSIBLE";
const POSITION_FIT_RANK: Record<EligiblePositionFit, number> = { NATURAL: 0, STRONG: 1, PLAUSIBLE: 2 };

/**
 * A viable pre-kickoff repair alternative for a player who just became unavailable. Ordered most
 * to least preferred, but the coach chooses — nothing here is ever applied automatically (see
 * DECISIONS.md "Emergency repair"). Generating options never leaves a net change in the draft:
 * every candidate is tried and reverted the same way the existing `previewManualAddImpact` does.
 */
export type EmergencyRepairOption = {
  playerId: string;
  playerName: string;
  coreTeamName: string | null;
  role: SelectionRole;
  isOwnTeam: boolean;
  /** Exact positional fit for the vacated role (ADR-0129), or `null` when the vacated role does
   * not normalise to an exact role so no positional gate is applied. */
  positionFit: EligiblePositionFit | null;
  combinationNotes: string[];
  newBlockedSignals: string[];
  newDecisionRequiredSignals: string[];
  resolvedSignals: string[];
};

export type EmergencyRepairOptionsResult =
  | { success: true; vacatedPlayerId: string; vacatedPlayerName: string; vacatedRole: SelectionRole; options: EmergencyRepairOption[] }
  | { success: false; error: string };

const MAX_CANDIDATES_TRIED = 60;
const MAX_OPTIONS_RETURNED = 5;

/**
 * Generates a small set of viable repair alternatives for a player who has just become
 * unavailable for `matchId`, before kickoff. Reuses the existing manual-edit mutation
 * (`addPlayerToDraftMatch`) as the single source of eligibility truth — every domain rule
 * (availability, rotation path validity, same-round conflict, squad size) is enforced exactly
 * once, by that function, not re-implemented here. A candidate that would need an override
 * reason is not "viable" in this sense and is excluded, not surfaced as an option requiring
 * override — the coach can still do that manually via the normal draft editor.
 */
export async function generateEmergencyRepairOptions(
  matchId: string,
  vacatedPlayerId: string,
  orgFilter: OrgFilterMode,
): Promise<EmergencyRepairOptionsResult> {
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { id: true, matchRoundId: true, teamId: true, startsAt: true, team: { select: { name: true } } },
  });
  if (!match) return { success: false, error: "Match not found." };

  const vacatedSelection = await db.selection.findFirst({
    where: { matchId, playerId: vacatedPlayerId, status: "DRAFT" },
    select: { role: true, player: { select: { firstName: true, lastName: true, primaryPosition: true } } },
  });
  if (!vacatedSelection) {
    return { success: false, error: "Player is not currently in this match's draft squad." };
  }

  const vacatedRole = vacatedSelection.role;
  const vacatedPosition = vacatedSelection.player.primaryPosition;
  const vacatedPlayerName = `${vacatedSelection.player.firstName}${vacatedSelection.player.lastName ? ` ${vacatedSelection.player.lastName}` : ""}`;

  // Exact target role for the positional-eligibility gate (ADR-0129 §13). When the vacated
  // player's declared primary position does not normalise to one of the twelve exact roles
  // (e.g. a broad legacy string), no positional gate is applied and candidates rank purely on
  // the secondary consequences below.
  const vacatedNorm = normalizeSourceRole(vacatedPosition);
  const targetExactRole = vacatedNorm.known && isExactRole(vacatedNorm.role) ? vacatedNorm.role : null;

  const removeResult = await removePlayerFromDraftMatch(matchId, vacatedPlayerId);
  if (!removeResult.success) {
    return { success: false, error: removeResult.errors[0] ?? "Could not remove the unavailable player from the draft." };
  }

  try {
    const roundSelections = await db.selection.findMany({
      where: { matchRoundId: match.matchRoundId, status: { in: ["DRAFT", "FINALIZED"] } },
      select: { playerId: true },
    });
    const alreadySelectedIds = new Set(roundSelections.map((s) => s.playerId));

    const excludedIds = [...alreadySelectedIds, vacatedPlayerId];
    const baseWhere = {
      removedAt: null,
      currentAvailability: "AVAILABLE",
      id: { notIn: excludedIds },
      coreTeam: { organisationId: orgFilter.organisationId },
    } as const;

    // Own-team candidates are fetched (and tried) first, unbounded by MAX_CANDIDATES_TRIED — a
    // single team's own roster is small, and self-repair is priority 1 (AGENTS.md "Squad repair
    // priority order"). Other-team candidates fill the remaining budget.
    const [ownTeamCandidates, otherTeamCandidates] = await Promise.all([
      db.player.findMany({
        where: { ...baseWhere, coreTeamId: match.teamId },
        include: { coreTeam: { select: { id: true, name: true } } },
        orderBy: { firstName: "asc" },
      }),
      db.player.findMany({
        where: { ...baseWhere, NOT: { coreTeamId: match.teamId } },
        include: { coreTeam: { select: { id: true, name: true } } },
        take: MAX_CANDIDATES_TRIED,
        orderBy: { firstName: "asc" },
      }),
    ]);
    const candidatePlayers = [...ownTeamCandidates, ...otherTeamCandidates];

    const readinessSignalsRaw = await db.playerReadinessSignal.findMany({
      where: { playerId: { in: candidatePlayers.map((p) => p.id) }, ...orgFilter.filter },
    });
    const readinessSignals: ReadinessSignalEntry[] = readinessSignalsRaw.map((s) => ({
      playerId: s.playerId,
      signalType: s.signalType as ReadinessSignalEntry["signalType"],
      value: s.value as ReadinessSignalEntry["value"],
    }));

    let combinationScoringInputs: CombinationScoringInput[] = [];
    const matchRound = await db.matchRound.findFirst({ where: { id: match.matchRoundId }, select: { leagueSeasonId: true } });
    if (matchRound?.leagueSeasonId) {
      const seasonEvidence = await getSeasonCombinationEvidence(matchRound.leagueSeasonId);
      combinationScoringInputs = aggregateSeasonCombinations(seasonEvidence).map((s) => ({
        playerIds: s.playerIds,
        family: s.family,
        subtype: s.subtype,
        confidence: s.confidence,
        totalMinutesTogether: s.totalMinutesTogether,
        matchCount: s.matchCount,
      }));
    }
    const activeIntent = await getActiveCoachingIntentForMatch(matchId, orgFilter);
    const combinationIntentMode = deriveCombinationIntentMode(activeIntent?.category ?? null);

    const currentSquadPlayerIds = (
      await db.selection.findMany({ where: { matchId, status: "DRAFT" }, select: { playerId: true } })
    ).map((s) => s.playerId);

    type Attempt = EmergencyRepairOption & { priorityScore: number };
    const attempts: Attempt[] = [];

    for (const candidate of candidatePlayers) {
      const isOwnTeam = candidate.coreTeamId === match.teamId;
      const role: SelectionRole = isOwnTeam ? "CORE" : vacatedRole;

      // Exact positional-eligibility gate (ADR-0129 §13): a candidate below the automatic
      // threshold (NATURAL/STRONG/PLAUSIBLE) for the vacated exact role is not a "viable"
      // repair option and is not surfaced — the coach can still make a manual decision.
      let positionFit: EligiblePositionFit | null = null;
      if (targetExactRole) {
        const fit = classifyExactSuitability(
          {
            primaryPosition: candidate.primaryPosition,
            secondaryPosition: candidate.secondaryPosition,
            tertiaryPosition: candidate.tertiaryPosition,
            bestSide: candidate.bestSide,
          },
          targetExactRole,
        );
        if (!fit.automaticallyEligible) continue;
        positionFit = fit.tier as EligiblePositionFit;
      }

      const currentIntegrity = await safeComputeIntegrity(match.matchRoundId);
      const currentSignalCodes = new Set((currentIntegrity?.signals ?? []).map((s) => s.ruleCode));

      const addResult = await addPlayerToDraftMatch(matchId, candidate.id, role);
      if (!addResult.success) continue;

      const proposedIntegrity = await safeComputeIntegrity(match.matchRoundId);
      const proposedSignalCodes = new Set((proposedIntegrity?.signals ?? []).map((s) => s.ruleCode));

      const newBlockedSignals = (proposedIntegrity?.signals ?? [])
        .filter((s) => s.kind === "BLOCKED" && !currentSignalCodes.has(s.ruleCode))
        .map((s) => s.title);
      const newDecisionRequiredSignals = (proposedIntegrity?.signals ?? [])
        .filter((s) => s.kind === "DECISION_REQUIRED" && !currentSignalCodes.has(s.ruleCode))
        .map((s) => s.title);
      const resolvedSignals = [...currentSignalCodes]
        .filter((code) => !proposedSignalCodes.has(code))
        .map((code) => currentIntegrity?.signals.find((s) => s.ruleCode === code)?.title ?? code);

      await removePlayerFromDraftMatch(matchId, candidate.id);

      // getSuitabilityAndReadinessScore only reads supportSuitability/developmentReadiness/id —
      // rotationPathsFromCoreTeam (part of the full PlayerRecord type) is irrelevant here.
      const readinessScore = getSuitabilityAndReadinessScore(
        { ...candidate, rotationPathsFromCoreTeam: [] } as unknown as Parameters<typeof getSuitabilityAndReadinessScore>[0],
        isOwnTeam ? "DEVELOPMENT" : (role as "SUPPORT" | "DEVELOPMENT"),
        readinessSignals,
      );
      const negativeReadiness = getNegativeReadinessSignals(candidate.id, readinessSignals);
      const floatingHistory = await getFloatingHistory(candidate.id, match.startsAt);
      const combinationBonus = getCombinationScoreModifier(candidate.id, currentSquadPlayerIds, combinationScoringInputs, combinationIntentMode);

      // Positional fit is ranked first (tier), not folded into this additive score.
      const priorityScore =
        (isOwnTeam ? 20 : 0) +
        readinessScore +
        combinationBonus -
        floatingHistory.totalFloatingMatches * 3 -
        negativeReadiness.length * 5 -
        newBlockedSignals.length * 50 -
        newDecisionRequiredSignals.length * 10;

      attempts.push({
        playerId: candidate.id,
        playerName: `${candidate.firstName}${candidate.lastName ? ` ${candidate.lastName}` : ""}`,
        coreTeamName: candidate.coreTeam?.name ?? null,
        role,
        isOwnTeam,
        positionFit,
        combinationNotes: explainCombinationEvidence(candidate.id, currentSquadPlayerIds, combinationScoringInputs),
        newBlockedSignals,
        newDecisionRequiredSignals,
        resolvedSignals,
        priorityScore,
      });
    }

    // Rank NATURAL > STRONG > PLAUSIBLE first (ADR-0129 §13), then the secondary consequences.
    // When there is no exact target role every attempt has `positionFit: null` and this falls
    // back to the pure priority-score ordering.
    attempts.sort((a, b) => {
      const at = a.positionFit ? POSITION_FIT_RANK[a.positionFit] : 99;
      const bt = b.positionFit ? POSITION_FIT_RANK[b.positionFit] : 99;
      if (at !== bt) return at - bt;
      return b.priorityScore - a.priorityScore;
    });
    const options = attempts.slice(0, MAX_OPTIONS_RETURNED).map(({ priorityScore: _priorityScore, ...option }) => option);

    return { success: true, vacatedPlayerId, vacatedPlayerName, vacatedRole, options };
  } finally {
    // Generating options must never leave a net change in the draft — the coach applies their
    // chosen option (or the original absence) as a separate, explicit action.
    await addPlayerToDraftMatch(matchId, vacatedPlayerId, vacatedRole);
  }
}

async function safeComputeIntegrity(matchRoundId: string) {
  try {
    return await computeRoundPlanIntegrity(matchRoundId);
  } catch {
    return null;
  }
}
