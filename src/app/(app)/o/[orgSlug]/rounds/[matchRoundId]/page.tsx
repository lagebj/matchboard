export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { RoundBoard } from "@/components/round/round-board";
import { CoachingIntentSelector } from "@/components/matches/coaching-intent-selector";
import type { PlayerInMatch } from "@/lib/round-types";
import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { formatIsoWeekLabel } from "@/lib/date-utils";
import { formatPlayerName } from "@/lib/player-metrics";
import { COACHING_INTENT_LABELS } from "@/lib/coaching/types";
import type { CoachingIntentCategory } from "@/lib/coaching/types";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import { WarningSeverity } from "@/generated/prisma/client";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

type RoundBoardPageProps = {
  params: Promise<{
    orgSlug: string;
    matchRoundId: string;
  }>;
  searchParams: Promise<{
    finalized?: string;
    generated?: string;
    error?: string;
  }>;
};

export default async function RoundBoardPage({
  params,
  searchParams,
}: RoundBoardPageProps) {
  const { orgSlug, matchRoundId } = await params;
  const { finalized, generated, error } = await searchParams;

  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const orgWhere = ctx.orgFilter.filter;

  const matchRound = await db.matchRound.findUnique({
    where: { id: matchRoundId, ...orgWhere },
    include: {
      matches: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              targetSquadSize: true,
              minAcceptedSquadSize: true,
              minSupportPlayers: true,
              developmentSlots: true,
            },
          },
        },
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
       },
    },
  });

  if (!matchRound) {
    notFound();
  }

  const matchIds = matchRound.matches.map((m) => m.id);

  const [selections, allPlayers, rotationPaths, roundIntents, matchIntents, readinessSignalsRaw] = await Promise.all([
    db.selection.findMany({
      where: {
        matchId: { in: matchIds },
        status: { in: ["DRAFT", "FINALIZED"] },
        ...orgWhere,
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            primaryPosition: true,
            coreTeamId: true,
            nonRotatable: true,
            currentAvailability: true,
            coreTeam: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ role: "asc" }],
    }),
    db.player.findMany({
      where: {
        active: true,
        removedAt: null,
        currentAvailability: {
          in: ["INJURED", "SICK", "AWAY"],
        },
        ...orgWhere,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        coreTeamId: true,
        currentAvailability: true,
        coreTeam: { select: { id: true, name: true } },
      },
    }),
    db.rotationPath.findMany({
      where: { active: true, ...orgWhere },
      select: {
        fromTeamId: true,
        toTeamId: true,
        role: true,
      },
    }),
    db.coachingIntent.findMany({
      where: { scopeType: "MATCH_ROUND", scopeId: matchRoundId, ...orgWhere },
      orderBy: { createdAt: "desc" },
      select: { id: true, category: true, scopeType: true, scopeId: true },
    }),
    db.coachingIntent.findMany({
      where: { scopeType: "MATCH", scopeId: { in: matchIds }, ...orgWhere },
      orderBy: { createdAt: "desc" },
      select: { id: true, category: true, scopeType: true, scopeId: true },
    }),
    db.playerReadinessSignal.findMany({
      where: { value: { in: ["FALLING", "LOW", "NEEDS_ATTENTION"] }, ...orgWhere },
      select: { playerId: true, signalType: true, value: true },
    }),
  ]);

  const eligiblePlayers = await db.player.findMany({
    where: {
      active: true,
      removedAt: null,
      ...orgWhere,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      coreTeamId: true,
      primaryPosition: true,
      coreTeam: { select: { id: true, name: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const playerNegativeReadiness = new Map<string, string[]>();
  const READINESS_SIGNAL_LABELS: Record<string, string> = {
    EFFORT_TREND: "Effort ↓",
    ATTENDANCE_RELIABILITY: "Attendance ↓",
    LEARNING_BEHAVIOR: "Learning ↓",
    TEAM_FIRST_BEHAVIOR: "Team-first ↓",
    RESET_AFTER_ERROR_RELIABILITY: "Reset ↓",
    COACH_TRUST: "Trust ↓",
  };
  for (const rs of readinessSignalsRaw) {
    const labels = playerNegativeReadiness.get(rs.playerId) ?? [];
    const label = READINESS_SIGNAL_LABELS[rs.signalType] ?? rs.signalType;
    labels.push(label);
    playerNegativeReadiness.set(rs.playerId, labels);
  }

  const availablePlayerList = eligiblePlayers.map((p) => ({
    id: p.id,
    name: formatPlayerName(p),
    coreTeamName: p.coreTeam?.name ?? "Unassigned",
    coreTeamId: p.coreTeamId ?? "",
    primaryPosition: p.primaryPosition,
  }));

  const selectionsByMatchId = new Map<string, typeof selections>();
  for (const sel of selections) {
    const existing = selectionsByMatchId.get(sel.matchId) ?? [];
    existing.push(sel);
    selectionsByMatchId.set(sel.matchId, existing);
  }

  const roundLabel = matchRound.matches.length > 0
    ? formatIsoWeekLabel(matchRound.matches[0]!.startsAt)
    : matchRound.name;

  const supportSentByTeamId = new Map<string, number>();
  const supportReceivedByTeamId = new Map<string, number>();
  const devSentByTeamId = new Map<string, number>();
  const devReceivedByTeamId = new Map<string, number>();
  const squadRepairReceivedByTeamId = new Map<string, number>();
  const dropsCountByTeamId = new Map<string, number>();

  const FLOATING_ROLES = new Set(["SUPPORT", "BACKFILL", "DEVELOPMENT", "CONFIDENCE_REBUILD"]);
  let crossTeamMoverCount = 0;
  for (const sel of selections) {
    if (FLOATING_ROLES.has(sel.role)) {
      const match = matchRound.matches.find((m) => m.id === sel.matchId);
      if (match && sel.player.coreTeamId !== match.teamId) {
        crossTeamMoverCount++;
      }
    }
  }
  for (const sel of selections) {
    if (sel.role === "SUPPORT" && sel.player.coreTeamId) {
      supportSentByTeamId.set(sel.player.coreTeamId, (supportSentByTeamId.get(sel.player.coreTeamId) ?? 0) + 1);
      const match = matchRound.matches.find((m) => m.id === sel.matchId);
      if (match) {
        supportReceivedByTeamId.set(match.teamId, (supportReceivedByTeamId.get(match.teamId) ?? 0) + 1);
      }
    } else if (sel.role === "DEVELOPMENT" && sel.player.coreTeamId) {
      devSentByTeamId.set(sel.player.coreTeamId, (devSentByTeamId.get(sel.player.coreTeamId) ?? 0) + 1);
      const match = matchRound.matches.find((m) => m.id === sel.matchId);
      if (match) {
        devReceivedByTeamId.set(match.teamId, (devReceivedByTeamId.get(match.teamId) ?? 0) + 1);
      }
    } else if (sel.role === "BACKFILL") {
      const match = matchRound.matches.find((m) => m.id === sel.matchId);
      if (match) {
        squadRepairReceivedByTeamId.set(match.teamId, (squadRepairReceivedByTeamId.get(match.teamId) ?? 0) + 1);
      }
    }
  }

  const integrity = await computeRoundPlanIntegrity(matchRoundId);

  const unresolvedSignals = integrity.signals;

  const warningSeverityMap: Record<string, WarningSeverity> = {
    SQUAD_BELOW_MINIMUM: WarningSeverity.HARD_BLOCK,
    SELECTED_PLAYER_UNAVAILABLE: WarningSeverity.HARD_BLOCK,
    DUPLICATE_PLANNED_ASSIGNMENT_INTEGRITY_FAILURE: WarningSeverity.HARD_BLOCK,
    AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY: WarningSeverity.REQUIRES_OVERRIDE,
  };

  const unavailableByTeamId = new Map<string, typeof allPlayers>();
  for (const p of allPlayers) {
    const teamId = p.coreTeamId ?? "";
    const existing = unavailableByTeamId.get(teamId) ?? [];
    existing.push(p);
    unavailableByTeamId.set(teamId, existing);
  }

  const SELECTED_ROLES = new Set(["CORE", "SUPPORT", "BACKFILL", "DEVELOPMENT", "CONFIDENCE_REBUILD", "MANUAL_OVERRIDE"]);

  const squads = matchRound.matches.map((match) => {
    const matchSels = (selectionsByMatchId.get(match.id) ?? [])
      .filter((s) => !s.manuallyRemoved);

    const seenPlayerIds = new Set<string>();
    const players: PlayerInMatch[] = [];

    const selectedSels = matchSels.filter((s) => SELECTED_ROLES.has(s.role));
    const droppedSels = matchSels.filter((s) => !SELECTED_ROLES.has(s.role));

    for (const sel of [...selectedSels, ...droppedSels]) {
      if (seenPlayerIds.has(sel.player.id)) continue;
      seenPlayerIds.add(sel.player.id);

      const explanation = (sel.explanation ?? {}) as Record<string, unknown>;
      const explanations = Array.isArray(explanation.records)
        ? (explanation.records as Array<{ code: string; summary: string; details?: string; hardRule?: boolean }>)
        : [{
            code: (explanation.code as string) ?? sel.role,
            summary: (explanation.summary as string) ?? "",
            details: explanation.details as string | undefined,
            hardRule: explanation.hardRule as boolean | undefined,
          }];

      players.push({
        playerId: sel.player.id,
        playerName: formatPlayerName(sel.player),
        coreTeamName: sel.player.coreTeam?.name ?? "Unassigned",
        selectionCategory: sel.role as PlayerInMatch["selectionCategory"],
        selectionReason: (explanation.summary as string) ?? "",
        explanations,
        priorityScore: (explanation.priorityScore as number | null) ?? null,
        manualOverride: (explanation.manualOverride as boolean) ?? false,
        playerPosition: sel.player.primaryPosition ?? "",
        controlledDoubleLoad: sel.controlledDoubleLoad ?? false,
        matchdayResponsibility: sel.matchdayResponsibility,
      });
    }

    const unavailableForTeam = unavailableByTeamId.get(match.teamId) ?? [];
    for (const p of unavailableForTeam) {
      if (!seenPlayerIds.has(p.id)) {
        seenPlayerIds.add(p.id);
        players.push({
          playerId: p.id,
          playerName: formatPlayerName(p),
    coreTeamName: p.coreTeam?.name ?? "Unassigned",
          selectionCategory: "UNAVAILABLE",
          selectionReason: `Unavailable: ${p.currentAvailability}`,
          explanations: [{
            code: "UNAVAILABLE",
            summary: `Player is ${p.currentAvailability?.toLowerCase()}`,
            hardRule: true,
          }],
          priorityScore: null,
          manualOverride: false,
          playerPosition: "",
          controlledDoubleLoad: false,
        });
      }
    }

    const selectedPlayerIds = new Set<string>();
    for (const sel of selectedSels) {
      selectedPlayerIds.add(sel.player.id);
    }
    const selectedCount = selectedPlayerIds.size;
    const matchWarnings = unresolvedSignals.filter(
      (s) => (s.matchId === match.id || s.teamId === match.teamId),
    );
    const minSupport = match.team.minSupportPlayers ?? 0;

    let supportStatus: "fulfilled" | "partial" | "missing" | "none" = "none";
    if (minSupport > 0) {
      const actualSupport = matchSels.filter((s) => s.role === "SUPPORT").length;
      if (actualSupport >= minSupport) {
        supportStatus = "fulfilled";
      } else if (actualSupport > 0) {
        supportStatus = "partial";
      } else {
        supportStatus = "missing";
      }
    }

    return {
      matchId: match.id,
      teamName: match.team.name,
      opponent: match.opponent,
      matchDate: match.startsAt,
      targetSquadSize: match.team.targetSquadSize,
      minSquadSize: match.team.minAcceptedSquadSize ?? match.team.targetSquadSize,
      selectedCount,
      players,
      supportStatus,
      squadRepairCount: squadRepairReceivedByTeamId.get(match.teamId) ?? 0,
      warningCount: matchWarnings.length,
      isFinalized: matchRound.status === "FINALIZED",
    };
  });

  const totalSupportSent = Array.from(supportSentByTeamId.values()).reduce((a, b) => a + b, 0);
  const totalSupportReceived = Array.from(supportReceivedByTeamId.values()).reduce((a, b) => a + b, 0);
  const totalDevSent = Array.from(devSentByTeamId.values()).reduce((a, b) => a + b, 0);
  const totalDevReceived = Array.from(devReceivedByTeamId.values()).reduce((a, b) => a + b, 0);
  const totalSquadRepairReceived = Array.from(squadRepairReceivedByTeamId.values()).reduce((a, b) => a + b, 0);
  const totalDrops = Array.from(dropsCountByTeamId.values()).reduce((a, b) => a + b, 0);

  const warnings = unresolvedSignals.map((s) => ({
    code: s.ruleCode,
    message: s.title,
    severity: warningSeverityMap[s.ruleCode] ?? (s.kind === "BLOCKED" ? WarningSeverity.HARD_BLOCK : s.kind === "DECISION_REQUIRED" ? WarningSeverity.REQUIRES_OVERRIDE : WarningSeverity.WARNING),
    teamName: matchRound.matches.find((m) => m.teamId === s.teamId)?.team.name,
  }));

  const signalSummary = {
    blocked: integrity.summary.blockerCount,
    decisionRequired: integrity.summary.decisionRequiredCount,
    planningNote: integrity.planningNotes.length,
  };

  const uniqueSelectedPlayerIds = new Set<string>();
  for (const s of selections) {
    if (SELECTED_ROLES.has(s.role)) {
      uniqueSelectedPlayerIds.add(s.playerId);
    }
  }

  const fairnessMetrics = [
    { label: "Players selected", value: uniqueSelectedPlayerIds.size },
    { label: "Matches this round", value: matchRound.matches.length },
    { label: "Cross-team movers", value: crossTeamMoverCount },
    {
      label: "Squad fill rate",
      value: squads.length > 0
        ? `${Math.round(squads.reduce((sum, s) => sum + (s.selectedCount / s.targetSquadSize), 0) / squads.length * 100)}%`
        : "N/A",
    },
  ];

  const playerCoreTeamMap = new Map<string, string>();
  for (const sel of selections) {
    if (!playerCoreTeamMap.has(sel.player.id) && sel.player.coreTeamId) {
      playerCoreTeamMap.set(sel.player.id, sel.player.coreTeamId);
    }
  }
  for (const p of eligiblePlayers) {
    if (!playerCoreTeamMap.has(p.id) && p.coreTeamId) {
      playerCoreTeamMap.set(p.id, p.coreTeamId);
    }
  }

  const boardMatches = squads.map((s) => {
    const matchRecord = matchRound.matches.find((m) => m.id === s.matchId);
    const matchIntent = matchIntents.find((i) => i.scopeId === s.matchId);
    return {
      matchId: s.matchId,
      teamId: matchRecord?.teamId ?? "",
      teamName: s.teamName,
      opponent: s.opponent,
      matchDate: s.matchDate,
      targetSquadSize: s.targetSquadSize,
      minSquadSize: s.minSquadSize,
      isFinalized: s.isFinalized,
      coachingIntentCategory: matchIntent?.category ?? undefined,
      coachingIntentId: matchIntent?.id ?? undefined,
      players: s.players
        .filter((p) => p.selectionCategory === "CORE" || p.selectionCategory === "SUPPORT" || p.selectionCategory === "BACKFILL" || p.selectionCategory === "DEVELOPMENT")
        .map((p) => ({
             id: p.playerId,
             name: p.playerName,
             coreTeamName: p.coreTeamName,
             primaryPosition: p.playerPosition || undefined,
             playerCoreTeamId: playerCoreTeamMap.get(p.playerId) ?? "",
             role: p.selectionCategory as "CORE" | "SUPPORT" | "BACKFILL" | "DEVELOPMENT",
             manualOverride: p.manualOverride,
             controlledDoubleLoad: p.controlledDoubleLoad,
             matchdayResponsibility: p.matchdayResponsibility,
              warningCount: (() => {
              const playerWarnings = unresolvedSignals.filter(
                (sig) => (sig.matchId === s.matchId || sig.teamId === (matchRecord?.teamId ?? "")) && sig.playerId === p.playerId,
              );
              return playerWarnings.length;
            })(),
             negativeReadinessSignals: playerNegativeReadiness.get(p.playerId) ?? [],
        })),
    };
  });

  const boardAvailablePlayers = availablePlayerList.map((p) => ({
    id: p.id,
    name: p.name,
    coreTeamName: p.coreTeamName,
    coreTeamId: p.coreTeamId,
    primaryPosition: p.primaryPosition,
    negativeReadinessSignals: playerNegativeReadiness.get(p.id) ?? [],
  }));

  const rotationPathMap: Record<string, string[]> = {};
  for (const path of rotationPaths) {
    const key = `${path.fromTeamId}:${path.toTeamId}`;
    if (!rotationPathMap[key]) rotationPathMap[key] = [];
    if (!rotationPathMap[key].includes(path.role)) {
      rotationPathMap[key].push(path.role);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-red-800/50 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {finalized && (
        <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          Round finalized.
        </div>
      )}
      {generated && (
        <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          Round generated successfully.
        </div>
      )}
      <RoundBoard
        roundLabel={roundLabel}
        roundStatus={matchRound.status as "NOT_GENERATED" | "DRAFT" | "FINALIZED"}
        matchRoundId={matchRoundId}
        hasDraftSelections={selections.length > 0}
        matches={boardMatches}
        availablePlayers={boardAvailablePlayers}
        rotationPathMap={rotationPathMap}
        warnings={warnings}
        signalSummary={signalSummary}
        movementSummary={{
          supportSent: totalSupportSent,
          supportReceived: totalSupportReceived,
          developmentSent: totalDevSent,
          developmentReceived: totalDevReceived,
          squadRepairReceived: totalSquadRepairReceived,
          drops: totalDrops,
        }}
        fairnessMetrics={fairnessMetrics}
      />
      {matchRound.status !== "FINALIZED" && (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
            <h3 className="text-sm font-semibold text-zinc-200 mb-3">Coaching intent</h3>
            <div className="flex flex-col gap-2">
              <div className="text-xs text-[var(--text-muted)]">Round intent</div>
              <CoachingIntentSelector
                scopeType="MATCH_ROUND"
                scopeId={matchRoundId}
                currentIntent={roundIntents[0]?.category ?? undefined}
                currentIntentId={roundIntents[0]?.id ?? undefined}
                label="Round intent"
              />
              {matchIntents.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {matchIntents.map((intent) => {
                    const match = matchRound.matches.find((m) => m.id === intent.scopeId);
                    return (
                      <div key={intent.id} className="text-[10px] text-[var(--text-muted)]">
                        {match ? `${match.team.name} vs ${match.opponent}` : intent.scopeId}: {COACHING_INTENT_LABELS[intent.category as CoachingIntentCategory] ?? intent.category}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}