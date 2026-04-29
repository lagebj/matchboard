import Link from "next/link";
import { SelectionStatus, SelectionRole } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatSelectionRole } from "@/lib/match-utils";
import { formatDate, formatIsoWeekLabel } from "@/lib/date-utils";
import { formatMatchVenue } from "@/lib/match-utils";
import { getMatchWeekGroups } from "@/lib/workflow/get-match-week-groups";
import { getPlanningPeriodFairness, type FairnessFlag } from "@/lib/selection/get-planning-period-fairness";
import { getTeamBurden } from "@/lib/selection/get-team-burden";

function formatSeverityBadge(severity: "blocker" | "warning" | "info") {
  if (severity === "blocker") {
    return (
      <span className="rounded-full border border-[rgba(185,128,119,0.36)] bg-[rgba(185,128,119,0.14)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f0cbc5]">
        Blocker
      </span>
    );
  }
  if (severity === "warning") {
    return (
      <span className="rounded-full border border-[rgba(208,176,127,0.28)] bg-[rgba(208,176,127,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--warning)]">
        Warning
      </span>
    );
  }
  return (
    <span className="rounded-full border app-hairline bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] app-copy-muted">
      Info
    </span>
  );
}

type DecisionCard = {
  group: string;
  severity: "blocker" | "warning" | "info";
  title: string;
  detail: string;
  actionHref: string;
  actionLabel: string;
};

export default async function AssistantManagerPage() {
  const activePlanningPeriod = await db.planningPeriod.findFirst({
    orderBy: { startDate: "desc" },
  });

  const [matches, selections, players, teams, fairnessData, teamBurdenData] = await Promise.all([
    db.match.findMany({
      include: { team: { select: { id: true, name: true } } },
      orderBy: [{ startsAt: "asc" }],
    }),
    db.selection.findMany({
      include: {
        player: { select: { id: true, firstName: true, lastName: true, coreTeamId: true, coreTeam: { select: { id: true, name: true } } } },
        match: { select: { id: true, opponent: true, startsAt: true, team: { select: { id: true, name: true } } } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    db.player.findMany({
      where: { active: true, removedAt: null },
      include: { coreTeam: { select: { id: true, name: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    db.team.findMany({
      where: { archivedAt: null },
      include: {
        corePlayers: { where: { removedAt: null }, select: { id: true } },
        supportTargetRelationships: { include: { sourceTeam: { select: { id: true, name: true } } } },
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

  const latestSelectionByMatchId = new Map<string, (typeof selections)[number]>();
  for (const s of selections) {
    if (!latestSelectionByMatchId.has(s.matchId)) {
      latestSelectionByMatchId.set(s.matchId, s);
    }
  }

  const latestSelectionStatusByMatchId = new Map<string, SelectionStatus | null>(
    [...latestSelectionByMatchId.entries()].map(([mid, sel]) => [mid, sel.status]),
  );

  const enrichedMatches = matches.map((m) => ({
    ...m,
    latestSelectionStatus: latestSelectionStatusByMatchId.get(m.id) ?? null,
  }));

  const weekGroups = getMatchWeekGroups(enrichedMatches, latestSelectionStatusByMatchId);

  const decisionCards: DecisionCard[] = [];

  const unavailablePlayers = players.filter(
    (p) => p.currentAvailability !== "AVAILABLE",
  );
  for (const p of unavailablePlayers) {
    const severity: "blocker" | "warning" | "info" = p.currentAvailability === "INJURED" || p.currentAvailability === "SICK" ? "warning" : "info";
    decisionCards.push({
      group: "Availability",
      severity,
      title: `${p.firstName} ${p.lastName} is ${p.currentAvailability.toLowerCase()}`,
      detail: `${p.coreTeam.name} player. May affect squad depth.`,
      actionHref: `/players/${p.id}`,
      actionLabel: "Open profile",
    });
  }

  for (const team of teams) {
    const coreCount = team.corePlayers.length;
    const minSquad = team.minAcceptedSquadSize ?? team.minSupportPlayers + (team.targetSquadSize ?? 7);
    if (coreCount < minSquad * 0.5) {
      decisionCards.push({
        group: "Support needs",
        severity: "warning",
        title: `${team.name} has low core depth`,
        detail: `${coreCount} core players available. Target squad size: ${team.targetSquadSize ?? 7}.`,
        actionHref: "/teams",
        actionLabel: "Review team",
      });
    }
  }

  const activeWeek = weekGroups.find((w) => !w.isFullyFinalized);
  const roundReadiness = activeWeek
    ? activeWeek.isFullyFinalized
      ? ("ready_to_finalize" as const)
      : activeWeek.matches.some((m) => m.latestSelectionStatus === SelectionStatus.DRAFT)
        ? ("draft" as const)
        : ("not_generated" as const)
    : ("not_generated" as const);

  const roundReadinessLabel =
    roundReadiness === "ready_to_finalize"
      ? "Ready to finalize"
      : roundReadiness === "draft"
        ? "Draft saved — needs review"
        : "Not generated yet";

  const roundReadinessTone =
    roundReadiness === "ready_to_finalize"
      ? "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)]"
      : roundReadiness === "draft"
        ? "border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.12)]"
        : "border-[rgba(202,209,219,0.14)] bg-[rgba(255,255,255,0.04)]";

  const groups = ["Availability", "Support needs", "Backfill consequences", "Development exposure", "Player load", "Rule blockers", "Fairness flags", "Team burden"] as const;

  const flaggedPlayers = fairnessData.players.filter((p) => p.flags.length > 0);
  for (const p of flaggedPlayers) {
    const flagLabels = p.flags.map((f: FairnessFlag) =>
      f === "support_burden_review" ? "Support burden review"
      : f === "hidden_promotion_review" ? "Hidden promotion review"
      : "Core exposure review",
    );
    decisionCards.push({
      group: "Fairness flags",
      severity: "warning",
      title: `${p.playerName}: ${flagLabels.join(", ")}`,
      detail: `Core: ${p.coreCount}, Support: ${p.supportCount}, Development: ${p.developmentCount}. Available rounds: ${p.availableRounds}.`,
      actionHref: `/players/${p.playerId}`,
      actionLabel: "Open profile",
    });
  }

  for (const teamBurden of teamBurdenData.teams) {
    if (teamBurden.highDonorBurden) {
      decisionCards.push({
        group: "Team burden",
        severity: "warning",
        title: `${teamBurden.teamName}: high donor burden`,
        detail: `Donated players in every round of the planning period (${teamBurden.totalDonations} total donations).`,
        actionHref: "/teams",
        actionLabel: "Review team",
      });
    }
    if (teamBurden.repeatedSupportShortfall) {
      decisionCards.push({
        group: "Team burden",
        severity: "warning",
        title: `${teamBurden.teamName}: repeated support shortage`,
        detail: `Missed target support in multiple rounds of the planning period.`,
        actionHref: "/teams",
        actionLabel: "Review team",
      });
    }
    for (const [roundId, delta] of Object.entries(teamBurden.continuityDeltaByRound)) {
      const maxChanges = teams.find((t) => t.id === teamBurden.teamId)?.maxPlayerChangesPerRound ?? 0;
      if (maxChanges > 0 && delta > maxChanges) {
        decisionCards.push({
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
  const cardsByGroup = new Map<string, DecisionCard[]>();
  for (const card of decisionCards) {
    const existing = cardsByGroup.get(card.group) ?? [];
    existing.push(card);
    cardsByGroup.set(card.group, existing);
  }

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              Assistant Manager
            </span>
            <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
              Structured review
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <div>
              <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
                Review the round before you lock it.
              </h1>
              <p className="mt-4 max-w-3xl text-sm app-copy-soft sm:text-base">
                Decision cards highlight what needs your attention. Blockers first, then warnings, then context.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  className="inline-flex h-11 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  href="/matches"
                >
                  Open Round Board
                </Link>
                <Link
                  className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                  href="/planner"
                >
                  Open Squad Planner
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              <div className={`rounded-[1.5rem] border p-5 ${roundReadinessTone}`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                  Round readiness
                </p>
                <p className="mt-3 text-lg font-semibold text-zinc-50">{roundReadinessLabel}</p>
                <p className="mt-2 text-sm app-copy-soft">
                  {activeWeek
                    ? `${activeWeek.label}: ${activeWeek.matches.length} match${activeWeek.matches.length === 1 ? "" : "es"} in this round.`
                    : "No active round with matches."}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">Decision cards</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-50">{decisionCards.length}</p>
                </div>
                <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">Unavailable</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-50">{unavailablePlayers.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {weekGroups.length > 0 && (
        <section className="app-panel rounded-[1.75rem] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Active Round
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">
                {activeWeek ? activeWeek.label : "No active round"}
              </h2>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(activeWeek ?? weekGroups[0]).matches.map((match) => {
              const matchSelections = selections.filter((s) => s.matchId === match.id);
              const status = match.latestSelectionStatus;
              return (
                <Link
                  key={match.id}
                  className="rounded-[1.45rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4 hover:bg-[rgba(255,255,255,0.05)]"
                  href={`/selection/${match.id}`}
                >
                  <p className="text-sm font-semibold text-zinc-100">
                    {match.team.name} vs. {match.opponent}
                  </p>
                  <p className="mt-1 text-sm app-copy-soft">
                    {formatDate(match.startsAt)} · {formatIsoWeekLabel(match.startsAt)} · {formatMatchVenue(match.homeAway)}
                  </p>
                  <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
                    status === SelectionStatus.FINALIZED
                      ? "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]"
                      : status === SelectionStatus.DRAFT
                        ? "border-[rgba(208,176,127,0.26)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]"
                        : "app-hairline bg-[rgba(255,255,255,0.04)] app-copy-muted"
                  }`}>
                    {status === SelectionStatus.FINALIZED ? "Finalized" : status === SelectionStatus.DRAFT ? "Draft" : "Not generated"}
                  </span>
                  {matchSelections.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Array.from(new Set(matchSelections.map((s) => s.role))).map((role) => {
                        const count = matchSelections.filter((s) => s.role === role).length;
                        return (
                          <span key={role} className="rounded-full border app-hairline bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] app-copy-muted">
                            {formatSelectionRole(role)} ×{count}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="app-panel rounded-[1.75rem] p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Agenda
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Decision cards grouped by category</h2>
        </div>

        <div className="mt-6 grid gap-6">
          {groups.map((group) => {
            const cards = cardsByGroup.get(group) ?? [];
            return (
              <div key={group}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted mb-3">
                  {group}
                </p>
                {cards.length > 0 ? (
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
                ) : (
                  <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
                    No issues in this category right now.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}