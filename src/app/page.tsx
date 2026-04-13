import Link from "next/link";
import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDate, formatIsoWeekLabel } from "@/lib/date-utils";
import { formatMatchVenue } from "@/lib/match-utils";

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
    return "Locked into history and ready to review against future choices.";
  }

  if (status === SelectionStatus.DRAFT) {
    return "Resume the saved workspace and finish the pressure review.";
  }

  return "No saved selection yet. Generate a first pass or build the squad manually.";
}

function groupMatchesByWeek<T extends { startsAt: Date }>(matches: T[]) {
  const groups = new Map<string, T[]>();

  for (const match of matches) {
    const label = formatIsoWeekLabel(match.startsAt);
    const existing = groups.get(label) ?? [];
    existing.push(match);
    groups.set(label, existing);
  }

  return [...groups.entries()].map(([label, weekMatches]) => ({
    label,
    matches: weekMatches,
  }));
}

export default async function HomePage() {
  const [matches, selections, recentFinalizedSelections, playerCount, teamCount] = await Promise.all([
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
      select: {
        createdAt: true,
        finalizedAt: true,
        matchId: true,
        status: true,
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
    db.player.count({
      where: {
        removedAt: null,
      },
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

  const enrichedMatches = matches.map((match) => ({
    ...match,
    latestSelectionStatus: latestSelectionByMatchId.get(match.id)?.status ?? null,
  }));
  const actionableMatches = enrichedMatches.filter(
    (match) => match.latestSelectionStatus !== SelectionStatus.FINALIZED,
  );
  const nextActionMatch = actionableMatches[0] ?? null;
  const draftCount = actionableMatches.filter(
    (match) => match.latestSelectionStatus === SelectionStatus.DRAFT,
  ).length;
  const unstartedCount = actionableMatches.filter((match) => match.latestSelectionStatus === null).length;
  const finalizedCount = enrichedMatches.filter(
    (match) => match.latestSelectionStatus === SelectionStatus.FINALIZED,
  ).length;
  const queueWeeks = groupMatchesByWeek(actionableMatches).slice(0, 4);

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                Coach Desk
              </span>
              <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                Decision-first home
              </span>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
              <div>
                <h2 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
                  Open the next match with the wider rotation story already in view.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 app-copy-soft sm:text-base">
                  The landing page should feel like a live desk, not a database index. Start from
                  the current queue, keep recent outcomes visible, and only then dive into the
                  deeper registry and rules surfaces.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    className="inline-flex h-11 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    href={nextActionMatch ? `/selection/${nextActionMatch.id}` : "/matches"}
                  >
                    {nextActionMatch ? "Open next workspace" : "Open match queue"}
                  </Link>
                  <Link
                    className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                    href="/matches?create=1"
                  >
                    Create match
                  </Link>
                  <Link
                    className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                    href="/history"
                  >
                    Review history
                  </Link>
                </div>
              </div>

              <div className="rounded-[1.6rem] border app-hairline bg-[rgba(255,255,255,0.035)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Active decision
                </p>
                {nextActionMatch ? (
                  <div className="mt-4 flex flex-col gap-4">
                    <div>
                      <p className="text-lg font-semibold text-zinc-50">
                        {nextActionMatch.targetTeam.name} vs. {nextActionMatch.opponent}
                      </p>
                      <p className="mt-2 text-sm app-copy-soft">
                        {formatDate(nextActionMatch.startsAt)} · {formatIsoWeekLabel(nextActionMatch.startsAt)} · {formatMatchVenue(nextActionMatch.homeOrAway)}
                      </p>
                    </div>
                    <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.16)] px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] app-copy-muted">
                        Current state
                      </p>
                      <p className="mt-2 text-sm font-semibold text-zinc-100">
                        {formatSelectionState(nextActionMatch.latestSelectionStatus)}
                      </p>
                      <p className="mt-2 text-sm leading-6 app-copy-soft">
                        {formatSelectionHint(nextActionMatch.latestSelectionStatus)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 app-copy-soft">
                    No open match workspace right now. Create the next fixture or inspect the
                    historical loop before a new decision cycle starts.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="grid gap-4">
          <section className="app-panel rounded-[1.75rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Desk Signals
            </p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                  Actionable matches
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{actionableMatches.length}</p>
                <p className="mt-2 text-sm app-copy-soft">
                  Open workspaces still waiting for a first pass or final review.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                  <p className="text-sm font-medium text-zinc-100">{draftCount} draft match(es)</p>
                  <p className="mt-1 text-sm app-copy-soft">
                    Resume these before generating more future work.
                  </p>
                </div>
                <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                  <p className="text-sm font-medium text-zinc-100">{unstartedCount} queue item(s) not started</p>
                  <p className="mt-1 text-sm app-copy-soft">
                    These still need their first draft.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="app-panel rounded-[1.75rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Registry Footing
            </p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                <p className="text-sm font-medium text-zinc-100">{playerCount} active player record(s)</p>
                <p className="mt-1 text-sm app-copy-soft">
                  Selection quality depends on keeping availability and positions current.
                </p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                <p className="text-sm font-medium text-zinc-100">{teamCount} active team record(s)</p>
                <p className="mt-1 text-sm app-copy-soft">
                  Support and development relationships stay attached to these teams.
                </p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                <p className="text-sm font-medium text-zinc-100">{finalizedCount} finalized match(es)</p>
                <p className="mt-1 text-sm app-copy-soft">
                  Recent history is already available to shape the next call.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="app-panel rounded-[1.75rem] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Open Weeks
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">Keep the live queue grouped by calendar rhythm</h2>
            </div>
            <Link
              className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
              href="/matches"
            >
              Open match queue
            </Link>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {queueWeeks.length > 0 ? (
              queueWeeks.map((week) => (
                <div
                  key={week.label}
                  className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                        {week.label}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-zinc-50">
                        {week.matches.length} open fixture{week.matches.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-muted">
                      {week.matches.filter((match) => match.latestSelectionStatus === SelectionStatus.DRAFT).length} draft
                    </span>
                  </div>
                  <div className="mt-4 flex flex-col gap-3">
                    {week.matches.slice(0, 3).map((match) => (
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
              ))
            ) : (
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft lg:col-span-2">
                No open queue right now. Once a new match is created, it should appear here before
                you need to go hunting through deeper lists.
              </div>
            )}
          </div>
        </section>

        <section className="app-panel rounded-[1.75rem] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Closed Loop
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">Keep the last outcomes visible</h2>
            </div>
            <Link
              className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
              href="/history"
            >
              Open history
            </Link>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {recentFinalizedSelections.length > 0 ? (
              recentFinalizedSelections.map((selection) => {
                const selectedPlayerCount = selection.players.filter(
                  (player) => !player.wasManuallyRemoved,
                ).length;

                return (
                  <div
                    key={selection.id}
                    className="rounded-[1.45rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">
                          {selection.match.targetTeam.name} vs. {selection.match.opponent}
                        </p>
                        <p className="mt-1 text-sm app-copy-soft">
                          {formatDate(selection.match.startsAt)} · {formatIsoWeekLabel(selection.match.startsAt)} · {selectedPlayerCount} player(s) finalized
                        </p>
                      </div>
                      <Link
                        className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                        href={`/selection/${selection.matchId}`}
                      >
                        Review selection
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
                No finalized selections yet. Once a squad is locked, it should stay easy to
                compare against the next week&apos;s choices.
              </div>
            )}
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="app-panel rounded-[1.75rem] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Operating Loop
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Work the app in one direction</h2>
          <div className="mt-6 grid gap-3">
            {[
              {
                step: "1",
                title: "Trust the registry",
                body: "Keep teams, positions, availability, and floating permissions clean before the queue heats up.",
              },
              {
                step: "2",
                title: "Read the live queue",
                body: "Open the closest unresolved fixture and keep week context visible while you decide.",
              },
              {
                step: "3",
                title: "Inspect reasons before editing",
                body: "Warnings, omissions, and movement signals should appear before raw table detail.",
              },
              {
                step: "4",
                title: "Finalize into memory",
                body: "Every locked decision should stay legible so the next selection starts from evidence, not guesswork.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="grid gap-3 rounded-[1.45rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] text-sm font-semibold text-[var(--accent-strong)]">
                  {item.step}
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 app-copy-soft">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="app-panel rounded-[1.75rem] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Quick Routes
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Open the supporting surfaces when needed</h2>
          <div className="mt-6 grid gap-3">
            {[
              {
                href: "/players",
                title: "Players",
                body: "Scan who is unavailable, floating-capable, or next in line for profile review.",
              },
              {
                href: "/teams",
                title: "Teams",
                body: "Adjust support demand and development pathways with target context intact.",
              },
              {
                href: "/rules",
                title: "Rules",
                body: "Tune thresholds and preferences without losing sight of how the engine reads them.",
              },
            ].map((item) => (
              <Link
                key={item.href}
                className="rounded-[1.45rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4 hover:bg-[rgba(255,255,255,0.05)]"
                href={item.href}
              >
                <p className="text-sm font-semibold text-zinc-100">{item.title}</p>
                <p className="mt-1 text-sm leading-6 app-copy-soft">{item.body}</p>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
