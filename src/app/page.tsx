import Link from "next/link";
import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDate, formatIsoWeekLabel } from "@/lib/date-utils";
import { formatMatchVenue } from "@/lib/match-utils";
import { getMatchWeekGroups } from "@/lib/workflow/get-match-week-groups";
import { getTeamFairnessGroups } from "@/lib/workflow/get-team-fairness-gaps";

function formatSelectionState(status: SelectionStatus | null) {
  if (status === SelectionStatus.FINALIZED) {
    return "Finalized";
  }

  if (status === SelectionStatus.DRAFT) {
    return "Draft saved";
  }

  return "Needs first draft";
}

function formatSelectionHint(status: SelectionStatus | null) {
  if (status === SelectionStatus.FINALIZED) {
    return "This match is already locked into history.";
  }

  if (status === SelectionStatus.DRAFT) {
    return "Resume the saved draft before creating more decision debt.";
  }

  return "Generate a first pass, then review fairness and omissions.";
}

function buildNextActionSummary(input: {
  hasMatches: boolean;
  hasPlayers: boolean;
  hasTeams: boolean;
  nextActionMatch: {
    id: string;
  } | null;
}) {
  if (!input.hasTeams) {
    return {
      body: "Set the teams first.",
      ctaHref: "/teams?create=1",
      ctaLabel: "Create first team",
      title: "Set up the team registry",
    };
  }

  if (!input.hasPlayers) {
    return {
      body: "Build the player group next.",
      ctaHref: "/players?create=1",
      ctaLabel: "Create first player",
      title: "Build the player registry",
    };
  }

  if (!input.hasMatches) {
    return {
      body: "The group is ready. Put the first match on the board.",
      ctaHref: "/matches?create=1",
      ctaLabel: "Create first match",
      title: "Create the first week workspace",
    };
  }

  if (input.nextActionMatch) {
    return {
      body: "Open the next unresolved match and keep the week in view.",
      ctaHref: `/selection/${input.nextActionMatch.id}`,
      ctaLabel: "Open next workspace",
      title: "Work the next unresolved match",
    };
  }

  return {
    body: "Everything is locked. Review fairness or history before the next week starts.",
    ctaHref: "/history",
    ctaLabel: "Review history",
    title: "Review the locked rotation story",
  };
}

function getSequenceSteps(input: {
  hasMatches: boolean;
  hasPlayers: boolean;
  hasTeams: boolean;
  nextActionMatchId: string | null;
}) {
  return [
    {
      detail: input.hasTeams ? "Teams are in place." : "Create the teams that define the ladder.",
      href: "/teams",
      label: "Registry truth",
      status: input.hasTeams ? "ready" : "active",
    },
    {
      detail: input.hasPlayers ? "Player pool is available." : "Add the active player pool next.",
      href: "/players",
      label: "Player group",
      status: input.hasPlayers ? "ready" : input.hasTeams ? "active" : "waiting",
    },
    {
      detail: input.hasMatches ? "Weeks are on the board." : "Put the next week on the board.",
      href: "/matches",
      label: "Week board",
      status:
        input.hasMatches ? "ready" : input.hasTeams && input.hasPlayers ? "active" : "waiting",
    },
    {
      detail: input.nextActionMatchId
        ? "A live match workspace is waiting."
        : "Nothing unresolved is waiting right now.",
      href: input.nextActionMatchId ? `/selection/${input.nextActionMatchId}` : "/history",
      label: "Lock decision",
      status: input.nextActionMatchId ? "active" : input.hasMatches ? "ready" : "waiting",
    },
  ] as const;
}

export default async function HomePage() {
  const [matches, selections, recentFinalizedSelections, players, teamCount] = await Promise.all([
    db.match.findMany({
      include: {
        targetTeam: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    }),
    db.matchSelection.findMany({
      include: {
        players: {
          where: {
            wasManuallyRemoved: false,
          },
          select: {
            playerId: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { finalizedAt: "desc" }],
    }),
    db.matchSelection.findMany({
      where: {
        status: SelectionStatus.FINALIZED,
      },
      include: {
        match: {
          include: {
            targetTeam: {
              select: {
                name: true,
              },
            },
          },
        },
        players: {
          select: {
            id: true,
            wasManuallyRemoved: true,
          },
        },
      },
      orderBy: [{ finalizedAt: "desc" }, { createdAt: "desc" }],
      take: 4,
    }),
    db.player.findMany({
      where: {
        active: true,
        removedAt: null,
      },
      include: {
        coreTeam: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        {
          coreTeam: {
            name: "asc",
          },
        },
        { firstName: "asc" },
        { lastName: "asc" },
        { playerCode: "asc" },
      ],
    }),
    db.team.count({
      where: {
        archivedAt: null,
      },
    }),
  ]);

  const latestSelectionByMatchId = new Map<string, (typeof selections)[number]>();

  for (const selection of selections) {
    if (!latestSelectionByMatchId.has(selection.matchId)) {
      latestSelectionByMatchId.set(selection.matchId, selection);
    }
  }

  const latestSelectionStatusByMatchId = new Map<string, SelectionStatus | null>(
    [...latestSelectionByMatchId.entries()].map(([matchId, selection]) => [matchId, selection.status]),
  );
  const selectedPlayerIdsByMatchId = new Map<string, string[]>(
    [...latestSelectionByMatchId.entries()].map(([matchId, selection]) => [
      matchId,
      selection.players.map((player) => player.playerId),
    ]),
  );

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
  const nextActionSummary = buildNextActionSummary({
    hasMatches: matches.length > 0,
    hasPlayers: players.length > 0,
    hasTeams: teamCount > 0,
    nextActionMatch,
  });
  const sequenceSteps = getSequenceSteps({
    hasMatches: matches.length > 0,
    hasPlayers: players.length > 0,
    hasTeams: teamCount > 0,
    nextActionMatchId: nextActionMatch?.id ?? null,
  });

  return (
    <main className="flex min-h-full flex-col gap-6 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                Coach Desk
              </span>
              <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                Assistant-manager flow
              </span>
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
              Work the week, spot fairness drift, then lock decisions forward.
            </h1>
            <p className="mt-4 max-w-3xl text-sm app-copy-soft sm:text-base">
              Next call first. The week and the fairness gaps stay nearby.
            </p>

            <div className="mt-6 rounded-[1.6rem] border app-hairline bg-[rgba(255,255,255,0.03)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                Suggested next action
              </p>
              <p className="mt-3 text-2xl font-semibold text-zinc-50">{nextActionSummary.title}</p>
              <p className="mt-3 max-w-2xl text-sm app-copy-soft">{nextActionSummary.body}</p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  className="inline-flex h-11 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  href={nextActionSummary.ctaHref}
                >
                  {nextActionSummary.ctaLabel}
                </Link>
                <Link
                  className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                  href="/matches"
                >
                  Open weekly queue
                </Link>
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
                    {nextActionMatch.targetTeam.name} vs. {nextActionMatch.opponent}
                  </p>
                  <p className="mt-2 text-sm app-copy-soft">
                    {formatDate(nextActionMatch.startsAt)} · {formatIsoWeekLabel(nextActionMatch.startsAt)} · {formatMatchVenue(nextActionMatch.homeOrAway)}
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

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                  Open workspaces
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{actionableMatches.length}</p>
              </div>
              <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                  Drafts
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{draftCount}</p>
              </div>
              <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                  Finalized
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{finalizedCount}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="app-panel rounded-[1.75rem] p-6 xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Operating Sequence
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">The assistant manager keeps the loop short</h2>
              <p className="mt-2 text-sm app-copy-soft">
                Work from left to right, then loop back when the next week needs attention.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-4">
            {sequenceSteps.map((step, index) => (
              <Link
                key={step.label}
                className={`rounded-[1.45rem] border px-4 py-4 ${
                  step.status === "active"
                    ? "border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(146,171,151,0.18),rgba(24,30,40,0.92))]"
                    : step.status === "ready"
                      ? "border-[rgba(140,167,146,0.24)] bg-[rgba(140,167,146,0.08)]"
                      : "border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)]"
                }`}
                href={step.href}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                    Step {index + 1}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.18em] app-copy-muted">
                    {step.status}
                  </span>
                </div>
                <p className="mt-4 text-lg font-semibold text-zinc-50">{step.label}</p>
                <p className="mt-2 text-sm app-copy-soft">{step.detail}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="app-panel rounded-[1.75rem] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Weekly Board
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">Every week stays readable from the desk</h2>
            </div>
            <Link
              className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
              href="/matches"
            >
              Open match queue
            </Link>
          </div>

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
                      className={`w-[22rem] shrink-0 rounded-[1.5rem] border p-4 ${
                        index === 0
                          ? "border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(146,171,151,0.16),rgba(24,30,40,0.92))]"
                          : "app-hairline bg-[rgba(255,255,255,0.025)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                            Slide {index + 1}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-zinc-50">{week.label}</p>
                          <p className="mt-2 text-sm app-copy-soft">
                            {unresolvedMatch
                              ? `Assistant manager: ${unresolvedMatch.targetTeam.name} vs. ${unresolvedMatch.opponent} is the next call.`
                              : "Assistant manager: this week is fully locked."}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${
                            week.isFullyFinalized
                              ? "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]"
                              : "border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]"
                          }`}
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
                              {match.targetTeam.name} vs. {match.opponent}
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
                No fairness deviations are currently visible among active players without a core-drop
                allowance.
              </div>
            )}
          </div>
        </section>
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
            recentFinalizedSelections.map((selection) => {
              const selectedPlayerCount = selection.players.filter(
                (player) => !player.wasManuallyRemoved,
              ).length;

              return (
                <Link
                  key={selection.id}
                  className="rounded-[1.45rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4 hover:bg-[rgba(255,255,255,0.05)]"
                  href={`/selection/${selection.matchId}`}
                >
                  <p className="text-sm font-semibold text-zinc-100">
                    {selection.match.targetTeam.name} vs. {selection.match.opponent}
                  </p>
                  <p className="mt-1 text-sm app-copy-soft">
                    {formatDate(selection.match.startsAt)} · {formatIsoWeekLabel(selection.match.startsAt)}
                  </p>
                  <p className="mt-3 text-sm app-copy-soft">
                    {selectedPlayerCount} player{selectedPlayerCount === 1 ? "" : "s"} finalized.
                  </p>
                </Link>
              );
            })
          ) : (
            <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft lg:col-span-2">
              No finalized selections yet. Once a week is locked, the result should stay visible
              here as context for the next call.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
