"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FixturesOverview, FixturePeriod, FixtureRound, FixtureMatch, SelectionState } from "@/domain/fixtures/types";
import { fetchFixturesOverview, fixturePopulateAllAction } from "@/domain/fixtures/actions";

const selectionStateConfig: Record<SelectionState, { label: string; dotClass: string; textClass: string; borderClass: string }> = {
  NOT_GENERATED: { label: "Not generated", dotClass: "bg-zinc-500", textClass: "text-zinc-400", borderClass: "border-zinc-700/40" },
  DRAFT: { label: "Draft", dotClass: "bg-amber-400", textClass: "text-amber-300", borderClass: "border-amber-700/40" },
  BLOCKED: { label: "Blocked", dotClass: "bg-red-400", textClass: "text-red-300", borderClass: "border-red-700/40" },
  READY: { label: "Ready", dotClass: "bg-emerald-400", textClass: "text-emerald-300", borderClass: "border-emerald-700/40" },
  FINALIZED: { label: "Finalized", dotClass: "bg-[var(--accent)]", textClass: "text-[var(--accent-strong)]", borderClass: "border-[rgba(140,167,146,0.28)]" },
};

function SelectionStateBadge({ state }: { state: SelectionState }) {
  const config = selectionStateConfig[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config.borderClass} ${config.textClass}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
      {config.label}
    </span>
  );
}

function roundPrimaryAction(round: FixtureRound): { label: string; href: string } | null {
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

function MatchRow({ match, roundId }: { match: FixtureMatch; roundId: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col min-w-0">
          <span className="text-sm text-zinc-200 truncate">{match.title}</span>
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
            {match.venue && <span>{match.venue}</span>}
            {match.startsAt && <span>{new Date(match.startsAt).toLocaleDateString()}</span>}
            {typeof match.selectedPlayerCount === "number" && match.selectedPlayerCount > 0 && (
              <span>{match.selectedPlayerCount} selected</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <SelectionStateBadge state={match.selectionState} />
        {match.unresolvedIssueCount > 0 && (
          <span className="rounded bg-amber-900/30 px-1.5 py-0.5 text-[10px] text-amber-300">
            {match.unresolvedIssueCount} issue{match.unresolvedIssueCount !== 1 ? "s" : ""}
          </span>
        )}
        <Link
          href={`/matches/${match.id}`}
          className="text-[10px] font-medium text-[var(--accent-strong)] hover:underline"
        >
          Open
        </Link>
      </div>
    </div>
  );
}

function RoundSection({ round }: { round: FixtureRound }) {
  const primaryAction = roundPrimaryAction(round);

  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-sm font-medium text-zinc-100 truncate">{round.title}</span>
          <SelectionStateBadge state={round.selectionState} />
          {round.unresolvedIssueCount > 0 && (
            <span className="rounded bg-amber-900/30 px-1.5 py-0.5 text-[10px] text-amber-300">
              {round.unresolvedIssueCount} issue{round.unresolvedIssueCount !== 1 ? "s" : ""}
            </span>
          )}
          {round.matches.length > 0 && (
            <span className="text-[10px] text-zinc-500">{round.matches.length} match{round.matches.length !== 1 ? "es" : ""}</span>
          )}
        </div>
        {primaryAction && (
          <Link
            href={primaryAction.href}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-xs font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(180deg,rgba(146,171,151,0.34),rgba(88,110,100,0.26))] shrink-0"
          >
            {primaryAction.label}
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-2 p-3">
        {round.matches.length === 0 ? (
          <p className="text-xs text-zinc-500 py-2">No matches in this round.</p>
        ) : (
          round.matches.map((match) => <MatchRow key={match.id} match={match} roundId={round.id} />)
        )}
      </div>
    </div>
  );
}

function PeriodSection({ period }: { period: FixturePeriod }) {
  const hasNotGenerated = period.rounds.some((r) => r.selectionState === "NOT_GENERATED");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const statusCounts = {
    notGenerated: period.rounds.filter((r) => r.selectionState === "NOT_GENERATED").length,
    draft: period.rounds.filter((r) => r.selectionState === "DRAFT" || r.selectionState === "BLOCKED").length,
    ready: period.rounds.filter((r) => r.selectionState === "READY").length,
    finalized: period.rounds.filter((r) => r.selectionState === "FINALIZED").length,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">{period.title}</h2>
          {period.dateRange && <span className="text-xs text-zinc-500">{period.dateRange}</span>}
          <div className="flex items-center gap-2 mt-1">
            {statusCounts.notGenerated > 0 && <span className="text-[10px] text-zinc-500">{statusCounts.notGenerated} not generated</span>}
            {statusCounts.draft > 0 && <span className="text-[10px] text-amber-300">{statusCounts.draft} draft</span>}
            {statusCounts.ready > 0 && <span className="text-[10px] text-emerald-300">{statusCounts.ready} ready</span>}
            {statusCounts.finalized > 0 && <span className="text-[10px] text-[var(--accent-strong)]">{statusCounts.finalized} finalized</span>}
          </div>
        </div>
        {hasNotGenerated && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const fd = new FormData();
                fd.set("planningPeriodId", period.id);
                const result = await fixturePopulateAllAction({ error: "" }, fd);
                if (result.error) setStatusMessage(result.error);
                else router.push(`/rounds/${period.rounds.find((r) => r.selectionState === "NOT_GENERATED")?.id ?? period.rounds[0]?.id ?? "/"}`);
              });
            }}
            className="inline-flex h-9 items-center justify-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(180deg,rgba(146,171,151,0.34),rgba(88,110,100,0.26))] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isPending ? "Generating..." : "Generate all draft squads"}
          </button>
        )}
        {statusMessage && <span className="text-[10px] text-zinc-400">{statusMessage}</span>}
      </div>
      <div className="flex flex-col gap-3">
        {period.rounds.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4 text-center">No rounds in this period.</p>
        ) : (
          period.rounds.map((round) => <RoundSection key={round.id} round={round} />)
        )}
      </div>
    </div>
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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Fixtures</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Planning periods, rounds, and matches. Navigate to rounds for squad work.</p>
      </div>

      {isPending && !data ? (
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-6 text-sm text-zinc-500">
          Loading fixtures...
        </div>
      ) : !data || data.periods.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <p className="text-sm text-zinc-400">No planning periods found.</p>
          <p className="text-xs text-zinc-500">Create a season and planning period to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {data.periods.map((period) => <PeriodSection key={period.id} period={period} />)}
        </div>
      )}
    </div>
  );
}