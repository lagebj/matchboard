/**
 * Batched Today selection-recommendation data loader (ADR-0141,
 * `03_DATA_AND_RECOMMENDATION_CONTRACT.md` "Recommendation data loader"). Extracts
 * `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY` plan-integrity signals from the already-computed
 * `roundPlanIntegrities` the route/command-centre loaded, then does exactly one batched query per
 * fact family (players, matches, rotation paths, round names, round-scoped availability) before
 * handing everything to the pure `planTodaySelectionRecommendations()`. Returns `[]` and issues
 * no recommendation-specific query when there are no missing-opportunity signals.
 */

import { db } from "@/lib/db";
import type { AvailabilityStatus } from "@/generated/prisma/client";
import type { RoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import { idempotencyKeyFromCandidateId } from "@/lib/situational/providers/plan-integrity-candidate-provider";
import { loadRotationPathEdgesWithGroupPaths } from "@/lib/selection/load-rotation-paths";
import { getRoundAvailabilityResolver } from "@/lib/selection/round-availability";
import { isPlanningBoundaryClosed } from "@/lib/selection/planning-boundary";
import type { CoachDecision } from "@/lib/situational/situation-types";
import {
  planTodaySelectionRecommendations,
  type TodayCandidateDestinationMatch,
  type TodayMissingOpportunityCandidate,
  type TodaySelectionDecision,
} from "@/lib/touchline/presentation/today-selection-recommendation-plan";

const AVAILABILITY_MAP: Record<string, "AVAILABLE" | "TENTATIVE" | "UNAVAILABLE"> = {
  AVAILABLE: "AVAILABLE",
  TENTATIVE: "TENTATIVE",
};

function toTodayAvailability(status: AvailabilityStatus | string): "AVAILABLE" | "TENTATIVE" | "UNAVAILABLE" {
  return AVAILABILITY_MAP[status] ?? "UNAVAILABLE";
}

export async function getTodaySelectionRecommendations(
  organisationId: string,
  roundPlanIntegrities: Record<string, RoundPlanIntegrity>,
  orgSlug: string,
  projectionDecisions: CoachDecision[],
): Promise<TodaySelectionDecision[]> {
  const missingOpportunitySignals = Object.values(roundPlanIntegrities).flatMap((integrity) =>
    integrity.signals
      .filter((s) => s.ruleCode === "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY" && s.playerId)
      .map((s) => ({ signal: s, matchRoundId: integrity.matchRoundId })),
  );

  if (missingOpportunitySignals.length === 0) return [];

  const roundIds = [...new Set(missingOpportunitySignals.map((s) => s.matchRoundId))];
  const playerIds = [...new Set(missingOpportunitySignals.map((s) => s.signal.playerId!))];

  const [players, rounds, matches, rotationPathEdges] = await Promise.all([
    db.player.findMany({
      where: { id: { in: playerIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        coreTeamId: true,
        removedAt: true,
        currentAvailability: true,
      },
    }),
    db.matchRound.findMany({
      where: { id: { in: roundIds } },
      select: { id: true, name: true, status: true },
    }),
    db.match.findMany({
      where: { matchRoundId: { in: roundIds }, status: { not: "CANCELLED" } },
      select: {
        id: true,
        matchRoundId: true,
        teamId: true,
        opponent: true,
        startsAt: true,
        status: true,
        planningClosedAt: true,
        team: { select: { name: true, kitColor: true, targetSquadSize: true } },
        liveSession: { select: { status: true } },
        selections: { where: { status: "DRAFT" }, select: { playerId: true } },
      },
    }),
    loadRotationPathEdgesWithGroupPaths(organisationId, { scope: "MATCH" }),
  ]);

  const playerById = new Map(players.map((p) => [p.id, p]));
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  const matchesByRoundId = new Map<string, typeof matches>();
  for (const m of matches) {
    const list = matchesByRoundId.get(m.matchRoundId) ?? [];
    list.push(m);
    matchesByRoundId.set(m.matchRoundId, list);
  }

  // One round-availability resolver per round (LIVE case needs no query — Today's round is
  // virtually never FINALIZED, and even when it is, the resolver itself batches).
  const resolverByRoundId = new Map<string, Awaited<ReturnType<typeof getRoundAvailabilityResolver>>>();
  const liveAvailabilityByPlayerId = new Map<string, AvailabilityStatus | string>(
    players.map((p) => [p.id, p.currentAvailability]),
  );
  for (const roundId of roundIds) {
    const round = roundById.get(roundId);
    resolverByRoundId.set(
      roundId,
      await getRoundAvailabilityResolver(roundId, round?.status ?? "DRAFT", liveAvailabilityByPlayerId),
    );
  }

  const now = new Date();

  // Map a plan-integrity signal's idempotency key to the situational projection's decision order,
  // when the projection also represents it (decision order rule 1).
  const projectionOrderBySignalKey = new Map<string, number>();
  projectionDecisions.forEach((decision, index) => {
    const key = idempotencyKeyFromCandidateId(decision.candidateId);
    if (key && !projectionOrderBySignalKey.has(key)) {
      projectionOrderBySignalKey.set(key, index);
    }
  });

  const candidates: TodayMissingOpportunityCandidate[] = [];

  for (const { signal, matchRoundId } of missingOpportunitySignals) {
    const player = playerById.get(signal.playerId!);
    if (!player || player.removedAt) continue;

    const round = roundById.get(matchRoundId);
    const roundMatches = matchesByRoundId.get(matchRoundId) ?? [];
    const availability = resolverByRoundId.get(matchRoundId)!.resolve(player.id);

    const hasSameRoundAssignment = roundMatches.some((m) =>
      m.selections.some((sel) => sel.playerId === player.id),
    );

    const candidateMatches: TodayCandidateDestinationMatch[] = roundMatches.map((m) => {
      const isCoreTeam = player.coreTeamId === m.teamId;
      const activePathRoles = [
        ...new Set(
          rotationPathEdges
            .filter((e) => e.fromTeamId === player.coreTeamId && e.toTeamId === m.teamId && e.active)
            .map((e) => e.role),
        ),
      ];
      const boundary = isPlanningBoundaryClosed({
        matchStatus: m.status,
        startsAt: m.startsAt,
        planningClosedAt: m.planningClosedAt,
        liveSessionStatus: m.liveSession?.status ?? null,
        now,
      });

      return {
        matchId: m.id,
        teamId: m.teamId,
        teamName: m.team.name,
        teamKitColor: m.team.kitColor,
        opponentName: m.opponent,
        targetSquadSize: m.team.targetSquadSize,
        currentSquadCount: m.selections.length,
        isCoreTeam,
        activePathRoles,
        planningOpen: boundary.editable,
      };
    });

    candidates.push({
      signalKey: signal.idempotencyKey,
      playerId: player.id,
      displayName: `${player.firstName}${player.lastName ? ` ${player.lastName}` : ""}`,
      availability: toTodayAvailability(availability.status),
      isActive: !player.removedAt,
      coreTeamId: player.coreTeamId,
      matchRoundId,
      roundLabel: round?.name ?? "this round",
      roundBoardHref: `/o/${orgSlug}/rounds/${matchRoundId}`,
      hasSameRoundAssignment,
      repeatedMissedRoundCount: signal.repeatedContext?.earlierMissedRoundCount ?? 0,
      candidateMatches,
      projectionOrderIndex: projectionOrderBySignalKey.get(signal.idempotencyKey) ?? null,
    });
  }

  return planTodaySelectionRecommendations(candidates);
}
