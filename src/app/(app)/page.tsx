export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { type RoundStatus } from "@/lib/round-status";
import { formatDate } from "@/lib/date-utils";
import { getPlanningPeriodFairness, type FairnessFlag } from "@/lib/selection/get-planning-period-fairness";
import { getTeamBurden } from "@/lib/selection/get-team-burden";
import { formatAvailabilityStatus } from "@/lib/player-metrics";
import { StatusBadge } from "@/components/ui/status-badge";
import { severityFromCode, severityFromDbSeverity } from "@/components/ui/severity-badge";
import { type WarningSeverity } from "@/generated/prisma/client";
import { requireCoachAccess } from "@/lib/auth";

type ActionItem = {
  severity: "blocking" | "high" | "medium" | "info";
  title: string;
  detail: string;
  actionHref: string;
  actionLabel: string;
};

type RoundProgress = {
  id: string;
  name: string;
  status: RoundStatus;
  matchCount: number;
  warningCount: number;
};

function computeRoundProgress(rounds: { id: string; name: string; status: string; matches: { id: string }[]; warnings: { severity: string; rule: string }[] }[]): RoundProgress[] {
  return rounds.map((r) => {
    const hasDraft = r.status === "DRAFT";
    const isFinalized = r.status === "FINALIZED";
    const blockingCount = r.warnings.filter((w) => {
      const sev = w.severity ? severityFromDbSeverity(w.severity as WarningSeverity) : severityFromCode(w.rule);
      return sev === "blocking";
    }).length;

    if (isFinalized) return { id: r.id, name: r.name, status: "FINALIZED" as const, matchCount: r.matches.length, warningCount: 0 };
    if (hasDraft && blockingCount > 0) return { id: r.id, name: r.name, status: "BLOCKED" as const, matchCount: r.matches.length, warningCount: blockingCount };
    if (hasDraft) return { id: r.id, name: r.name, status: "READY" as const, matchCount: r.matches.length, warningCount: 0 };
    return { id: r.id, name: r.name, status: "NOT_GENERATED" as const, matchCount: r.matches.length, warningCount: 0 };
  });
}

export default async function TodayPage() {
  await requireCoachAccess();

  const activePlanningPeriod = await db.planningPeriod.findFirst({
    orderBy: { startDate: "desc" },
  });

  const allMatchRounds = activePlanningPeriod
    ? await db.matchRound.findMany({
        where: { planningPeriodId: activePlanningPeriod.id },
        include: {
          matches: { select: { id: true, startsAt: true, team: { select: { name: true } }, opponent: true, homeAway: true } },
          warnings: { where: { resolved: false }, select: { severity: true, rule: true } },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const roundProgress = computeRoundProgress(allMatchRounds);

  const teams = await db.team.findMany({
    where: { archivedAt: null },
    include: {
      corePlayers: { where: { removedAt: null }, select: { id: true, currentAvailability: true } },
      toRotationPaths: { select: { fromTeamId: true, toTeamId: true, role: true, fromTeam: { select: { id: true, name: true } } } },
    },
    orderBy: [{ name: "asc" }],
  });

  const players = await db.player.findMany({
    where: { active: true, removedAt: null },
    include: { coreTeam: { select: { id: true, name: true } } },
    orderBy: [{ coreTeam: { name: "asc" } }, { playerCode: "asc" }],
  });

  const [fairnessData, teamBurdenData] = await Promise.all([
    activePlanningPeriod
      ? getPlanningPeriodFairness(activePlanningPeriod.id)
      : Promise.resolve({ players: [], planningPeriodId: "" }),
    activePlanningPeriod
      ? getTeamBurden(activePlanningPeriod.id)
      : Promise.resolve({ teams: [], planningPeriodId: "" }),
  ]);

  const teamCount = teams.length;
  const playerCount = players.length;
  const totalMatchCount = await db.match.count();
  const hasSetup = teamCount > 0 && playerCount > 0 && totalMatchCount > 0;

  const nextRound = roundProgress.find((r) => r.status !== "FINALIZED");

  const activeMatchRound = nextRound
    ? allMatchRounds.find((r) => r.id === nextRound.id) ?? null
    : null;

  const actionItems: ActionItem[] = [];

  if (!hasSetup) {
    // setup phase — no action items beyond setup
  } else {
    const blockingWarnings = activeMatchRound
      ? allMatchRounds.find((r) => r.id === activeMatchRound.id)?.warnings.filter((w) => {
          const sev = w.severity ? severityFromDbSeverity(w.severity as WarningSeverity) : severityFromCode(w.rule);
          return sev === "blocking";
        }) ?? []
      : [];

    for (const w of blockingWarnings) {
      actionItems.push({
        severity: "blocking",
        title: w.rule,
        detail: "Hard block — requires override to finalize",
        actionHref: `/rounds/${activeMatchRound?.id ?? ""}`,
        actionLabel: "Open round",
      });
    }

    const unavailablePlayers = players.filter((p) => p.currentAvailability !== "AVAILABLE");
    for (const p of unavailablePlayers) {
      actionItems.push({
        severity: p.currentAvailability === "INJURED" || p.currentAvailability === "SICK" ? "high" : "info",
        title: `${p.firstName} ${p.lastName} — ${formatAvailabilityStatus(p.currentAvailability).toLowerCase()}`,
        detail: p.coreTeam.name,
        actionHref: `/players/${p.id}`,
        actionLabel: "Profile",
      });
    }

    for (const team of teams) {
      const coreCount = team.corePlayers.length;
      const minSquad = team.minAcceptedSquadSize ?? 5;
      if (coreCount < minSquad) {
        actionItems.push({
          severity: "high",
          title: `${team.name} — low core depth`,
          detail: `${coreCount} core players (min: ${minSquad})`,
          actionHref: `/teams/${team.id}`,
          actionLabel: "Team detail",
        });
      }
    }

    for (const p of fairnessData.players.filter((p) => p.flags.length > 0).slice(0, 3)) {
      const flagLabels = p.flags.map((f: FairnessFlag) =>
        f === "support_burden_review" ? "High support burden"
        : f === "hidden_promotion_review" ? "Low development exposure"
        : "Low core exposure",
      );
      actionItems.push({
        severity: "high",
        title: `${p.playerName} — ${flagLabels.join(", ")}`,
        detail: `Core: ${p.coreCount}, Support: ${p.supportCount}, Dev: ${p.developmentCount}`,
        actionHref: `/players/${p.playerId}`,
        actionLabel: "Profile",
      });
    }

    for (const teamBurden of teamBurdenData.teams) {
      if (teamBurden.highDonorBurden) {
        actionItems.push({
          severity: "high",
          title: `${teamBurden.teamName} — high donor burden`,
          detail: `${teamBurden.totalDonations} total donations across all rounds`,
          actionHref: `/teams/${teams.find((t) => t.name === teamBurden.teamName)?.id ?? ""}`,
          actionLabel: "Team detail",
        });
      }
    }
  }

  const blockingItems = actionItems.filter((a) => a.severity === "blocking");
  const highItems = actionItems.filter((a) => a.severity === "high");
  const infoItems = actionItems.filter((a) => a.severity === "info" || a.severity === "medium");

  return (
    <div className="flex flex-col gap-4">
      {!hasSetup ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Get started</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {teamCount === 0 && (
              <Link href="/teams/new" className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3 text-sm font-medium text-zinc-100 hover:bg-zinc-700/30">
                Create a team
              </Link>
            )}
            {teamCount > 0 && playerCount === 0 && (
              <Link href="/players/new" className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3 text-sm font-medium text-zinc-100 hover:bg-zinc-700/30">
                Add players
              </Link>
            )}
            {playerCount > 0 && totalMatchCount === 0 && (
              <Link href="/matches/new" className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3 text-sm font-medium text-zinc-100 hover:bg-zinc-700/30">
                Create a match
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          {nextRound && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Next round</p>
                  <StatusBadge status={nextRound.status} />
                </div>
                <Link
                  href={`/rounds/${nextRound.id}`}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-2.5 text-xs font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent)]/20"
                >
                  Open round
                </Link>
              </div>
              <p className="text-sm font-medium text-zinc-100">{nextRound.name}</p>
              <p className="text-xs text-zinc-400">{nextRound.matchCount} matches{nextRound.warningCount > 0 ? ` · ${nextRound.warningCount} blocker${nextRound.warningCount === 1 ? "" : "s"}` : ""}</p>
            </div>
          )}

          {blockingItems.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Blocked</p>
              {blockingItems.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-2 rounded-md border border-red-900/40 bg-red-950/20 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-red-200">{item.title}</p>
                    <p className="text-[11px] text-red-300/60">{item.detail}</p>
                  </div>
                  <Link href={item.actionHref} className="shrink-0 text-[11px] font-medium text-red-300 hover:text-red-100">
                    {item.actionLabel}
                  </Link>
                </div>
              ))}
            </div>
          )}

          {highItems.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Needs attention</p>
              {highItems.slice(0, 4).map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-2 rounded-md border border-amber-900/30 bg-amber-950/10 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-200">{item.title}</p>
                    <p className="text-[11px] text-zinc-400">{item.detail}</p>
                  </div>
                  <Link href={item.actionHref} className="shrink-0 text-[11px] font-medium text-zinc-400 hover:text-zinc-200">
                    {item.actionLabel}
                  </Link>
                </div>
              ))}
              {highItems.length > 4 && (
                <p className="text-[11px] text-zinc-500">+{highItems.length - 4} more</p>
              )}
            </div>
          )}

          {roundProgress.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Rounds</p>
                {roundProgress.some((r) => r.status === "NOT_GENERATED") && activePlanningPeriod && (
                  <form action={async () => {
                    "use server";
                    await requireCoachAccess();
                    const { populateAllDrafts } = await import("@/lib/selection/populate-all-drafts");
                    await populateAllDrafts(activePlanningPeriod.id);
                  }}>
                    <button
                      type="submit"
                      className="inline-flex h-6 items-center gap-1 rounded border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-2 text-[11px] font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent)]/20"
                    >
                      Populate all
                    </button>
                  </form>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {roundProgress.map((rp) => (
                  <Link
                    key={rp.id}
                    href={`/rounds/${rp.id}`}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-xs hover:bg-zinc-800/40"
                  >
                    <span className="font-medium text-zinc-200">{rp.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500">{rp.matchCount}m</span>
                      <StatusBadge status={rp.status} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Upcoming matches</p>
            {allMatchRounds.flatMap((r) => r.matches.map((m) => ({ ...m, roundId: r.id, roundName: r.name }))).length === 0 ? (
              <p className="text-xs text-zinc-500">No matches scheduled</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {allMatchRounds.flatMap((r) => r.matches.map((m) => ({ ...m, roundId: r.id, roundName: r.name })))
                  .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
                  .slice(0, 8)
                  .map((m) => (
                    <Link
                      key={m.id}
                      href={`/rounds/${m.roundId}`}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-xs hover:bg-zinc-800/40"
                    >
                      <span className="text-zinc-200">{m.team.name} vs {m.opponent}</span>
                      <span className="text-zinc-500">{formatDate(m.startsAt)}</span>
                    </Link>
                  ))}
              </div>
            )}
          </div>

          {infoItems.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
                Diagnostics ({infoItems.length})
              </summary>
              <div className="mt-1.5 flex flex-col gap-0.5">
                {infoItems.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 text-xs">
                    <span className="text-zinc-400">{item.title}</span>
                    <Link href={item.actionHref} className="shrink-0 text-zinc-500 hover:text-zinc-300">{item.actionLabel}</Link>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}