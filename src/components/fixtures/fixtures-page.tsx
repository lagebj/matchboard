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
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { TacticalSurface } from "@/components/ui/tactical-surface";
import { Button } from "@/components/ui/button";
import { StatusRail } from "@/components/ui/status-rail";
import { MetricTile } from "@/components/ui/metric-tile";
import { MatchTicket } from "@/components/ui/match-ticket";
import { StatusPill } from "@/components/ui/status-pill";
import type { ScoreCapsuleResult } from "@/components/ui/score-capsule";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarRange, OctagonAlert, AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * FixturesPage — per ADR 0007 the fixtures view reads as a timeline: past
 * finalized rounds are compact, current/upcoming rounds are slightly more
 * open. Match rows are scannable, not wrapped in heavy cards.
 */




function roundPrimaryAction(
  round: FixtureRound,
): { label: string; href: string } | null {
  switch (round.selectionState) {
    case "NOT_GENERATED":
      return { label: "Generate and review", href: `/rounds/${round.id}` };
    case "DRAFT":
      return { label: "Review board", href: `/rounds/${round.id}` };
    case "BLOCKED":
      return { label: "Resolve blockers", href: `/rounds/${round.id}` };
    case "READY":
      return { label: "Finalise in board", href: `/rounds/${round.id}` };
    case "FINALIZED":
      return { label: "View finalised board", href: `/rounds/${round.id}` };
    default:
      return null;
  }
}

function IntegritySummary({
  blockerCount,
  decisionRequiredCount,
}: {
  blockerCount: number;
  decisionRequiredCount: number;
}) {
  if (blockerCount === 0 && decisionRequiredCount === 0) {
    return (
      <span className="text-[11px] text-[var(--accent-strong)]">Ready</span>
    );
  }
  const parts: string[] = [];
  if (blockerCount > 0) parts.push(`${blockerCount} blocked`);
  if (decisionRequiredCount > 0) parts.push(`${decisionRequiredCount} decision`);
  const tone =
    blockerCount > 0 ? "text-[var(--danger)]" : "text-[var(--warning)]";
  return <span className={`text-[11px] ${tone}`}>{parts.join(" · ")}</span>;
}

function MatchRow({ match }: { match: FixtureMatch }) {
  const isCompleted = match.reportState.state === "COMPLETED";
  const isCancelled = match.matchStatus === "CANCELLED";

  const completedResult = isCompleted && match.reportState.state === "COMPLETED"
    ? match.reportState.result
    : undefined;

  const result: ScoreCapsuleResult | undefined = completedResult
    ? completedResult.outcome === "WON"
      ? "win"
      : completedResult.outcome === "LOST"
        ? "loss"
        : completedResult.outcome === "DRAWN"
          ? "draw"
          : "unknown"
    : undefined;

  return (
    <div className={isCancelled ? "opacity-60" : ""}>
      <MatchTicket
        teamName={match.teamName}
        opponentName={match.opponent}
        dateLabel={match.startsAt ? new Date(match.startsAt).toLocaleDateString() : undefined}
        status={isCancelled ? "FINALIZED" : match.selectionState}
        reportStatus={isCancelled ? undefined : match.postMatchStatus}
        homeScore={isCancelled ? undefined : completedResult?.goalsFor}
        awayScore={isCancelled ? undefined : completedResult?.goalsAgainst}
        result={isCancelled ? "unknown" : (result ?? "unknown")}
        href={`/matches/${match.id}`}
      />
      {isCancelled && (
        <div className="mt-1 flex items-center gap-1.5 px-1">
          <StatusPill variant="danger">Cancelled</StatusPill>
          {match.cancelledReason && (
            <span className="text-[10px] text-[var(--text-muted)] truncate max-w-48">{match.cancelledReason}</span>
          )}
        </div>
      )}
    </div>
  );
}

function RoundSection({ round }: { round: FixtureRound }) {
  const primaryAction = roundPrimaryAction(round);
  const isFinalized = round.selectionState === "FINALIZED";

  return (
    <TacticalSurface variant={isFinalized ? "default" : "board"} padding="none" className="overflow-hidden">
      <div
        className={[
          "flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-soft)] px-3.5",
          isFinalized ? "py-2" : "py-2.5",
        ].join(" ")}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <span className="text-sm font-semibold text-zinc-50 truncate">
            {round.title}
          </span>
          <StatusRail
            status={
              round.selectionState === "NOT_GENERATED" ? "neutral" :
              round.selectionState === "FINALIZED" ? "finalized" :
              round.selectionState === "BLOCKED" ? "blocked" :
              round.selectionState === "DRAFT" ? "draft" :
              "neutral"
            }
          />
          <IntegritySummary
            blockerCount={round.blockerCount}
            decisionRequiredCount={round.decisionRequiredCount}
          />
          {round.matches.length > 0 && (
            <span className="text-[11px] text-[var(--text-muted)]">
              {round.matches.length} match{round.matches.length !== 1 ? "es" : ""}
            </span>
          )}
        </div>
        {primaryAction && (
          <Button
            as={Link}
            href={primaryAction.href}
            variant={isFinalized ? "ghost" : "primary"}
            size="sm"
          >
            {primaryAction.label}
          </Button>
        )}
      </div>
      <div className={isFinalized ? "py-1" : "py-1.5"}>
        {round.matches.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] px-3.5 py-3">
            No matches in this round.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border-soft)]">
            {round.matches.map((match) => (
              <MatchRow key={match.id} match={match} />
            ))}
          </div>
        )}
      </div>
    </TacticalSurface>
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
    notGenerated: period.rounds.filter((r) => r.selectionState === "NOT_GENERATED")
      .length,
    draft: period.rounds.filter(
      (r) => r.selectionState === "DRAFT" || r.selectionState === "BLOCKED",
    ).length,
    ready: period.rounds.filter((r) => r.selectionState === "READY").length,
    finalized: period.rounds.filter((r) => r.selectionState === "FINALIZED")
      .length,
  };
  const totalBlockers = period.rounds.reduce(
    (sum, r) => sum + r.blockerCount,
    0,
  );
  const totalDecisions = period.rounds.reduce(
    (sum, r) => sum + r.decisionRequiredCount,
    0,
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-zinc-50">{period.title}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
            {counts.notGenerated > 0 && (
              <span>{counts.notGenerated} not generated</span>
            )}
            {counts.draft > 0 && (
              <span className="text-[var(--warning)]">{counts.draft} draft</span>
            )}
            {counts.ready > 0 && (
              <span className="text-[var(--accent-strong)]">
                {counts.ready} ready
              </span>
            )}
            {counts.finalized > 0 && (
              <span>{counts.finalized} finalized</span>
            )}
            {totalBlockers > 0 && (
              <span className="text-[var(--danger)]">
                {totalBlockers} blocked
              </span>
            )}
            {totalDecisions > 0 && (
              <span className="text-[var(--warning)]">
                {totalDecisions} decision{totalDecisions === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        {hasNotGenerated && (
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const fd = new FormData();
                fd.set("leagueSeasonId", period.id);
                const result = await fixturePopulateAllAction(
                  { error: "" },
                  fd,
                );
                if (result.error) setStatusMessage(result.error);
                else
                  router.push(
                    `/rounds/${
                      period.rounds.find((r) => r.selectionState === "NOT_GENERATED")
                        ?.id ?? period.rounds[0]?.id ?? "/"
                    }`,
                  );
              });
            }}
          >
            {isPending ? "Generating…" : "Generate all draft squads"}
          </Button>
        )}
        {statusMessage && (
          <span className="text-[11px] text-[var(--text-muted)]">
            {statusMessage}
          </span>
        )}
      </div>

      {/* Metric strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile
          label="Rounds"
          value={period.rounds.length}
          tone="neutral"
          icon={<CalendarRange className="h-4 w-4" />}
        />
        {totalBlockers > 0 && (
          <MetricTile
            label="Blocked"
            value={totalBlockers}
            tone="danger"
            icon={<OctagonAlert className="h-4 w-4" />}
          />
        )}
        {totalDecisions > 0 && (
          <MetricTile
            label="Decisions"
            value={totalDecisions}
            tone="warning"
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        )}
        {counts.finalized > 0 && (
          <MetricTile
            label="Finalised"
            value={counts.finalized}
            tone="success"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
        )}
      </div>

      <div className="flex flex-col gap-3">
        {period.rounds.length === 0 ? (
          <Surface padding="md">
            <p className="text-sm text-[var(--text-muted)] text-center">
              No rounds in this period.
            </p>
          </Surface>
        ) : (
          period.rounds.map((round) => (
            <RoundSection key={round.id} round={round} />
          ))
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
        setSelectedPeriodId(result.periods[0].id);
      }
    });
  }, [startTransition]);

  const displayedPeriods = selectedPeriodId && data
    ? data.periods.filter((p) => p.id === selectedPeriodId)
    : data?.periods ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fixtures"
        description="League seasons, rounds, and matches. Open a round for squad work."
      />

      {data && data.periods.length > 1 && (
        <div className="flex items-center gap-3">
          <label htmlFor="league-season-select" className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            League season
          </label>
          <select
            id="league-season-select"
            value={selectedPeriodId ?? ""}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
          >
            {data.periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.title}{period.dateRange ? ` · ${period.dateRange}` : ""}
              </option>
            ))}
          </select>
          <a
            href={`/o/${orgSlug}/matches/new`}
            className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors"
          >
            Create match
          </a>
        </div>
      )}

      {data && data.periods.length === 1 && (
        <div className="flex items-center gap-3">
          <a
            href={`/o/${orgSlug}/matches/new`}
            className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors"
          >
            Create match
          </a>
        </div>
      )}

      {isPending && !data ? (
        <Surface padding="md">
          <p className="text-sm text-[var(--text-muted)]">Loading fixtures…</p>
        </Surface>
      ) : !data || data.periods.length === 0 ? (
        <EmptyState
          title="No league seasons found."
          description="Create a season and league season to start planning rounds."
          illustration="emptyMatches"
          action={
            <Button variant="primary" size="sm" as="a" href={`/o/${orgSlug}/season/new`}>
              Create league season
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {displayedPeriods.map((period) => (
            <PeriodSection key={period.id} period={period} />
          ))}
        </div>
      )}
    </div>
  );
}
