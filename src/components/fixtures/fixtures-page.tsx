"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  FixturesOverview,
  FixturePeriod,
  FixtureRound,
  FixtureMatch,
} from "@/domain/fixtures/types";
import {
  fetchFixturesOverview,
  fixturePopulateAllAction,
} from "@/domain/fixtures/actions";
import {
  TouchlinePageHeader,
  TouchlineButton,
  ScorebookRoundSection,
  ScorebookMatchRow,
} from "@/components/touchline";
import { PageSkeleton } from "@/components/ui/skeleton";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * League — the period → round → match hierarchy, Touchline sports-scorebook
 * grammar (ADR-0134 §7, bundle `06_MATCH_AND_SCOREBOOK_GRAMMAR.md`). A round is
 * a scorebook SECTION, not a card: a Barlow week marker, the plan state as
 * muted text, the match count and one `Board ›` action; past results are dense
 * divider rows with neutral Barlow scores.
 *
 * Domain flow unchanged: `fetchFixturesOverview()` /
 * `fixturePopulateAllAction`, the `/matches/{id}` and `/rounds/{id}` links, the
 * league-season selector, and every plan-integrity count are exactly as before.
 */

function roundStateLabel(state: FixtureRound["selectionState"]): string {
  switch (state) {
    case "NOT_GENERATED":
      return "Not generated";
    case "DRAFT":
      return "Draft";
    case "BLOCKED":
      return "Blocked";
    case "READY":
      return "Ready";
    case "FINALIZED":
      return "Final";
    default:
      return "";
  }
}

function FixtureMatchRow({ match }: { match: FixtureMatch }) {
  const isCancelled = match.matchStatus === "CANCELLED";
  const completedResult =
    match.reportState.state === "COMPLETED" ? match.reportState.result : undefined;

  const blockerCount = match.blockerCount ?? 0;
  const decisionRequiredCount = match.decisionRequiredCount ?? 0;
  const planningAttention =
    blockerCount > 0
      ? { label: `${blockerCount} blocked`, tone: "danger" as const }
      : decisionRequiredCount > 0
        ? {
            label: `${decisionRequiredCount} decision${decisionRequiredCount === 1 ? "" : "s"}`,
            tone: "warning" as const,
          }
        : null;
  const reportAttention =
    match.reportState.state === "DRAFT_REPORT_INCOMPLETE"
      ? { label: "Report incomplete", tone: "warning" as const }
      : null;

  const presentation = buildMatchPresentation({
    id: match.id,
    href: `/matches/${match.id}`,
    teamName: match.teamName,
    opponentName: match.opponent,
    isHome: match.venue === "Home",
    kickoffAt: match.startsAt ?? null,
    lifecycleStatus: isCancelled ? "cancelled" : match.lifecycleStatus,
    ownGoals: completedResult ? completedResult.goalsFor : null,
    opponentGoals: completedResult ? completedResult.goalsAgainst : null,
    outcome: completedResult ? completedResult.outcome : null,
    planningAttention,
    reportAttention,
    cancelledReason: isCancelled ? (match.cancelledReason ?? null) : null,
  });

  return <ScorebookMatchRow presentation={presentation} />;
}

function RoundSection({ round }: { round: FixtureRound }) {
  const stateLabel = roundStateLabel(round.selectionState);
  const matchCount = round.matches.length;
  const attention =
    round.blockerCount > 0
      ? `${round.blockerCount} blocked`
      : round.decisionRequiredCount > 0
        ? `${round.decisionRequiredCount} decision${round.decisionRequiredCount === 1 ? "" : "s"}`
        : null;

  const summary = [
    stateLabel || null,
    matchCount > 0 ? `${matchCount} match${matchCount === 1 ? "" : "es"}` : null,
    attention,
  ]
    .filter(Boolean)
    .join(" · ");

  if (matchCount === 0) {
    return (
      <ScorebookRoundSection
        marker={round.title}
        dateLabel={round.dateRange}
        summary={summary || "No matches"}
        boardHref={`/rounds/${round.id}`}
        boardAriaLabel={`Open ${round.title} round board`}
      >
        <p className="py-3 text-[13px] text-[var(--text-muted)]">No matches in this round.</p>
      </ScorebookRoundSection>
    );
  }

  return (
    <ScorebookRoundSection
      marker={round.title}
      dateLabel={round.dateRange}
      summary={summary}
      boardHref={`/rounds/${round.id}`}
      boardAriaLabel={`Open ${round.title} round board`}
    >
      {round.matches.map((match) => (
        <FixtureMatchRow key={match.id} match={match} />
      ))}
    </ScorebookRoundSection>
  );
}

function PeriodSection({ period }: { period: FixturePeriod }) {
  const hasNotGenerated = period.rounds.some(
    (r) => r.selectionState === "NOT_GENERATED",
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const counts = {
    notGenerated: period.rounds.filter((r) => r.selectionState === "NOT_GENERATED").length,
    draft: period.rounds.filter(
      (r) => r.selectionState === "DRAFT" || r.selectionState === "BLOCKED",
    ).length,
    ready: period.rounds.filter((r) => r.selectionState === "READY").length,
    finalized: period.rounds.filter((r) => r.selectionState === "FINALIZED").length,
  };
  const totalBlockers = period.rounds.reduce((sum, r) => sum + r.blockerCount, 0);
  const totalDecisions = period.rounds.reduce((sum, r) => sum + r.decisionRequiredCount, 0);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[20px] font-[620] text-[var(--foreground)]">{period.title}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-muted)]">
            {counts.notGenerated > 0 && <span>{counts.notGenerated} not generated</span>}
            {counts.draft > 0 && <span className="text-[var(--warning)]">{counts.draft} draft</span>}
            {counts.ready > 0 && <span>{counts.ready} ready</span>}
            {counts.finalized > 0 && <span>{counts.finalized} finalized</span>}
            {totalBlockers > 0 && (
              <span className="text-[var(--danger)]">{totalBlockers} blocked</span>
            )}
            {totalDecisions > 0 && (
              <span className="text-[var(--warning)]">
                {totalDecisions} decision{totalDecisions === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        {hasNotGenerated && (
          <TouchlineButton
            type="button"
            variant="primary"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const fd = new FormData();
                fd.set("leagueSeasonId", period.id);
                const result = await fixturePopulateAllAction({ error: "" }, fd);
                if (result.error) setStatusMessage(result.error);
                else
                  router.push(
                    `/rounds/${
                      period.rounds.find((r) => r.selectionState === "NOT_GENERATED")?.id ??
                      period.rounds[0]?.id ??
                      "/"
                    }`,
                  );
              });
            }}
          >
            {isPending ? "Generating…" : "Generate all draft squads"}
          </TouchlineButton>
        )}
        {statusMessage && (
          <span className="text-[12px] text-[var(--text-muted)]">{statusMessage}</span>
        )}
      </div>

      <div className="flex flex-col">
        {period.rounds.length === 0 ? (
          <p className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] p-4 text-center text-[13px] text-[var(--text-muted)]">
            No rounds in this period.
          </p>
        ) : (
          period.rounds.map((round) => <RoundSection key={round.id} round={round} />)
        )}
      </div>
    </section>
  );
}

export function FixturesPage({ orgSlug }: { orgSlug: string }) {
  const [data, setData] = useState<FixturesOverview | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await fetchFixturesOverview();
      setData(result);
      if (result.periods.length > 0 && !selectedPeriodId) {
        const currentPeriod = result.periods.find((p) => p.isCurrent);
        setSelectedPeriodId((currentPeriod ?? result.periods[0]).id);
      }
    });
  }, [startTransition]);

  const selectedPeriod =
    (data?.periods ?? []).find((p) => p.id === selectedPeriodId) ?? data?.periods[0] ?? null;
  const displayedPeriods = selectedPeriod ? [selectedPeriod] : [];

  return (
    <div className="flex flex-col gap-6">
      <TouchlinePageHeader
        title="League"
        context={
          selectedPeriod?.dateRange
            ? `${selectedPeriod.title} · ${selectedPeriod.dateRange}`
            : "Seasons, rounds and matches. Open a round for squad work."
        }
        actions={
          <>
            <Link
              href={`/o/${orgSlug}/teams`}
              className="text-[13px] font-medium text-[var(--text-soft)] no-underline hover:text-[var(--foreground)]"
            >
              League teams <span aria-hidden="true">›</span>
            </Link>
            <TouchlineButton as="a" href={`/o/${orgSlug}/matches/new`} variant="primary">
              Create match
            </TouchlineButton>
          </>
        }
      />

      {data && data.periods.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="league-season-select"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]"
          >
            League season
          </label>
          <select
            id="league-season-select"
            value={selectedPeriodId ?? ""}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="min-h-[44px] rounded-[var(--tl-c-radius-control)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-3 py-1.5 text-[16px] text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none medium:min-h-9 medium:text-[14px]"
          >
            {data.periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.title}
                {period.dateRange ? ` · ${period.dateRange}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {isPending && !data ? (
        <PageSkeleton rows={4} />
      ) : !data || data.periods.length === 0 ? (
        <EmptyState
          title="No league seasons found."
          description="Create a season and league season to start planning rounds."
          illustration="emptyMatches"
          action={
            <TouchlineButton as="a" href={`/o/${orgSlug}/season/new`} variant="primary">
              Create league season
            </TouchlineButton>
          }
        />
      ) : (
        <div className="flex flex-col gap-10">
          {displayedPeriods.map((period) => (
            <PeriodSection key={period.id} period={period} />
          ))}
        </div>
      )}
    </div>
  );
}
