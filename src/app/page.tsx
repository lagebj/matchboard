import Link from "next/link";
import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/date-utils";
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
    return "Selection is saved into history. Reopen it if you need to review the reasoning.";
  }

  if (status === SelectionStatus.DRAFT) {
    return "A draft already exists. Resume the workspace and finish the review.";
  }

  return "No saved selection yet. Generate a suggestion or build the squad manually.";
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
  const recentMatches = [...enrichedMatches]
    .sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime())
    .slice(0, 4);

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]">
        <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                Match-Day Workspace
              </span>
              <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                Pass 1 foundation
              </span>
            </div>

            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
                Start from the next decision, not from the database.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 app-copy-soft sm:text-base">
                Matchboard works best when the coach can land directly in the next match that needs
                attention, review the pressure points quickly, and continue the squad decision with
                minimal context switching.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Actionable Matches
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{actionableMatches.length}</p>
                <p className="mt-2 text-sm app-copy-soft">
                  Registered matches that still need drafting or final review.
                </p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Drafts In Progress
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{draftCount}</p>
                <p className="mt-2 text-sm app-copy-soft">
                  Matches already in motion and ready to resume.
                </p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Registries Ready
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">
                  {playerCount}/{teamCount}
                </p>
                <p className="mt-2 text-sm app-copy-soft">
                  Active players and teams currently available to selection work.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="inline-flex h-11 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                href={nextActionMatch ? `/selection/${nextActionMatch.id}` : "/matches"}
              >
                {nextActionMatch ? "Open next workspace" : "Open matches"}
              </Link>
              <Link
                className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                href="/matches?create=1"
              >
                Create match
              </Link>
              <Link
                className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                href="/players"
              >
                Review players
              </Link>
            </div>
          </div>
        </section>

        <aside className="app-panel rounded-[1.75rem] p-6">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Coach Desk
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">What needs attention now</h2>
            </div>

            {nextActionMatch ? (
              <div className="rounded-2xl border border-[var(--border-strong)] bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] app-copy-muted">Next up</p>
                <p className="mt-2 text-lg font-semibold text-zinc-50">
                  {nextActionMatch.targetTeam.name} vs. {nextActionMatch.opponent}
                </p>
                <p className="mt-1 text-sm app-copy-soft">
                  {formatDate(nextActionMatch.startsAt)} · {formatMatchVenue(nextActionMatch.homeOrAway)}
                </p>
                <div className="mt-4 rounded-xl border app-hairline bg-[rgba(0,0,0,0.16)] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] app-copy-muted">
                    Current state
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-100">
                    {formatSelectionState(nextActionMatch.latestSelectionStatus)}
                  </p>
                  <p className="mt-2 text-sm app-copy-soft">
                    {formatSelectionHint(nextActionMatch.latestSelectionStatus)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-sm font-medium text-zinc-100">No open match workspace right now.</p>
                <p className="mt-2 text-sm app-copy-soft">
                  Create a new match or review finalized history before the next selection cycle.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">{draftCount} draft match(es) in progress</p>
                <p className="mt-1 text-sm app-copy-soft">
                  Continue review and manual adjustments before finalizing.
                </p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">{unstartedCount} match(es) without a saved draft</p>
                <p className="mt-1 text-sm app-copy-soft">
                  Start these from the match list once the immediate workspace is handled.
                </p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">{finalizedCount} match(es) already finalized</p>
                <p className="mt-1 text-sm app-copy-soft">
                  History is available for workload and floating fairness checks.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="app-panel rounded-[1.75rem] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Match Flow
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">Work the match in one direction</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 app-copy-soft">
                The workflow should feel like a calm checklist: prepare the registry, open the
                match, review the generated reasoning, adjust only where needed, then finalize.
              </p>
            </div>
            <Link
              className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
              href="/matches"
            >
              Open matches
            </Link>
          </div>

          <div className="mt-6 grid gap-3">
            {[
              {
                step: "1",
                title: "Prepare the registry",
                body: "Keep teams and player availability current so the generator has clean inputs.",
              },
              {
                step: "2",
                title: "Open the active match",
                body: "Resume the current workspace instead of browsing across multiple admin screens.",
              },
              {
                step: "3",
                title: "Review the pressure points",
                body: "Support shortfalls, development reservations, and omitted core players should appear before table detail.",
              },
              {
                step: "4",
                title: "Adjust and finalize",
                body: "Manual overrides should feel deliberate and traceable, not like hidden corrections.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="grid gap-3 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)]"
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Recent Activity
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">Keep the last decisions in view</h2>
            </div>
            <Link
              className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
              href="/history"
            >
              Open history
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {recentFinalizedSelections.length > 0 ? (
              recentFinalizedSelections.map((selection) => {
                const selectedPlayerCount = selection.players.filter(
                  (player) => !player.wasManuallyRemoved,
                ).length;

                return (
                  <div
                    key={selection.id}
                    className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-100">
                          {selection.match.targetTeam.name} vs. {selection.match.opponent}
                        </p>
                        <p className="mt-1 text-sm app-copy-soft">
                          {formatDate(selection.match.startsAt)} · {formatMatchVenue(selection.match.homeOrAway)} · {selectedPlayerCount} player(s) finalized
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
                No finalized selections yet. Once a squad is finalized, it should become easy to
                reopen and compare against future choices.
              </div>
            )}
          </div>
        </section>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="app-panel rounded-[1.75rem] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Recent Matches
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">Jump back into the schedule</h2>
            </div>
            <Link
              className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
              href="/matches"
            >
              View all
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {recentMatches.length > 0 ? (
              recentMatches.map((match) => (
                <div
                  key={match.id}
                  className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-zinc-100">
                          {match.targetTeam.name} vs. {match.opponent}
                        </p>
                        <span className="rounded-full border app-hairline px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] app-copy-muted">
                          {formatSelectionState(match.latestSelectionStatus)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm app-copy-soft">
                        {formatDate(match.startsAt)} · {formatMatchVenue(match.homeOrAway)}
                        {match.matchType ? ` · ${match.matchType}` : ""}
                      </p>
                    </div>
                    <Link
                      className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                      href={`/selection/${match.id}`}
                    >
                      Open
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
                No matches yet. Create the first match to establish the working rhythm of the app.
              </div>
            )}
          </div>
        </section>

        <section className="app-panel rounded-[1.75rem] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Quick Routes
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">The other operational surfaces</h2>
          <div className="mt-6 grid gap-3">
            {[
              {
                href: "/players",
                title: "Players",
                body: "Keep identities, positions, availability, and floating permissions current.",
              },
              {
                href: "/teams",
                title: "Teams",
                body: "Maintain support and development relationships that shape squad reservations.",
              },
              {
                href: "/rules",
                title: "Rules",
                body: "Review the editable thresholds that influence spacing, floating, and fairness.",
              },
            ].map((item) => (
              <Link
                key={item.href}
                className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4 hover:bg-[rgba(255,255,255,0.05)]"
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
