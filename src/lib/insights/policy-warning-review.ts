import "server-only";

import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import type {
  InsightFilters,
  PolicyWarningEntry,
  PolicyWarningGroup,
  PolicyWarningSource,
} from "./insights-types";
import { classifyWarningSeverity } from "./policy-warning-review-helpers";

export async function getPolicyWarningReview(
  filters: InsightFilters,
): Promise<PolicyWarningGroup[]> {
  await requireCoachAccess();

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId: filters.leagueSeasonId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const roundIds = rounds.map((r) => r.id);

  const warnings = await db.warning.findMany({
    where: {
      matchRoundId: { in: roundIds },
      resolved: false,
    },
    select: {
      id: true,
      matchRoundId: true,
      matchId: true,
      playerId: true,
      teamId: true,
      severity: true,
      rule: true,
      message: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const playerIds = [...new Set(warnings.filter((w) => w.playerId).map((w) => w.playerId!))];
  const teamIds = [...new Set(warnings.filter((w) => w.teamId).map((w) => w.teamId!))];
  const matchIds = [...new Set(warnings.filter((w) => w.matchId).map((w) => w.matchId!))];

  const players = playerIds.length > 0
    ? await db.player.findMany({
        where: { id: { in: playerIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];

  const teams = teamIds.length > 0
    ? await db.team.findMany({
        where: { id: { in: teamIds } },
        select: { id: true, name: true },
      })
    : [];

  const matches = matchIds.length > 0
    ? await db.match.findMany({
        where: { id: { in: matchIds } },
        select: { id: true, teamId: true, team: { select: { name: true } } },
      })
    : [];

  const playerMap = new Map(players.map((p) => [p.id, p.firstName + (p.lastName ? " " + p.lastName : "")]));
  const teamMap = new Map(teams.map((t) => [t.id, t.name]));
  const matchMap = new Map(matches.map((m) => [m.id, { teamId: m.teamId, teamName: m.team.name }]));

  const sourceLabel: Record<string, string> = {
    core_invariant: "Core invariant",
    default_policy: "Matchboard policy",
    custom_policy: "Custom policy",
    solver_validation: "Solver validation",
  };

  const entries: PolicyWarningEntry[] = warnings.map((w) => {
    const severity = classifyWarningSeverity(w.severity, w.rule);
    const _matchInfo = w.matchId ? matchMap.get(w.matchId) : undefined;

    let source: PolicyWarningSource = "default_policy";
    if (["player_in_multiple_matches", "duplicate_player_in_match", "invariant_invalid_non_core_selection", "duplicate_planned_assignment_integrity_failure"].includes(w.rule)) {
      source = "core_invariant";
    } else if (w.rule.startsWith("policy_") || w.rule.startsWith("rego_")) {
      source = "custom_policy";
    }

    return {
      code: w.rule,
      severity,
      source,
      sourceLabel: sourceLabel[source] ?? "Unknown",
      message: w.message,
      playerId: w.playerId ?? undefined,
      playerName: w.playerId ? playerMap.get(w.playerId) : undefined,
      teamId: w.teamId ?? undefined,
      teamName: w.teamId ? teamMap.get(w.teamId) : undefined,
      matchId: w.matchId ?? undefined,
      matchRoundId: w.matchRoundId,
    };
  });

  const groupMap = new Map<string, PolicyWarningGroup>();
  for (const entry of entries) {
    if (!groupMap.has(entry.code)) {
      groupMap.set(entry.code, {
        code: entry.code,
        label: entry.message || entry.code,
        count: 0,
        entries: [],
      });
    }
    const group = groupMap.get(entry.code)!;
    group.count++;
    group.entries.push(entry);
  }

  return [...groupMap.values()].sort((a, b) => {
    const severityOrder = { blocked: 0, decision_required: 1, planning_note: 2 };
    const aSeverity = entries.find((e) => e.code === a.code)?.severity ?? "planning_note";
    const bSeverity = entries.find((e) => e.code === b.code)?.severity ?? "planning_note";
    return (severityOrder[aSeverity] ?? 2) - (severityOrder[bSeverity] ?? 2);
  });
}