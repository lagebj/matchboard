import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import type { InsightFilters, PlayerCombinationRow } from "./insights-types";
import { pairKey, RECENT_ROUNDS_WINDOW } from "./player-combinations-helpers";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { aggregateSeasonCombinations, getSeasonCombinationEvidenceWithOpponents } from "@/lib/evidence/combination-aggregation";

// I-005: Player combinations. Frequency is not effectiveness (per spec) — this reports raw
// co-occurrence counts only, no derived "good pairing" judgement. When CombinationEvidence
// data exists for the league season, position-aware partnership data enriches the rows with
// time-based partnership type, minutes together, and confidence level.
export async function getPlayerCombinations(filters: InsightFilters): Promise<PlayerCombinationRow[]> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);
  const orgId = ctx.organisationId;

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId: filters.leagueSeasonId, organisationId: orgId },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const roundIds = rounds.map((r) => r.id);
  const recentRoundIds = new Set(rounds.slice(-RECENT_ROUNDS_WINDOW).map((r) => r.id));

  const playerFilter = filters.includeInactive
    ? { organisationId: orgId, removedAt: null }
    : { organisationId: orgId, active: true, removedAt: null };
  const players = await db.player.findMany({
    where: playerFilter,
    select: { id: true, firstName: true, lastName: true, primaryPosition: true },
  });
  const playerNameById = new Map(players.map((p) => [p.id, p.lastName ? `${p.firstName} ${p.lastName}` : p.firstName]));
  const playerPositionById = new Map(players.map((p) => [p.id, p.primaryPosition]));
  const validPlayerIds = new Set(players.map((p) => p.id));

  const selections = await db.selection.findMany({
    where: { matchRoundId: { in: roundIds }, organisationId: orgId, status: "FINALIZED", playerId: { in: [...validPlayerIds] } },
    select: { playerId: true, matchId: true, matchRoundId: true },
  });

  const selectionsByMatch = new Map<string, { playerId: string; matchRoundId: string }[]>();
  for (const s of selections) {
    const list = selectionsByMatch.get(s.matchId) ?? [];
    list.push(s);
    selectionsByMatch.set(s.matchId, list);
  }

  const matchIds = [...selectionsByMatch.keys()];
  const actuals = await db.postMatchPlayerActual.findMany({
    where: { organisationId: orgId, matchId: { in: matchIds }, attendanceStatus: "PRESENT", playerId: { in: [...validPlayerIds] } },
    select: { playerId: true, matchId: true },
  });
  const presentByMatch = new Map<string, Set<string>>();
  for (const a of actuals) {
    // ADR-0106: PostMatchPlayerActual.playerId is now nullable at the type level (a GuestPlayer
    // appearance uses guestPlayerId instead), but this query's own
    // `playerId: { in: [...validPlayerIds] } }` already excludes both nulls and guest-only rows
    // at the database level -- guarded here for type-safety, matching this file's own
    // player-combination scope (co-selection/co-appearance among tracked Players only).
    if (!a.playerId) continue;
    const set = presentByMatch.get(a.matchId) ?? new Set<string>();
    set.add(a.playerId);
    presentByMatch.set(a.matchId, set);
  }

  const coSelection = new Map<string, number>();
  const seasonTotal = new Map<string, number>();
  const recentTotal = new Map<string, number>();
  const realisedCoAppearance = new Map<string, number>();

  for (const [matchId, matchSelections] of selectionsByMatch) {
    for (let i = 0; i < matchSelections.length; i++) {
      for (let j = i + 1; j < matchSelections.length; j++) {
        const a = matchSelections[i]!;
        const b = matchSelections[j]!;
        if (a.playerId === b.playerId) continue;
        const key = pairKey(a.playerId, b.playerId);
        coSelection.set(key, (coSelection.get(key) ?? 0) + 1);
        seasonTotal.set(key, (seasonTotal.get(key) ?? 0) + 1);
        if (recentRoundIds.has(a.matchRoundId)) {
          recentTotal.set(key, (recentTotal.get(key) ?? 0) + 1);
        }
      }
    }

    const present = presentByMatch.get(matchId);
    if (present && present.size >= 2) {
      const presentIds = [...present];
      for (let i = 0; i < presentIds.length; i++) {
        for (let j = i + 1; j < presentIds.length; j++) {
          const key = pairKey(presentIds[i]!, presentIds[j]!);
          realisedCoAppearance.set(key, (realisedCoAppearance.get(key) ?? 0) + 1);
        }
      }
    }
  }

  // Enrich with CombinationEvidence when available (position-aware partnerships)
  const partnershipEnrichment = new Map<string, { subtype: string | null; minutes: number; confidence: "INSUFFICIENT" | "EMERGING" | "ESTABLISHED" }>();
  try {
    const { evidence, opponentByMatch } = await getSeasonCombinationEvidenceWithOpponents(filters.leagueSeasonId);
    if (evidence.length > 0) {
      const summaries = aggregateSeasonCombinations(evidence, opponentByMatch);
      for (const summary of summaries) {
        if (summary.family === "PARTNERSHIP" && summary.playerIds.length === 2) {
          const key = pairKey(summary.playerIds[0]!, summary.playerIds[1]!);
          partnershipEnrichment.set(key, {
            subtype: summary.subtype,
            minutes: summary.totalMinutesTogether,
            confidence: summary.confidence,
          });
        }
      }
    }
  } catch {
    // CombinationEvidence may not exist yet — fall back to co-selection-only data
  }

  const rows: PlayerCombinationRow[] = [];
  for (const [key, count] of coSelection) {
    const [playerAId, playerBId] = key.split(":") as [string, string];
    const positionA = playerPositionById.get(playerAId);
    const positionB = playerPositionById.get(playerBId);
    const enrichment = partnershipEnrichment.get(key);
    rows.push({
      playerAId,
      playerAName: playerNameById.get(playerAId) ?? playerAId,
      playerBId,
      playerBName: playerNameById.get(playerBId) ?? playerBId,
      coSelectionCount: count,
      realisedCoAppearanceCount: realisedCoAppearance.get(key) ?? 0,
      positionPairing: positionA && positionB ? `${positionA} + ${positionB}` : null,
      seasonTotal: seasonTotal.get(key) ?? 0,
      recentTotal: recentTotal.get(key) ?? 0,
      partnershipSubtype: enrichment?.subtype ?? null,
      minutesTogether: enrichment?.minutes,
      confidence: enrichment?.confidence,
    });
  }

  return rows.sort((a, b) => b.coSelectionCount - a.coSelectionCount);
}
