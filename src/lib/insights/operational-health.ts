import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import type { InsightFilters, OperationalHealthGroup, OperationalHealthEntry } from "./insights-types";
import { OPERATIONAL_HEALTH_LABELS, FINALISATION_CHECKPOINT_WINDOW_DAYS } from "./operational-health-helpers";

// I-007: Operational health — concrete grouped facts, no opaque composite score. Reuses the
// canonical computeRoundPlanIntegrity() engine for round-level signals rather than
// re-deriving squad-size/availability rules here (ARR-0004: don't duplicate selection-engine
// logic outside its owning module).
export async function getOperationalHealth(filters: InsightFilters): Promise<OperationalHealthGroup[]> {
  const ctx = await requireActorContext();
  const orgId = ctx.organisationId;

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId: filters.leagueSeasonId, organisationId: orgId },
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  const draftRoundIds = rounds.filter((r) => r.status === "DRAFT").map((r) => r.id);

  const incompleteLineups: OperationalHealthEntry[] = [];
  const availabilityConflicts: OperationalHealthEntry[] = [];
  const finalisationCheckpoints: OperationalHealthEntry[] = [];

  for (const roundId of draftRoundIds) {
    const integrity = await computeRoundPlanIntegrity(roundId);
    const round = roundById.get(roundId);
    for (const signal of integrity.signals) {
      const entry: OperationalHealthEntry = {
        id: signal.idempotencyKey,
        detail: signal.title,
        matchRoundId: roundId,
        matchRoundLabel: round?.name ?? roundId,
        matchId: signal.matchId,
      };
      if (signal.ruleCode === "SQUAD_BELOW_MINIMUM") incompleteLineups.push(entry);
      if (signal.ruleCode === "SELECTED_PLAYER_UNAVAILABLE") availabilityConflicts.push(entry);
    }
  }

  const now = new Date();
  const checkpointWindowMs = FINALISATION_CHECKPOINT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  for (const roundId of draftRoundIds) {
    const nearestMatch = await db.match.findFirst({
      where: { matchRoundId: roundId, organisationId: orgId, status: { not: "CANCELLED" } },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true },
    });
    if (nearestMatch && nearestMatch.startsAt.getTime() - now.getTime() <= checkpointWindowMs && nearestMatch.startsAt.getTime() >= now.getTime()) {
      const round = roundById.get(roundId);
      finalisationCheckpoints.push({
        id: `checkpoint-${roundId}`,
        detail: `${round?.name ?? roundId} has a match within ${FINALISATION_CHECKPOINT_WINDOW_DAYS} days and is still in draft`,
        matchRoundId: roundId,
        matchRoundLabel: round?.name ?? roundId,
      });
    }
  }

  const roundIds = rounds.map((r) => r.id);
  const matches = await db.match.findMany({
    where: { matchRoundId: { in: roundIds }, organisationId: orgId, status: { not: "CANCELLED" } },
    select: { id: true, startsAt: true, matchRoundId: true, team: { select: { id: true, name: true } } },
  });
  const pastMatches = matches.filter((m) => m.startsAt.getTime() < now.getTime());
  const pastMatchIds = pastMatches.map((m) => m.id);

  const completedReportMatchIds = new Set(
    (
      await db.postMatchReport.findMany({
        where: { matchId: { in: pastMatchIds }, organisationId: orgId, status: { in: ["REPORTED", "LOCKED"] } },
        select: { matchId: true },
      })
    ).map((r) => r.matchId),
  );
  const missingReports: OperationalHealthEntry[] = pastMatches
    .filter((m) => !completedReportMatchIds.has(m.id))
    .map((m) => ({
      id: `missing-report-${m.id}`,
      detail: `${m.team.name} — no completed post-match report`,
      matchId: m.id,
      matchRoundId: m.matchRoundId,
      matchRoundLabel: roundById.get(m.matchRoundId)?.name,
      teamId: m.team.id,
      teamName: m.team.name,
    }));

  const pendingReviews = await db.reviewRequest.findMany({
    where: { organisationId: orgId, status: "PENDING" },
    select: { id: true, targetType: true, targetId: true },
  });
  const unresolvedReviews: OperationalHealthEntry[] = pendingReviews.map((r) => ({
    id: r.id,
    detail: `${r.targetType === "EVENT_SQUAD" ? "Event squad" : "Match lineup"} review pending`,
  }));

  const expiringMemberships = await db.organisationMembership.findMany({
    where: {
      organisationId: orgId,
      role: "SUPPORT",
      expiresAt: { not: null, gte: now, lte: new Date(now.getTime() + checkpointWindowMs) },
    },
    select: { id: true, expiresAt: true, user: { select: { name: true } } },
  });
  const expiringSupportAccess: OperationalHealthEntry[] = expiringMemberships.map((m) => ({
    id: m.id,
    detail: `${m.user?.name ?? "Unknown"} — SUPPORT access expires ${m.expiresAt?.toISOString().slice(0, 10)}`,
  }));

  const invalidPaths = await db.rotationPath.findMany({
    where: { organisationId: orgId, active: true },
    select: { id: true, fromTeamId: true, toTeamId: true, fromTeam: { select: { name: true } } },
  });
  const invalidRotationPaths: OperationalHealthEntry[] = invalidPaths
    .filter((p) => p.fromTeamId === p.toTeamId)
    .map((p) => ({ id: p.id, detail: `Self-referencing rotation path on ${p.fromTeam.name}` }));

  const overdueMovementCandidates = await db.movementCandidate.findMany({
    where: {
      organisationId: orgId,
      status: "ACTIVE",
      reviewBy: { not: null, lt: now },
    },
    select: { id: true, player: { select: { firstName: true, lastName: true } } },
  });
  const staleAssignments: OperationalHealthEntry[] = overdueMovementCandidates.map((c) => ({
    id: c.id,
    detail: `${c.player.firstName}${c.player.lastName ? ` ${c.player.lastName}` : ""} — movement candidate review overdue`,
  }));

  const notGeneratedRoundIds = new Set(
    rounds.filter((r) => r.status === "DRAFT").map((r) => r.id),
  );
  const selectionCountsByRound = await db.selection.groupBy({
    by: ["matchRoundId"],
    where: { matchRoundId: { in: Array.from(notGeneratedRoundIds) }, organisationId: orgId },
    _count: { id: true },
  });
  const roundsWithSelections = new Set(selectionCountsByRound.map((r) => r.matchRoundId));
  const unownedUpcomingWork: OperationalHealthEntry[] = matches
    .filter((m) => m.startsAt.getTime() >= now.getTime() && notGeneratedRoundIds.has(m.matchRoundId) && !roundsWithSelections.has(m.matchRoundId))
    .map((m) => ({
      id: `unowned-${m.id}`,
      detail: `${m.team.name} — no draft selections generated yet`,
      matchId: m.id,
      matchRoundId: m.matchRoundId,
      matchRoundLabel: roundById.get(m.matchRoundId)?.name,
      teamId: m.team.id,
      teamName: m.team.name,
    }));

  const groups: { category: OperationalHealthGroup["category"]; entries: OperationalHealthEntry[] }[] = [
    { category: "incomplete_lineups", entries: incompleteLineups },
    { category: "stale_assignments", entries: staleAssignments },
    { category: "missing_reports", entries: missingReports },
    { category: "unresolved_reviews", entries: unresolvedReviews },
    { category: "unowned_upcoming_work", entries: unownedUpcomingWork },
    { category: "expiring_support_access", entries: expiringSupportAccess },
    { category: "availability_conflicts", entries: availabilityConflicts },
    { category: "invalid_rotation_paths", entries: invalidRotationPaths },
    { category: "finalisation_checkpoints", entries: finalisationCheckpoints },
  ];

  return groups.map((g) => ({
    category: g.category,
    label: OPERATIONAL_HEALTH_LABELS[g.category],
    count: g.entries.length,
    entries: g.entries,
  }));
}
