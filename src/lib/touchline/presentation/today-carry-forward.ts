/**
 * Today "Carry forward" compact context-rail adapter (ADR-0142
 * `02_PRODUCTION_COMPOSITION_CONTRACT.md` "Carry forward"). A Today-specific compact view over
 * `WeeklyCoachingContextResult` — never the full-width `WeeklyCoachingContextSection`. Priority
 * order, capped at three rail items total:
 *   1. incomplete older reports;
 *   2. named weekly opportunity exceptions;
 *   3. planned-but-absent exceptions;
 *   4. other concrete unresolved weekly context (unplanned appearances / support movement / no
 *      recorded appearance).
 *
 * Pure and DB-free — every fact comes from the already-loaded `WeeklyCoachingContextResult`.
 */

import type { WeeklyCoachingContextResult } from "@/lib/weekly/weekly-coaching-context-types";

export type TodayCarryForwardItem = {
  id: string;
  label: string;
  href: string;
};

const MAX_CARRY_FORWARD_ITEMS = 3;

export function buildTodayCarryForwardItems(
  result: WeeklyCoachingContextResult | null | undefined,
): TodayCarryForwardItem[] {
  if (!result) return [];
  const { context, playerDisplayById, matchDisplayById } = result;
  const items: TodayCarryForwardItem[] = [];

  // 1. incomplete older reports.
  for (const matchId of [...context.reporting.incompleteLeagueMatchIds, ...context.reporting.incompleteEventMatchIds]) {
    const match = matchDisplayById[matchId];
    items.push({
      id: `report:${matchId}`,
      label: match ? `Report still needed — ${match.label}` : "Report still needed.",
      href: match?.href ?? "#",
    });
  }

  // 2. named weekly opportunity exceptions.
  for (const playerId of context.opportunity.availableWithoutPlannedLeagueOpportunityPlayerIds) {
    const player = playerDisplayById[playerId];
    if (!player) continue;
    items.push({
      id: `opportunity:${playerId}`,
      label: `${player.displayName} — no planned opportunity this week.`,
      href: player.href,
    });
  }

  // 3. planned-but-absent exceptions.
  for (const entry of context.planActual.plannedButAbsent) {
    const player = playerDisplayById[entry.playerId];
    const match = matchDisplayById[entry.matchId];
    if (!player) continue;
    items.push({
      id: `absent:${entry.playerId}:${entry.matchId}`,
      label: match ? `${player.displayName} — planned but absent, ${match.label}.` : `${player.displayName} — planned but absent.`,
      href: player.href,
    });
  }

  // 4. other concrete unresolved weekly context.
  for (const entry of context.planActual.unplannedAppearances) {
    const player = playerDisplayById[entry.playerId];
    const match = matchDisplayById[entry.matchId];
    if (!player) continue;
    items.push({
      id: `unplanned:${entry.playerId}:${entry.matchId}`,
      label: match ? `${player.displayName} — unplanned appearance, ${match.label}.` : `${player.displayName} — unplanned appearance.`,
      href: player.href,
    });
  }
  for (const entry of context.movement.supportAppearances) {
    const player = playerDisplayById[entry.playerId];
    if (!player) continue;
    items.push({
      id: `support:${entry.playerId}:${entry.matchId}`,
      label: `${player.displayName} — supported another team this week.`,
      href: player.href,
    });
  }
  if (context.noRecordedAppearance) {
    for (const playerId of context.noRecordedAppearance.playerIds) {
      const player = playerDisplayById[playerId];
      if (!player) continue;
      items.push({
        id: `no-appearance:${playerId}`,
        label: `${player.displayName} — no recorded appearance this week.`,
        href: player.href,
      });
    }
  }

  return items.slice(0, MAX_CARRY_FORWARD_ITEMS);
}
