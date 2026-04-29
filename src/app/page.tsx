import Link from "next/link";
import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { resetSelectionsAction } from "@/app/matches/actions";
import { db } from "@/lib/db";
import { formatDate, formatIsoWeekLabel } from "@/lib/date-utils";
import { formatMatchVenue, formatSelectionRole } from "@/lib/match-utils";
import { getMatchWeekGroups } from "@/lib/workflow/get-match-week-groups";
import { getTeamFairnessGroups } from "@/lib/workflow/get-team-fairness-gaps";
import { buildAssistantAdvice } from "@/lib/workflow/build-assistant-advice";
import { formatAvailabilityStatus } from "@/lib/player-metrics";
import { getPlanningPeriodFairness, type FairnessFlag } from "@/lib/selection/get-planning-period-fairness";
import { getTeamBurden } from "@/lib/selection/get-team-burden";

type DecisionCard = {
  group: string;
  severity: "blocker" | "warning" | "info";
  title: string;
  detail: string;
  actionHref: string;
  actionLabel: string;
};

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

function formatSelectionState(status: SelectionStatus | null) {
  if (status === SelectionStatus.FINALIZED) return "Finalized";
  if (status === SelectionStatus.DRAFT) return "Draft saved";
  return "Needs first draft";
}

function formatSelectionHint(status: SelectionStatus | null) {
  if (status === SelectionStatus.FINALIZED) return "This match is already locked into history.";
  if (status === SelectionStatus.DRAFT) return "Resume the saved draft before creating more decision debt.";
  return "Generate a first pass, then review fairness and omissions.";
}

export default async function ManagerDeskPage() {
  const activePlanningPeriod = await db.planningPeriod.findFirst({
    orderBy: { startDate: "desc" },
  });

  const [matches, selections, recentFinalizedSelections, players, teams, draftSelections, warnings, fairnessData, teamBurdenData] = await Promise.all([
    db.match.findMany({
      include: { team: { select: { id: true, name: true } } },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    }),
    db.selection.findMany({
      include: { player: { select: { id: true } } },
      orderBy: [{ createdAt: "desc" }],
    }),
    db.selection.findMany({
      where: { status: SelectionStatus.FINALIZED },
      include: {
        player: { select: { id: true } },
        match: { include: { team: { select: { name: true } } } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 4,
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
        supportTargetRelationships: { include: { sourceTeam: { select: { id: true, name: true } } } },
      },
      orderBy: [{ name: "asc" }],
    }),
    db.selection.findMany({
      where: { status: SelectionStatus.DRAFT },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            primaryPosition: true,
            supportSuitability: true,
            developmentReadiness: true,
            nonRotatable: true,
            reducedMatchLoadAllowed: true,
            currentAvailability: true,
            coreTeam: { select: { id: true, name: true } },
          },
        },
        match: { include: { team: { select: { id: true, name: true } } } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    db.warning.findMany({
      where: { resolved: false },
      select: { id: true, severity: true, rule: true, message: true },
    }),
    activePlanningPeriod
      ? getPlanningPeriodFairness(activePlanningPeriod.id)
      : Promise.resolve({ players: [], planningPeriodId: "" }),
    activePlanningPeriod
      ? getTeamBurden(activePlanningPeriod.id)
      : Promise.resolve({ teams: [], planningPeriodId: "" }),
  ]);

  const latestSelectionByMatchId = new Map<string, (typeof selections)[number]>();
  for (const selection of selections) {
    if (!latestSelectionByMatchId.has(selection.matchId)) {
      latestSelectionByMatchId.set(selection.matchId, selection);
    }
  }

  const draftMatches = matches.filter(
    (m) => latestSelectionByMatchId.has(m.id) && latestSelectionByMatchId.get(m.id)?.status === SelectionStatus.DRAFT,
  );
  const matchTeams = teams;
  const { cards: assistantCards, finalizationStatus } = buildAssistantAdvice(
    draftMatches.map((m) => ({ ...m, team: m.team })),
    draftSelections,
    matchTeams,
    warnings.map((w) => ({
      severity: w.severity,
      rule: w.rule,
      message: w.message,
    })),
  );

  const latestSelectionStatusByMatchId = new Map<string, SelectionStatus | null>(
    [...latestSelectionByMatchId.entries()].map(([matchId, selection]) => [matchId, selection.status]),
  );

  const selectedPlayerIdsByMatchId = new Map<string, string[]>();
  for (const selection of selections) {
    const existing = selectedPlayerIdsByMatchId.get(selection.matchId) ?? [];
    existing.push(selection.player.id);
    selectedPlayerIdsByMatchId.set(selection.matchId, existing);
  }

  const enrichedMatches = matches.map((match) => ({
    ...match,
    latestSelectionStatus: latestSelectionStatusByMatchId.get(match.id) ?? null,
  }));

  const actionableMatches = enrichedMatches.filter(
    (match) => match.latestSelectionStatus !== SelectionStatus.FINALIZED,
  );

  const nextActionMatch = actionableMatches[0] ?? null;
  const draftCount = actionableMatches.filter(
    (match) => match.latestSelectionStatus === SelectionStatus.DRAFT,
  ).length;
  const finalizedCount = enrichedMatches.filter(
    (match) => match.latestSelectionStatus === SelectionStatus.FINALIZED,
  ).length;

  const weekGroups = getMatchWeekGroups(enrichedMatches, latestSelectionStatusByMatchId).slice(0, 4);
  const fairnessGroups = getTeamFairnessGroups(players, selectedPlayerIdsByMatchId).slice(0, 4);

  const decisionCards: DecisionCard[] = [];

  const unavailablePlayers = players.filter(
    (p) => p.currentAvailability !== "AVAILABLE",
  );
  for (const p of unavailablePlayers) {
    const severity: "blocker" | "warning" | "info" = p.currentAvailability === "INJURED" || p.currentAvailability === "SICK" ? "warning" : "info";
    decisionCards.push({
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
      decisionCards.push({
        group: "Support needs",
        severity: "warning",
        title: `${team.name} has low core depth`,
        detail: `${coreCount} core players. Minimum accepted: ${minSquad}. Target: ${targetSquad}.`,
        actionHref: "/teams",
        actionLabel: "Review team",
      });
    }

    const supportTargets = team.supportTargetRelationships;
    for (const rel of supportTargets) {
      const sourceCore = teams.find((t) => t.id === rel.sourceTeam.id);
      if (sourceCore) {
        const sourceCoreCount = sourceCore.corePlayers.length;
        const sourceMinSquad = sourceCore.minAcceptedSquadSize ?? 5;
        if (sourceCoreCount - 1 < sourceMinSquad) {
          decisionCards.push({
            group: "Backfill consequences",
            severity: "warning",
            title: `${rel.sourceTeam.name} may be short if supporting ${team.name}`,
            detail: `${rel.sourceTeam.name} has ${sourceCoreCount} core players. Sending one to support ${team.name} may drop below minimum.`,
            actionHref: "/teams",
            actionLabel: "Review paths",
          });
        }
      }
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
        ? "Draft — needs review"
        : "Not generated yet";

  const roundReadinessTone =
    roundReadiness === "ready_to_finalize"
      ? "border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.14)] text-[var(--accent-strong)]"
      : roundReadiness === "draft"
        ? "border-[rgba(208,176,127,0.3)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]"
        : "app-hairline bg-[rgba(255,255,255,0.04)] app-copy-muted";

  const cardGroups = ["Availability", "Support needs", "Backfill consequences", "Development exposure", "Player load", "Rule blockers", "Fairness flags", "Team burden"] as const;

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
        detail: `Donated players in every round of the planning period (${teamBurden.totalDonations} total donations). Consider backfill or reduced voluntary movement.`,
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
    <main className="flex min-h-full flex-col gap-6 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
            Manager Desk
          </span>
          <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
            Decision inbox
          </span>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
              What needs your attention?
            </h1>
            <p className="mt-4 max-w-3xl text-sm app-copy-soft sm:text-base">
              Decision cards highlight blockers and warnings. Round readiness tells you where you stand. Use the one-click path to get to work.
            </p>

            <div className="mt-6 rounded-[1.6rem] border app-hairline bg-[rgba(255,255,255,0.03)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                Round readiness
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${roundReadinessTone}`}>
                  {roundReadinessLabel}
                </span>
              </div>
              <p className="mt-3 text-sm app-copy-soft">
                {activeWeek
                  ? `${activeWeek.label}: ${activeWeek.matches.length} match${activeWeek.matches.length === 1 ? "" : "es"}. ${draftCount} draft${draftCount === 1 ? "" : "es"} waiting. ${finalizedCount} finalized.`
                  : "No active round with matches."}
              </p>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {nextActionMatch ? (
                  <Link
                    className="rounded-[1.25rem] border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 py-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    href={"/selection/" + nextActionMatch.id}
                  >
                    Open next workspace
                  </Link>
                ) : (
                  <Link
                    className="rounded-[1.25rem] border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 py-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    href="/history"
                  >
                    Review history
                  </Link>
                )}
                <Link
                  className="rounded-[1.25rem] border app-hairline bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                  href="/matches"
                >
                  Open Round Board
                </Link>
                <Link
                  className="rounded-[1.25rem] border app-hairline bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                  href="/assistant"
                >
                  Open Assistant Manager
                </Link>
                <form action={resetSelectionsAction}>
                  <input name="resetScope" type="hidden" value="all" />
                  <input name="returnPath" type="hidden" value="/" />
                  <button
                    className="w-full rounded-[1.25rem] border border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.08)] px-4 py-4 text-left text-sm font-medium text-[#f0cbc5] hover:bg-[rgba(185,128,119,0.14)] hover:text-white"
                    type="submit"
                  >
                    Clear all selections
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.03)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                Current match
              </p>
              {nextActionMatch ? (
                <>
                  <p className="mt-3 text-lg font-semibold text-zinc-50">
                    {nextActionMatch.team.name} vs. {nextActionMatch.opponent}
                  </p>
                  <p className="mt-2 text-sm app-copy-soft">
                    {formatDate(nextActionMatch.startsAt)} · {formatIsoWeekLabel(nextActionMatch.startsAt)} · {formatMatchVenue(nextActionMatch.homeAway)}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-zinc-100">
                    {formatSelectionState(nextActionMatch.latestSelectionStatus)}
                  </p>
                  <p className="mt-2 text-sm leading-6 app-copy-soft">
                    {formatSelectionHint(nextActionMatch.latestSelectionStatus)}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm leading-6 app-copy-soft">
                  No unresolved match is waiting right now.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">Draft matches</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{draftCount}</p>
              </div>
              <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">Decision cards</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{decisionCards.length}</p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.03)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                Setup
              </p>
              <div className="mt-2 grid gap-2">
                <Link className="text-sm font-medium text-zinc-100 hover:text-[var(--accent-strong)]" href="/players">
                  Players ({players.length})
                </Link>
                <Link className="text-sm font-medium text-zinc-100 hover:text-[var(--accent-strong)]" href="/teams">
                  Teams ({teams.length})
                </Link>
                <Link className="text-sm font-medium text-zinc-100 hover:text-[var(--accent-strong)]" href="/rules">
                  Rules
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="app-panel rounded-[1.75rem] p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Decision Cards
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">What needs your attention right now</h2>
        </div>

        <div className="mt-6 grid gap-6">
          {cardGroups.map((group) => {
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

      <section className="app-panel rounded-[1.75rem] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Assistant Advice
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-50">
              Structured review of the current round
            </h2>
            <p className="mt-2 text-sm app-copy-soft">
              Support plan, backfill chains, development exposure, load, and decisions needed before finalization.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${finalizationStatus.canFinalize ? "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]" : "border-[rgba(208,176,127,0.28)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]"}`}>
              {finalizationStatus.reason}
            </span>
            <p className="text-[11px] app-copy-muted">
              {finalizationStatus.draftMatchCount} draft · {finalizationStatus.finalizedMatchCount} finalized · {finalizationStatus.totalMatchCount} total
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assistantCards.map((card, index) => {
            const categoryLabel =
              card.category === "support_plan" ? "Support plan" :
              card.category === "backfill_chain" ? "Backfill chain" :
              card.category === "development_exposure" ? "Development" :
              card.category === "player_load" ? "Player load" :
              card.category === "decisions_needed" ? "Decisions" :
              card.category === "fairness_flags" ? "Fairness" :
              card.category === "team_burden" ? "Team burden" :
              "Finalization";

            const isNoIssue = card.recommendation.startsWith("No action needed");

            return (
              <div
                key={`${card.category}-${index}`}
                className={`rounded-[1.35rem] border p-4 ${isNoIssue ? "border app-hairline bg-[rgba(255,255,255,0.025)]" : card.severity === "warning" ? "border-[rgba(208,176,127,0.26)] bg-[rgba(208,176,127,0.06)]" : card.severity === "blocker" ? "border-[rgba(185,128,119,0.26)] bg-[rgba(185,128,119,0.06)]" : "border app-hairline bg-[rgba(255,255,255,0.025)]"}`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                  {categoryLabel}
                </p>
                <p className="mt-2 text-sm font-semibold text-zinc-100">{card.title}</p>
                {!isNoIssue && (
                  <>
                    <p className="mt-2 text-sm app-copy-soft">{card.recommendation}</p>
                    {card.risk !== "N/A" && (
                      <p className="mt-1 text-xs text-[var(--warning)]">
                        Risk: {card.risk}
                      </p>
                    )}
                    {card.alternative !== "N/A" && (
                      <p className="mt-1 text-xs app-copy-muted">
                        Alt: {card.alternative}
                      </p>
                    )}
                    {card.consequence !== "N/A" && (
                      <p className="mt-1 text-xs app-copy-muted">
                        Consequence: {card.consequence}
                      </p>
                    )}
                    <Link
                      className="mt-3 inline-flex h-8 items-center rounded-full border app-hairline px-3 text-xs font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                      href={card.actionHref}
                    >
                      Open Round Board
                    </Link>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <Link
            className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
            href="/assistant"
          >
            Open full Assistant Manager
          </Link>
        </div>
      </section>

      <section className="app-panel rounded-[1.75rem] p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Fairness Watch
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Teams with saved match deviations</h2>
          <p className="mt-2 text-sm app-copy-soft">
            Counts include core and floating work together.
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
        <div className="mt-6 overflow-x-auto">
          {weekGroups.length > 0 ? (
            <div className="flex min-w-full gap-4 pb-2">
              {weekGroups.map((week, index) => {
                const unresolvedMatch = week.matches.find(
                  (match) => match.latestSelectionStatus !== SelectionStatus.FINALIZED,
                );

                return (
                  <div
                    key={week.label}
                    className={`w-[22rem] shrink-0 rounded-[1.5rem] border p-4 ${index === 0 ? "border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(146,171,151,0.16),rgba(24,30,40,0.92))]" : "app-hairline bg-[rgba(255,255,255,0.025)]"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                          {index === 0 && !week.isFullyFinalized ? "Active week" : "Weekly card"}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-zinc-50">{week.label}</p>
                        <p className="mt-2 text-sm app-copy-soft">
                          {unresolvedMatch
                            ? `Next call: ${unresolvedMatch.team.name} vs. ${unresolvedMatch.opponent}.`
                            : "This week is locked."}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${week.isFullyFinalized ? "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]" : "border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]"}`}
                      >
                        {week.isFullyFinalized ? "Week finalized" : "Week in progress"}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-col gap-3">
                      {week.matches.map((match) => (
                        <Link
                          key={match.id}
                          className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-3 hover:bg-[rgba(255,255,255,0.04)]"
                          href={`/selection/${match.id}`}
                        >
                          <p className="text-sm font-semibold text-zinc-100">
                            {match.team.name} vs. {match.opponent}
                          </p>
                          <p className="mt-1 text-sm app-copy-soft">
                            {formatDate(match.startsAt)} · {formatSelectionState(match.latestSelectionStatus)}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
              No registered matches yet. Once a match exists, it should land here as part of a
              week, not as an isolated ledger row.
            </div>
          )}
        </div>
      </section>

      <section className="app-panel rounded-[1.75rem] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Recent History
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-50">Keep the last finalized outcomes nearby</h2>
          </div>
          <Link
            className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
            href="/history"
          >
            Open history
          </Link>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {recentFinalizedSelections.length > 0 ? (
            recentFinalizedSelections.map((selection) => (
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