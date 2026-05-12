export const dynamic = "force-dynamic";

import Link from "next/link";
import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { deriveRoundStatus, type RoundStatus } from "@/lib/round-status";
import { formatDate, formatIsoWeekLabel } from "@/lib/date-utils";
import { getTeamFairnessGroups } from "@/lib/workflow/get-team-fairness-gaps";
import { getPlanningPeriodFairness, type FairnessFlag } from "@/lib/selection/get-planning-period-fairness";
import { getTeamBurden } from "@/lib/selection/get-team-burden";
import { formatAvailabilityStatus } from "@/lib/player-metrics";
import { StatusBadge } from "@/components/ui/status-badge";
import { SeverityBadge, severityFromCode, severityFromDbSeverity } from "@/components/ui/severity-badge";
import { type WarningSeverity } from "@/generated/prisma/client";
import { requireCoachAccess } from "@/lib/auth";

type ActionCard = {
  group: string;
  severity: "blocking" | "high" | "medium" | "info";
  title: string;
  detail: string;
  actionHref: string;
  actionLabel: string;
};

function formatSeverityBadge(severity: "blocking" | "high" | "medium" | "info") {
  return <SeverityBadge severity={severity} />;
}

type RoundProgress = {
  id: string;
  name: string;
  status: RoundStatus;
};

function computeRoundProgress(rounds: { id: string; name: string; status: string; matches: { id: string }[]; warnings: { severity: string; rule: string }[] }[]): RoundProgress[] {
  return rounds.map((r) => {
    const hasMatches = r.matches.length > 0;
    const hasDraft = r.status === "DRAFT";
    const isFinalized = r.status === "FINALIZED";
    const blockingCount = r.warnings.filter((w) => {
      const sev = w.severity ? severityFromDbSeverity(w.severity as WarningSeverity) : severityFromCode(w.rule);
      return sev === "blocking";
    }).length;

    if (isFinalized) return { id: r.id, name: r.name, status: "FINALIZED" as const };
    if (hasDraft && blockingCount > 0) return { id: r.id, name: r.name, status: "BLOCKED" as const };
    if (hasDraft) return { id: r.id, name: r.name, status: "READY" as const };
    if (hasMatches) return { id: r.id, name: r.name, status: "NOT_GENERATED" as const };
    return { id: r.id, name: r.name, status: "NOT_GENERATED" as const };
  });
}

export default async function TodayPage() {
  const activePlanningPeriod = await db.planningPeriod.findFirst({
    orderBy: { startDate: "desc" },
  });

  const activeMatchRound = activePlanningPeriod
    ? await db.matchRound.findFirst({
        where: { planningPeriodId: activePlanningPeriod.id, status: { not: "FINALIZED" } },
        include: {
          matches: {
            include: { team: { select: { id: true, name: true } } },
            orderBy: [{ startsAt: "asc" }],
          },
          warnings: {
            where: { resolved: false },
            select: { id: true, rule: true, message: true, severity: true, matchId: true, teamId: true },
            orderBy: [{ createdAt: "desc" }],
          },
        },
        orderBy: { createdAt: "asc" },
      })
    : null;

  const allMatchRounds = activePlanningPeriod
    ? await db.matchRound.findMany({
        where: { planningPeriodId: activePlanningPeriod.id },
        include: {
          matches: { select: { id: true } },
          warnings: { where: { resolved: false }, select: { severity: true, rule: true } },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const [selections, recentFinalizedSelections, players, teams, fairnessData, teamBurdenData] = await Promise.all([
    activeMatchRound
      ? db.selection.findMany({
          where: {
            matchId: { in: activeMatchRound.matches.map((m) => m.id) },
            status: { in: [SelectionStatus.DRAFT, SelectionStatus.FINALIZED] },
          },
          include: { player: { select: { id: true } } },
          orderBy: [{ createdAt: "desc" }],
        })
      : Promise.resolve([]),
    db.selection.findMany({
      where: { status: SelectionStatus.FINALIZED },
      include: {
        player: { select: { id: true } },
        match: { include: { team: { select: { name: true } } } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 3,
    }),
    db.player.findMany({
      where: { active: true, removedAt: null },
      include: { coreTeam: { select: { id: true, name: true } } },
      orderBy: [
        { coreTeam: { name: "asc" } },
        { firstName: "asc" },
        { lastName: "asc" },
        { playerCode: "asc" },
      ],
    }),
    db.team.findMany({
      where: { archivedAt: null },
      include: {
        corePlayers: { where: { removedAt: null }, select: { id: true } },
        toRotationPaths: { select: { fromTeamId: true, toTeamId: true, role: true, fromTeam: { select: { id: true, name: true } } } },
      },
      orderBy: [{ name: "asc" }],
    }),
    activePlanningPeriod
      ? getPlanningPeriodFairness(activePlanningPeriod.id)
      : Promise.resolve({ players: [], planningPeriodId: "" }),
    activePlanningPeriod
      ? getTeamBurden(activePlanningPeriod.id)
      : Promise.resolve({ teams: [], planningPeriodId: "" }),
  ]);

  const selectedPlayerIdsByMatchId = new Map<string, string[]>();
  for (const selection of selections) {
    const existing = selectedPlayerIdsByMatchId.get(selection.matchId) ?? [];
    existing.push(selection.player.id);
    selectedPlayerIdsByMatchId.set(selection.matchId, existing);
  }

  // --- Next Action ---
  const blockingWarnings = activeMatchRound
    ? activeMatchRound.warnings.filter((w) => {
        const sev = w.severity ? severityFromDbSeverity(w.severity as WarningSeverity) : severityFromCode(w.rule);
        return sev === "blocking";
      })
    : [];

  const roundStatus = deriveRoundStatus({
    dbStatus: activeMatchRound?.status ?? null,
    hasDraftSelections: selections.some((s) => s.status === "DRAFT"),
    hasMatches: (activeMatchRound?.matches.length ?? 0) > 0,
    blockingWarningCount: blockingWarnings.length,
  });

  const teamCount = await db.team.count({ where: { archivedAt: null } });
  const playerCount = await db.player.count({ where: { removedAt: null } });
  const totalMatchCount = await db.match.count();

  type NextAction = { label: string; href: string };

  const nextAction: NextAction | null = (() => {
    if (teamCount === 0) {
      return { label: "Create a team to get started", href: "/teams/new" };
    }
    if (playerCount === 0) {
      return { label: "Add players to your teams", href: "/players/new" };
    }
    if (totalMatchCount === 0) {
      return { label: "Create a match to plan a round", href: "/matches/new" };
    }
    if (!activePlanningPeriod || !activeMatchRound) {
      return { label: "Select a round", href: "/rounds" };
    }
    if (roundStatus === "NOT_GENERATED") {
      return { label: `Generate squads for ${activeMatchRound.name}`, href: `/rounds/${activeMatchRound.id}` };
    }
    if (roundStatus === "BLOCKED") {
      return { label: `Review ${blockingWarnings.length} warning${blockingWarnings.length === 1 ? "" : "s"} and finalize with override`, href: `/rounds/${activeMatchRound.id}#warnings` };
    }
    if (roundStatus === "DRAFT") {
      return { label: `Finalize ${activeMatchRound.name}`, href: `/rounds/${activeMatchRound.id}` };
    }
    if (roundStatus === "READY") {
      return { label: `Finalize ${activeMatchRound.name}`, href: `/rounds/${activeMatchRound.id}` };
    }
    return { label: "View finalized rounds", href: "/history" };
  })();

  // --- Active Round Summary ---
  const matchCount = activeMatchRound?.matches.length ?? 0;
  const draftSelectionCount = selections.filter((s) => s.status === SelectionStatus.DRAFT).length;
  const roundLabel = activeMatchRound
    ? (activeMatchRound.matches.length > 0
        ? formatIsoWeekLabel(activeMatchRound.matches[0]!.startsAt)
        : activeMatchRound.name)
    : null;

  const roundWarnings = activeMatchRound?.warnings ?? [];
  const warningCounts = {
    blocking: roundWarnings.filter((w) => (w.severity ? severityFromDbSeverity(w.severity as WarningSeverity) : severityFromCode(w.rule)) === "blocking").length,
    high: roundWarnings.filter((w) => (w.severity ? severityFromDbSeverity(w.severity as WarningSeverity) : severityFromCode(w.rule)) === "high").length,
    medium: roundWarnings.filter((w) => (w.severity ? severityFromDbSeverity(w.severity as WarningSeverity) : severityFromCode(w.rule)) === "medium").length,
    info: roundWarnings.filter((w) => (w.severity ? severityFromDbSeverity(w.severity as WarningSeverity) : severityFromCode(w.rule)) === "info").length,
  };

  // --- Fairness Checks ---
  const fairnessGroups = getTeamFairnessGroups(players, selectedPlayerIdsByMatchId).slice(0, 4);
  const flaggedPlayers = fairnessData.players.filter((p) => p.flags.length > 0);

  // --- Action Cards ---
  const actionCards: ActionCard[] = [];

  const unavailablePlayers = players.filter(
    (p) => p.currentAvailability !== "AVAILABLE",
  );
  for (const p of unavailablePlayers) {
    const severity: "blocking" | "high" | "medium" | "info" =
      p.currentAvailability === "INJURED" || p.currentAvailability === "SICK" ? "high" : "info";
    actionCards.push({
      group: "Availability",
      severity,
      title: `${p.firstName} ${p.lastName} is ${formatAvailabilityStatus(p.currentAvailability).toLowerCase()}`,
      detail: `${p.coreTeam.name} player may affect squad depth.`,
      actionHref: `/players/${p.id}`,
      actionLabel: "Open profile",
    });
  }

  for (const team of teams) {
    const coreCount = team.corePlayers.length;
    const targetSquad = team.targetSquadSize ?? 7;
    const minSquad = team.minAcceptedSquadSize ?? 5;
    if (coreCount < minSquad) {
      actionCards.push({
        group: "Support needs",
        severity: "high",
        title: `${team.name} has low core depth`,
        detail: `${coreCount} core players. Minimum accepted: ${minSquad}. Target: ${targetSquad}.`,
        actionHref: "/teams",
        actionLabel: "Review team",
      });
    }

    const supportPaths = team.toRotationPaths.filter((p) => p.role === "SUPPORT");
    for (const path of supportPaths) {
      const sourceCore = teams.find((t) => t.id === path.fromTeam.id);
      if (sourceCore) {
        const sourceCoreCount = sourceCore.corePlayers.length;
        const sourceMinSquad = sourceCore.minAcceptedSquadSize ?? 5;
        if (sourceCoreCount - 1 < sourceMinSquad) {
          actionCards.push({
            group: "Squad repair consequences",
            severity: "medium",
            title: `${path.fromTeam.name} may be short if supporting ${team.name}`,
            detail: `${path.fromTeam.name} has ${sourceCoreCount} core players. Sending one to support ${team.name} may drop below minimum.`,
            actionHref: "/teams",
            actionLabel: "Review paths",
          });
        }
      }
    }
  }

  for (const p of flaggedPlayers) {
    const flagLabels = p.flags.map((f: FairnessFlag) =>
      f === "support_burden_review" ? "Support burden review"
      : f === "hidden_promotion_review" ? "Hidden promotion review"
      : "Core exposure review",
    );
    actionCards.push({
      group: "Fairness flags",
      severity: "high",
      title: `${p.playerName}: ${flagLabels.join(", ")}`,
      detail: `Core: ${p.coreCount}, Support: ${p.supportCount}, Development: ${p.developmentCount}. Available rounds: ${p.availableRounds}.`,
      actionHref: `/players/${p.playerId}`,
      actionLabel: "Open profile",
    });
  }

  for (const teamBurden of teamBurdenData.teams) {
    if (teamBurden.highDonorBurden) {
      actionCards.push({
        group: "Team burden",
        severity: "high",
        title: `${teamBurden.teamName}: high donor burden`,
        detail: `Donated players in every round of the planning period (${teamBurden.totalDonations} total donations). Consider squad repair or reduced voluntary movement.`,
        actionHref: "/teams",
        actionLabel: "Review team",
      });
    }
    if (teamBurden.repeatedSupportShortfall) {
      actionCards.push({
        group: "Team burden",
        severity: "medium",
        title: `${teamBurden.teamName}: repeated support shortage`,
        detail: `Missed target support in multiple rounds of the planning period.`,
        actionHref: "/teams",
        actionLabel: "Review team",
      });
    }
    for (const [_roundId, delta] of Object.entries(teamBurden.continuityDeltaByRound)) {
      const maxChanges = teams.find((t) => t.id === teamBurden.teamId)?.maxPlayerChangesPerRound ?? 0;
      if (maxChanges > 0 && delta > maxChanges) {
        actionCards.push({
          group: "Team burden",
          severity: "info",
          title: `${teamBurden.teamName}: low continuity`,
          detail: `${delta} player changes from previous round (max configured: ${maxChanges}).`,
          actionHref: "/teams",
          actionLabel: "Review team",
        });
      }
    }
  }

  // Add blocking warnings from active round
  for (const w of blockingWarnings) {
    const match = activeMatchRound?.matches.find((m) => m.id === w.matchId);
    actionCards.push({
      group: "Blocking warnings",
      severity: "blocking",
      title: w.message,
      detail: `Rule: ${w.rule}${match ? ` — ${match.team.name}` : ""}`,
      actionHref: `/rounds/${activeMatchRound?.id ?? ""}#warnings`,
      actionLabel: "View round",
    });
  }

  const actionCardsBySeverity = new Map<"blocking" | "high" | "medium" | "info", ActionCard[]>();
  const severityOrder: ("blocking" | "high" | "medium" | "info")[] = ["blocking", "high", "medium", "info"];
  for (const sev of severityOrder) {
    actionCardsBySeverity.set(sev, actionCards.filter((c) => c.severity === sev));
  }

  // --- Recently Finalized ---
  const uniqueFinalized = new Map<string, (typeof recentFinalizedSelections)[number]>();
  for (const sel of recentFinalizedSelections) {
    if (!uniqueFinalized.has(sel.matchId)) {
      uniqueFinalized.set(sel.matchId, sel);
    }
  }

  return (
    <main className="flex min-h-full flex-col gap-6 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
            Today
          </span>
          <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
            Active round
          </span>
        </div>

        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
          Today
        </h1>
        <p className="mt-4 max-w-3xl text-sm app-copy-soft sm:text-base">
          {teamCount === 0
            ? "Start by creating a team."
            : playerCount === 0
              ? "Add players to your teams."
              : totalMatchCount === 0
                ? "Create matches to plan rounds."
                : "Review the active round, blockers, and the next safe action."}
        </p>

        {nextAction && (
          <div className="mt-6 rounded-[1.6rem] border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Next action
            </p>
            <Link
              className="mt-3 block text-xl font-semibold text-zinc-50 hover:underline"
              href={nextAction.href}
            >
              {nextAction.label}
            </Link>
            <Link
              className="mt-2 block text-sm app-copy-soft hover:text-zinc-50"
              href={nextAction.href}
            >
              Go to &rarr;
            </Link>
          </div>
        )}
      </section>

      {teamCount === 0 || playerCount === 0 || totalMatchCount === 0 ? (
        <section className="app-panel rounded-[1.75rem] p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Setup progress
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-50">Get started</h2>
            <p className="mt-2 text-sm app-copy-soft">
              Complete each step to start planning match rounds.
            </p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className={`rounded-[1.35rem] border p-4 ${teamCount > 0 ? "border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.08)]" : "border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)]"}`}>
              <p className="text-sm font-semibold text-zinc-100">
                {teamCount > 0 ? "Teams created" : "Create teams"}
              </p>
              <p className="mt-1 text-sm app-copy-soft">
                {teamCount > 0 ? `${teamCount} team${teamCount === 1 ? "" : "s"}` : "Add teams to the registry."}
              </p>
              {teamCount === 0 && (
                <Link
                  className="mt-3 inline-flex h-8 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-3 text-xs font-semibold text-zinc-50"
                  href="/teams/new"
                >
                  Create team
                </Link>
              )}
            </div>
            <div className={`rounded-[1.35rem] border p-4 ${playerCount > 0 ? "border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.08)]" : teamCount === 0 ? "border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] opacity-50" : "border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)]"}`}>
              <p className="text-sm font-semibold text-zinc-100">
                {playerCount > 0 ? "Players created" : "Add players"}
              </p>
              <p className="mt-1 text-sm app-copy-soft">
                {playerCount > 0 ? `${playerCount} player${playerCount === 1 ? "" : "s"}` : teamCount === 0 ? "Create a team first." : "Add players to teams."}
              </p>
              {playerCount === 0 && teamCount > 0 && (
                <Link
                  className="mt-3 inline-flex h-8 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-3 text-xs font-semibold text-zinc-50"
                  href="/players/new"
                >
                  Create player
                </Link>
              )}
            </div>
            <div className={`rounded-[1.35rem] border p-4 ${totalMatchCount > 0 ? "border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.08)]" : playerCount === 0 ? "border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] opacity-50" : "border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)]"}`}>
              <p className="text-sm font-semibold text-zinc-100">
                {totalMatchCount > 0 ? "Matches created" : "Add matches"}
              </p>
              <p className="mt-1 text-sm app-copy-soft">
                {totalMatchCount > 0 ? `${totalMatchCount} match${totalMatchCount === 1 ? "" : "es"}` : playerCount === 0 ? "Add players first." : "Create matches for rounds."}
              </p>
              {totalMatchCount === 0 && playerCount > 0 && (
                <Link
                  className="mt-3 inline-flex h-8 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-3 text-xs font-semibold text-zinc-50"
                  href="/matches/new"
                >
                  Create match
                </Link>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="app-panel rounded-[1.75rem] p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Active Round Summary
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">
            {roundLabel ?? "No active round"}
          </h2>
        </div>

        {activeMatchRound ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.35rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">Status</p>
              <div className="mt-2">
                <StatusBadge status={roundStatus} />
              </div>
            </div>
            <div className="rounded-[1.35rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">Matches</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-50">{matchCount}</p>
            </div>
            <div className="rounded-[1.35rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">Draft selections</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-50">{draftSelectionCount}</p>
            </div>
            <div className="rounded-[1.35rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">Warnings</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {warningCounts.blocking > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-300">
                    {warningCounts.blocking} blocking
                  </span>
                )}
                {warningCounts.high > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300">
                    {warningCounts.high} override{warningCounts.high !== 1 ? "s" : ""}
                  </span>
                )}
                {(warningCounts.blocking === 0 && warningCounts.high === 0) && (
                  roundWarnings.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400">
                      {roundWarnings.length} informational only
                    </span>
                  ) : (
                    <span className="text-xs app-copy-muted">None</span>
                  )
                )}
              </div>
            </div>

            {/* Support / squad repair status row */}
            <div className="md:col-span-2 xl:col-span-4 rounded-[1.35rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">Matches in round</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeMatchRound.matches.map((match) => (
                  <Link
                    key={match.id}
                    className="rounded-xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-3 hover:bg-[rgba(255,255,255,0.04)]"
                    href={`/selection/${match.id}`}
                  >
                    <p className="text-sm font-semibold text-zinc-100">
                      {match.team.name} vs. {match.opponent}
                    </p>
                    <p className="mt-1 text-sm app-copy-soft">
                      {formatDate(match.startsAt)} · {formatIsoWeekLabel(match.startsAt)}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
            No active round. Create a match round to get started.
          </div>
        )}
      </section>

      {allMatchRounds.length > 0 && (
        <section className="app-panel rounded-[1.75rem] p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Setup Progress
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-50">Round generation status</h2>
            <p className="mt-2 text-sm app-copy-soft">
              Rounds in this planning period. Use Populate all to generate drafts for all ungenerated rounds.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {computeRoundProgress(allMatchRounds).map((rp) => (
              <Link
                key={rp.id}
                className="rounded-[1.35rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4 hover:bg-[rgba(255,255,255,0.05)]"
                href={`/rounds/${rp.id}`}
              >
                <p className="text-sm font-semibold text-zinc-100">{rp.name}</p>
                <div className="mt-2">
                  <StatusBadge status={rp.status} />
                </div>
              </Link>
            ))}
          </div>

          {computeRoundProgress(allMatchRounds).some((r) => r.status === "NOT_GENERATED") && activePlanningPeriod && (
            <div className="mt-4">
              <form action={async () => {
                "use server";
                await requireCoachAccess();
                const { populateAllDrafts } = await import("@/lib/selection/populate-all-drafts");
                await populateAllDrafts(activePlanningPeriod.id);
              }}>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-4 text-sm font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent)]/20 transition-colors"
                >
                  Populate all rounds
                </button>
              </form>
            </div>
          )}

          {computeRoundProgress(allMatchRounds).some((r) => r.status === "DRAFT" || r.status === "BLOCKED" || r.status === "READY") && activePlanningPeriod && (
            <div className="mt-2">
              <form action={async () => {
                "use server";
                await requireCoachAccess();
                const { refreshDraftRound } = await import("@/lib/selection/refresh-draft-selection");
                const db = (await import("@/lib/db")).db;
                const draftRounds = await db.matchRound.findMany({
                  where: { planningPeriodId: activePlanningPeriod.id, status: "DRAFT" },
                  select: { id: true },
                });
                for (const round of draftRounds) {
                  await refreshDraftRound(round.id);
                }
              }}>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-600/50 bg-zinc-800/30 px-4 text-sm font-medium text-zinc-200 hover:bg-zinc-700/30 transition-colors"
                >
                  Regenerate all drafts
                </button>
              </form>
            </div>
          )}
        </section>
      )}

      <section className="app-panel rounded-[1.75rem] p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Blocking Warnings
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">
            Issues that prevent finalization
          </h2>
        </div>

        <div className="mt-6 grid gap-6">
          {severityOrder.map((sev) => {
            const cards = actionCardsBySeverity.get(sev) ?? [];
            if (cards.length === 0) return null;
            return (
              <div key={sev}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted mb-3">
                  {sev === "blocking" ? "Blocking" : sev === "high" ? "High" : sev === "medium" ? "Medium" : "Info"}
                </p>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {cards.slice(0, 6).map((card) => (
                    <div
                      key={`${card.group}-${card.title}`}
                      className="rounded-[1.35rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-zinc-100">{card.title}</p>
                        {formatSeverityBadge(card.severity)}
                      </div>
                      <p className="mt-2 text-sm app-copy-soft">{card.detail}</p>
                      <Link
                        className="mt-3 inline-flex h-8 items-center rounded-full border app-hairline px-3 text-xs font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                        href={card.actionHref}
                      >
                        {card.actionLabel}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {actionCards.length === 0 && (
            <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
              No blocking or high-severity issues right now.
            </div>
          )}
        </div>
      </section>

      <section className="app-panel rounded-[1.75rem] p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Fairness Checks
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Teams with match allocation deviations</h2>
          <p className="mt-2 text-sm app-copy-soft">
            Fairness impact across the planning period. Counts include core and floating work together.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {fairnessGroups.length > 0 ? (
            fairnessGroups.map((group) => (
              <div
                key={group.teamId}
                className="rounded-[1.45rem] border border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.08)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{group.teamName}</p>
                    <p className="mt-1 text-sm app-copy-soft">
                      Fair target right now: {group.targetMatchCount} saved match
                      {group.targetMatchCount === 1 ? "" : "es"} per active player.
                    </p>
                  </div>
                  <span className="rounded-full border border-[rgba(208,176,127,0.26)] bg-[rgba(208,176,127,0.12)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--warning)]">
                    {group.players.length} behind
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  {group.players.slice(0, 3).map((player) => (
                    <div
                      key={player.playerId}
                      className="rounded-xl border app-hairline bg-[rgba(0,0,0,0.16)] px-4 py-3"
                    >
                      <Link
                        className="text-sm font-medium text-zinc-100 hover:text-[var(--accent-strong)]"
                        href={`/players/${player.playerId}`}
                      >
                        {player.playerName}
                      </Link>
                      <p className="mt-1 text-sm app-copy-soft">
                        {player.currentMatchCount} saved match{player.currentMatchCount === 1 ? "" : "es"}.
                        Behind by {player.gap} compared with teammates on {player.targetMatchCount}.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
              No fairness deviations are currently visible among active players.
            </div>
          )}
        </div>
      </section>

      <section className="app-panel rounded-[1.75rem] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Recently Finalized
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-50">Last finalized rounds</h2>
          </div>
          <Link
            className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
            href="/history"
          >
            Open history
          </Link>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {uniqueFinalized.size > 0 ? (
            [...uniqueFinalized.values()].map((selection) => (
              <Link
                key={selection.id}
                className="rounded-[1.45rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4 hover:bg-[rgba(255,255,255,0.05)]"
                href={`/selection/${selection.matchId}`}
              >
                <p className="text-sm font-semibold text-zinc-100">
                  {selection.match.team.name} vs. {selection.match.opponent}
                </p>
                <p className="mt-1 text-sm app-copy-soft">
                  {formatDate(selection.match.startsAt)} · {formatIsoWeekLabel(selection.match.startsAt)}
                </p>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
              No finalized selections yet.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}