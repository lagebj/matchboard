import "server-only";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { buildPlayerPreparationSummaries } from "./player-context";
import { buildCombinationContext } from "./combination-context";
import { buildOpponentContext } from "./opponent-context";
import { buildTeamHistoryContext } from "./team-history-context";
import type { CurrentPlanInput, MatchInsightFact, MatchInsightFactBundle } from "./types";

/**
 * Composes every domain-layer fact source into one `MatchInsightFactBundle` (ADR-0149 Decision
 * 4). This is the single orchestrator both a future Match Insights view-model (PR 4) and
 * `match-prep.ts`'s AI context builder (PR 3) call — the facts a coach sees deterministically and
 * the facts the AI is grounded in are the same facts, computed once.
 *
 * Every `evidenceRefs` entry follows `match-prep.ts`'s existing `fact:<category>:<ref>[:<sub>]`
 * shape (`contracts.ts`'s `EVIDENCE_REF_PATTERN`) so these facts can be cited directly by a future
 * AI context without a second ref-naming scheme.
 */

function factRefKey(...parts: string[]): string {
  return parts.join(":");
}

export async function buildMatchInsightFacts(
  plan: CurrentPlanInput,
  orgFilter: OrgFilterMode,
): Promise<MatchInsightFactBundle> {
  // ADR-0151: Collect player IDs from the operational roster (active participants only),
  // not just the planned squad. This ensures match-day additions are included in insight
  // computation and absent players are excluded from active-participant reasoning.
  // The planned squad remains available for comparison/historical reasoning via plan.squad.
  const playerIdSet = new Set<string>();
  const activePlayerIds = new Set<string>();
  const absentPlayerIds = new Set<string>();
  const matchDayAdditionPlayerIds = new Set<string>();

  for (const entry of plan.operationalRoster) {
    if (entry.participantType === "PLAYER" && entry.playerId) {
      playerIdSet.add(entry.playerId);
      if (entry.isActiveParticipant) {
        activePlayerIds.add(entry.playerId);
      } else {
        absentPlayerIds.add(entry.playerId);
      }
      if (entry.source === "match_day_addition") {
        matchDayAdditionPlayerIds.add(entry.playerId);
      }
    }
  }
  // Also include rotation player IDs
  for (const change of plan.plannedRotations) {
    if (change.outPlayerId) playerIdSet.add(change.outPlayerId);
    if (change.inPlayerId) playerIdSet.add(change.inPlayerId);
  }
  const playerIds = [...playerIdSet].sort();

  // ADR-0151: Use operational roster's active CORE players for combination context
  // (absent players should not be part of combination reasoning for the upcoming match)
  const activeCoreSquad = plan.operationalRoster
    .filter((e) => e.isActiveParticipant && e.participantType === "PLAYER" && e.role === "CORE")
    .map((e) => e.playerId!)
    .filter((id): id is string => id !== null);

  const activeSquad = plan.operationalRoster
    .filter((e) => e.isActiveParticipant && e.participantType === "PLAYER" && e.playerId)
    .map((e) => ({ playerId: e.playerId!, role: e.role ?? "SUPPORT" as const, position: e.position }));

  const [playerSummaries, combinationResult, opponentContext, teamHistory] = await Promise.all([
    buildPlayerPreparationSummaries({
      playerIds,
      leagueSeasonId: plan.leagueSeasonId,
      organisationId: plan.organisationId,
      orgFilter,
    }),
    buildCombinationContext({ leagueSeasonId: plan.leagueSeasonId, currentSquad: activeSquad }),
    buildOpponentContext({
      opponentTeamId: plan.opponentTeamId,
      organisationId: plan.organisationId,
      excludeMatchId: plan.matchId,
    }),
    buildTeamHistoryContext({
      teamId: plan.teamId,
      organisationId: plan.organisationId,
      excludeMatchId: plan.matchId,
      matchStartsAt: plan.matchStartsAt,
      currentFormation: plan.formation,
      currentCoreSquad: activeCoreSquad,
    }),
  ]);

  const facts: MatchInsightFact[] = [];
  const planByPlayer = new Map(plan.squad.map((s) => [s.playerId, s]));

  for (const playerId of playerIds) {
    const summary = playerSummaries.get(playerId);
    if (!summary) continue;
    const planned = planByPlayer.get(playerId);

    if (summary.recent.matchesConsidered > 0) {
      const ref = factRefKey("fact", "starting-pattern", playerId);
      facts.push({
        id: factRefKey("starting-pattern", playerId),
        type: "STARTING_PATTERN",
        subjectRefs: [playerId],
        period: { kind: "RECENT_MATCHES", count: summary.recent.matchesConsidered },
        value: {
          starts: summary.recent.starts,
          matchesConsidered: summary.recent.matchesConsidered,
          minutes: summary.recent.minutes,
          plannedRole: planned?.role ?? null,
        },
        sample: { matches: summary.recent.matchesConsidered, starts: summary.recent.starts, minutes: summary.recent.minutes },
        evidenceRefs: [ref],
        deterministicPriority: summary.recent.starts === 0 && planned?.role === "CORE" ? 90 : 40,
        confidence: summary.recent.matchesConsidered >= 4 ? "HIGH" : summary.recent.matchesConsidered >= 2 ? "MEDIUM" : "LOW",
      });
    }

    if (planned?.position) {
      const declared = summary.declaredPositions;
      const isDeclaredPosition =
        planned.position === declared.primary || planned.position === declared.secondary || planned.position === declared.tertiary;
      const ref = factRefKey("fact", "position-pattern", playerId);
      facts.push({
        id: factRefKey("position-pattern", playerId),
        type: "POSITION_PATTERN",
        subjectRefs: [playerId],
        value: { plannedPosition: planned.position, declaredPositions: declared, isDeclaredPosition },
        evidenceRefs: [ref],
        deterministicPriority: isDeclaredPosition ? 20 : 70,
      });

      const evidenceEntry = summary.positionEvidence.find((e) => e.position === planned.position);
      const exposureRef = factRefKey("fact", "position-exposure", playerId);
      facts.push({
        id: factRefKey("position-exposure", playerId),
        type: "POSITION_EXPOSURE",
        subjectRefs: [playerId],
        value: { position: planned.position, minutes: evidenceEntry?.minutes ?? 0 },
        sample: { minutes: evidenceEntry?.minutes ?? 0 },
        evidenceRefs: [exposureRef],
        deterministicPriority: evidenceEntry ? 30 : 60,
        confidence: evidenceEntry?.confidence ?? "LOW",
      });
    }

    facts.push({
      id: factRefKey("attribute-profile", playerId),
      type: "ATTRIBUTE_PROFILE",
      subjectRefs: [playerId],
      value: { ...summary.attributes },
      evidenceRefs: [factRefKey("fact", "attribute-profile", playerId)],
      deterministicPriority: 10,
    });

    if (summary.season.goals > 0 || summary.season.assists > 0) {
      facts.push({
        id: factRefKey("goal-involvement", playerId),
        type: "GOAL_INVOLVEMENT",
        subjectRefs: [playerId],
        period: { kind: "SEASON" },
        value: { goals: summary.season.goals, assists: summary.season.assists, appearances: summary.season.appearances },
        evidenceRefs: [factRefKey("fact", "goal-involvement", playerId)],
        deterministicPriority: 25,
      });
    }

    if (summary.development.length > 0) {
      facts.push({
        id: factRefKey("development-context", playerId),
        type: "DEVELOPMENT_CONTEXT",
        subjectRefs: [playerId],
        value: { categories: summary.development.map((d) => d.category) },
        evidenceRefs: [factRefKey("fact", "development-context", playerId)],
        deterministicPriority: 35,
      });
    }
  }

  for (const pair of combinationResult.insightInput.establishedPartnerships) {
    const [a, b] = pair.playerIds;
    facts.push({
      id: factRefKey("starts-together", a, b),
      type: "STARTS_TOGETHER",
      subjectRefs: [a, b],
      period: { kind: "SEASON" },
      value: { family: pair.family, subtype: pair.subtype, minutesTogether: pair.totalMinutesTogether, matchCount: pair.matchCount },
      sample: { matches: pair.matchCount, minutes: pair.totalMinutesTogether },
      evidenceRefs: [factRefKey("fact", "starts-together", a, b)],
      deterministicPriority: pair.confidence === "ESTABLISHED" ? 45 : 30,
      confidence: pair.confidence === "ESTABLISHED" ? "HIGH" : "MEDIUM",
    });
  }

  for (const pair of combinationResult.insightInput.goalCombinations) {
    const [a, b] = pair.playerIds;
    facts.push({
      id: factRefKey("goal-combination", a, b),
      type: "GOAL_COMBINATION",
      subjectRefs: [a, b],
      value: {
        goalsForTotal: pair.goalsForTotal,
        directGoalContributionsTotal: pair.directGoalContributionsTotal,
        directAssistContributionsTotal: pair.directAssistContributionsTotal,
      },
      evidenceRefs: [factRefKey("fact", "goal-combination", a, b)],
      deterministicPriority: 50,
    });
  }

  for (const [a, b] of combinationResult.insightInput.newCombinations) {
    facts.push({
      id: factRefKey("new-combination", a, b),
      type: "NEW_COMBINATION",
      subjectRefs: [a, b],
      value: { position: planByPlayer.get(a)?.position ?? null },
      evidenceRefs: [factRefKey("fact", "new-combination", a, b)],
      deterministicPriority: 65,
    });
  }

  if (opponentContext.exactOpponentHistoryAvailable) {
    facts.push({
      id: factRefKey("opponent-encounter", plan.matchId),
      type: "OPPONENT_ENCOUNTER",
      subjectRefs: [plan.matchId],
      period: { kind: "PREVIOUS_ENCOUNTERS", count: opponentContext.previousEncounterCount },
      value: {
        encounters: opponentContext.previousEncounters.map((e) => ({
          matchId: e.matchId,
          occurredAt: e.occurredAt.toISOString(),
          goalsFor: e.goalsFor,
          goalsAgainst: e.goalsAgainst,
          formation: e.formation,
        })),
      },
      sample: { matches: opponentContext.previousEncounterCount },
      evidenceRefs: [factRefKey("fact", "opponent-encounter", plan.matchId)],
      deterministicPriority: 85,
      confidence: opponentContext.previousEncounterCount >= 2 ? "HIGH" : "MEDIUM",
    });

    for (const encounter of opponentContext.previousEncounters) {
      if (!encounter.overallEnvironment && !encounter.trustedObservation) continue;
      facts.push({
        id: factRefKey("opponent-observation", encounter.matchId),
        type: "OPPONENT_OBSERVATION",
        subjectRefs: [encounter.matchId],
        value: {
          overallEnvironment: encounter.overallEnvironment,
          sportingLevel: encounter.sportingLevel,
          playingStyleTags: encounter.playingStyleTags,
          concernCategories: encounter.concernCategories,
          trustedObservation: encounter.trustedObservation,
        },
        evidenceRefs: [factRefKey("fact", "opponent-observation", encounter.matchId)],
        deterministicPriority: 80,
      });
    }

    if (opponentContext.establishedCombinationsAgainstOpponent.length > 0) {
      facts.push({
        id: factRefKey("opponent-trend", plan.matchId),
        type: "OPPONENT_TREND",
        subjectRefs: [...new Set(opponentContext.establishedCombinationsAgainstOpponent.flatMap((c) => c.playerIds))],
        value: { combinations: opponentContext.establishedCombinationsAgainstOpponent },
        evidenceRefs: [factRefKey("fact", "opponent-trend", plan.matchId)],
        deterministicPriority: 55,
      });
    }
  }

  if (teamHistory.formationFamiliarity) {
    facts.push({
      id: factRefKey("formation-pattern", plan.matchId),
      type: "FORMATION_PATTERN",
      subjectRefs: [plan.matchId],
      value: teamHistory.formationFamiliarity,
      sample: { matches: teamHistory.formationFamiliarity.windowSize },
      evidenceRefs: [factRefKey("fact", "formation-pattern", plan.matchId)],
      deterministicPriority: 15,
    });
  }

  if (teamHistory.lineupContinuity?.previousMatchId) {
    facts.push({
      id: factRefKey("lineup-continuity", plan.matchId),
      type: "LINEUP_CONTINUITY",
      subjectRefs: [plan.matchId],
      value: teamHistory.lineupContinuity,
      evidenceRefs: [factRefKey("fact", "lineup-continuity", plan.matchId)],
      deterministicPriority: teamHistory.lineupContinuity.changedPlayerCount >= 3 ? 55 : 20,
    });
  }

  for (const change of plan.plannedRotations) {
    const inSummary = change.inPlayerId ? playerSummaries.get(change.inPlayerId) : undefined;
    const subjectRefs = [change.outPlayerId, change.inPlayerId].filter((id): id is string => Boolean(id));
    if (subjectRefs.length === 0) continue;
    facts.push({
      id: factRefKey("rotation-context", String(change.sequence)),
      type: "ROTATION_CONTEXT",
      subjectRefs,
      value: {
        sequence: change.sequence,
        outPlayerId: change.outPlayerId,
        inPlayerId: change.inPlayerId,
        outPosition: change.outPosition,
        inPosition: change.inPosition,
        inboundRecentStarts: inSummary?.recent.starts ?? null,
      },
      evidenceRefs: [factRefKey("fact", "rotation-context", String(change.sequence))],
      deterministicPriority: inSummary && inSummary.recent.starts === 0 ? 50 : 15,
    });
  }

  // ADR-0151: MATCH_AVAILABILITY facts for absent planned players
  for (const playerId of absentPlayerIds) {
    const entry = plan.operationalRoster.find(
      (e) => e.playerId === playerId && e.source === "planned",
    );
    if (!entry) continue;
    facts.push({
      id: factRefKey("match-availability", playerId),
      type: "MATCH_AVAILABILITY",
      subjectRefs: [playerId],
      value: {
        available: false,
        absenceReason: entry.absenceReason,
        plannedRole: entry.role,
      },
      evidenceRefs: [factRefKey("fact", "match-availability", playerId)],
      deterministicPriority: 95,
    });
  }

  // ADR-0151: MATCH_DAY_ADDITION facts for players added on match day
  for (const playerId of matchDayAdditionPlayerIds) {
    const entry = plan.operationalRoster.find(
      (e) => e.playerId === playerId && e.source === "match_day_addition",
    );
    if (!entry) continue;
    facts.push({
      id: factRefKey("match-day-addition", playerId),
      type: "MATCH_DAY_ADDITION",
      subjectRefs: [playerId],
      value: {
        position: entry.position,
        role: entry.role,
      },
      evidenceRefs: [factRefKey("fact", "match-day-addition", playerId)],
      deterministicPriority: 80,
    });
  }

  // ADR-0151: Player preparation summaries must include match-day additions
  // (already handled: playerIdSet includes all operational roster players)

  // ADR-0151: Active-participant reasoning uses operationalRoster, not squad
  // The combination and lineup calculations below already use playerIds from the operational
  // roster, which includes additions and excludes absences from active reasoning.
  // Historical plan comparisons still use plan.squad where appropriate.

  return { facts, playerSummaries, opponentContext, teamHistory, pairCombinations: combinationResult.pairCombinations };
}
