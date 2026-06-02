"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  FixturesOverview,
  FixturePeriod,
  FixtureRound,
  FixtureMatch,
  SelectionState,
} from "@/domain/fixtures/types";
import {
  fetchFixturesOverview,
  fixturePopulateAllAction,
} from "@/domain/fixtures/actions";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { StatusPill, type StatusPillVariant } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * FixturesPage — per ADR 0007 the fixtures view reads as a timeline: past
 * finalized rounds are compact, current/upcoming rounds are slightly more
 * open. Match rows are scannable, not wrapped in heavy cards.
 */

type SelectionStateConfig = {
  label: string;
  variant: StatusPillVariant;
};

const selectionStateConfig: Record<SelectionState, SelectionStateConfig> = {
  NOT_GENERATED: { label: "Not generated", variant: "neutral" },
  DRAFT: { label: "Draft", variant: "warning" },
  BLOCKED: { label: "Blocked", variant: "danger" },
  READY: { label: "Ready", variant: "success" },
  FINALIZED: { label: "Finalized", variant: "finalized" },
};

function SelectionStateBadge({ state }: { state: SelectionState }) {
  const config = selectionStateConfig[state];
  return <StatusPill variant={config.variant}>{config.label}</StatusPill>;
}

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
      return { label: "Finalize in board", href: `/rounds/${round.id}` };
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

function OutcomeCell({ match }: { match: FixtureMatch }) {
  const isCompleted = match.reportState.state === "COMPLETED";
  const isDraftReport = match.reportState.state === "DRAFT_REPORT_INCOMPLETE";
  const now = new Date();
  const isPast = match.startsAt ? new Date(match.startsAt) < now : false;

  if (isCompleted && match.reportState.state === "COMPLETED") {
    const outcome = match.reportState.result.outcome;
    const outcomeColor =
      outcome === "WON"
        ? "text-[var(--accent-strong)]"
        : outcome === "DRAWN"
          ? "text-[var(--text-soft)]"
          : "text-[var(--danger)]";
    const outcomeLabel =
      outcome === "WON" ? "Won" : outcome === "DRAWN" ? "Drawn" : "Lost";
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <span className="font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          FT
        </span>
        <span className="font-semibold tabular-nums text-zinc-50">
          {match.reportState.result.displayScore}
        </span>
        <span className={`font-semibold ${outcomeColor}`}>{outcomeLabel}</span>
      </div>
    );
  }

  if (isDraftReport && isPast) {
    return (
      <span className="text-[11px] text-[var(--warning)]">Report incomplete</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <SelectionStateBadge state={match.selectionState} />
      <IntegritySummary
        blockerCount={match.blockerCount}
        decisionRequiredCount={match.decisionRequiredCount}
      />
    </div>
  );
}

function MatchRow({ match }: { match: FixtureMatch }) {
  const isCompleted = match.reportState.state === "COMPLETED";
  const isDraftReport = match.reportState.state === "DRAFT_REPORT_INCOMPLETE";
  const now = new Date();
  const isPast = match.startsAt ? new Date(match.startsAt) < now : false;

  // Outcome-aware row tint — soft and used only for completed matches.
  const outcome =
    isCompleted && match.reportState.state === "COMPLETED"
      ? match.reportState.result.outcome
      : null;
  const outcomeAccent =
    outcome === "WON"
      ? "before:bg-[var(--accent)]/55"
      : outcome === "LOST"
        ? "before:bg-[var(--danger)]/55"
        : outcome === "DRAWN"
          ? "before:bg-[var(--text-muted)]/45"
          : "";

  return (
    <div
      className={[
        "group relative flex items-center justify-between gap-3 px-3 py-2 hover:bg-[var(--surface-muted)]/30 transition-colors",
        outcomeAccent
          ? `before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-r ${outcomeAccent} pl-3.5`
          : "",
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm text-zinc-100 truncate">{match.title}</span>
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
          {match.venue && <span>{match.venue}</span>}
          {match.startsAt && (
            <span>{new Date(match.startsAt).toLocaleDateString()}</span>
          )}
          {typeof match.selectedPlayerCount === "number" &&
            match.selectedPlayerCount > 0 &&
            !isCompleted && <span>{match.selectedPlayerCount} selected</span>}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <OutcomeCell match={match} />
        <Link
          href={`/matches/${match.id}`}
          className="text-[11px] font-medium text-[var(--accent-strong)] hover:underline"
        >
          {isCompleted
            ? "View report"
            : isDraftReport && isPast
              ? "Complete report"
              : "Open"}
        </Link>
      </div>
    </div>
  );
}

function RoundSection({ round }: { round: FixtureRound }) {
  const primaryAction = roundPrimaryAction(round);
  const isFinalized = round.selectionState === "FINALIZED";
  const padding = isFinalized ? "sm" : "md";

  return (
    <Surface padding="none" className="overflow-hidden">
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
          <SelectionStateBadge state={round.selectionState} />
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
      <div className={padding === "sm" ? "py-1" : "py-1.5"}>
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
    </Surface>
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
    <section className="flex flex-col gap-3">
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
                fd.set("planningPeriodId", period.id);
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

export function FixturesPage() {
  const [data, setData] = useState<FixturesOverview | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await fetchFixturesOverview();
      setData(result);
    });
  }, [startTransition]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fixtures"
        description="Phases, rounds, and matches. Open a round for squad work."
      />

      {isPending && !data ? (
        <Surface padding="md">
          <p className="text-sm text-[var(--text-muted)]">Loading fixtures…</p>
        </Surface>
      ) : !data || data.periods.length === 0 ? (
        <EmptyState
          title="No phases found."
          description="Create a season and phase to start planning rounds."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {data.periods.map((period) => (
            <PeriodSection key={period.id} period={period} />
          ))}
        </div>
      )}
    </div>
  );
}
