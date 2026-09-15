"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FixturesOverview } from "@/domain/fixtures/types";
import { fetchFixturesOverview, fixturePopulateAllAction } from "@/domain/fixtures/actions";
import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { buildLeagueOperatingViewModel } from "@/lib/touchline/presentation/league-view-model";
import { LeagueSurface } from "@/components/fixtures/league-surface";

/**
 * League — season rail -> focused operational round -> compact recent scorebook history
 * (Matchboard League Operating Surface bundle, `06_COMPONENT_COMPOSITION_CONTRACT.md`,
 * `04_INTERACTION_AND_ROUTE_STATE_MODEL.md`).
 *
 * `FixturesPage` owns data fetching and URL-state orchestration only; all layout lives in
 * `LeagueSurface` and all round/temporal/issue computation lives in
 * `buildLeagueOperatingViewModel()`. The `season`/`round` query params are the sole selection
 * authority (04§"URL as state") — no separate client-only selection state that could drift from
 * the shareable URL.
 */
export function FixturesPage({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<FixturesOverview | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isGenerating, startGenerateTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [earlierExpanded, setEarlierExpanded] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      const result = await fetchFixturesOverview();
      setData(result);
    });
  }, [startTransition]);

  const selectedPeriodId = searchParams.get("season");
  const selectedRoundId = searchParams.get("round");

  const setQueryParams = useCallback(
    (next: { season?: string | null; round?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.season !== undefined) {
        if (next.season) params.set("season", next.season);
        else params.delete("season");
      }
      if (next.round !== undefined) {
        if (next.round) params.set("round", next.round);
        else params.delete("round");
      }
      router.push(params.size > 0 ? `?${params.toString()}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  const viewModel = data
    ? buildLeagueOperatingViewModel({
        periods: data.periods,
        selectedPeriodId,
        selectedRoundId,
        now: new Date(),
      })
    : null;

  const activePeriod = viewModel?.activePeriod ?? null;

  // Reset the local "earlier rounds" disclosure whenever the focused round changes — it is
  // deliberately not persisted (06§"Compact recent scorebook history").
  useEffect(() => {
    setEarlierExpanded(false);
  }, [viewModel?.focusedRound?.id]);

  const handleSelectRound = useCallback(
    (roundId: string) => {
      setQueryParams({ season: activePeriod?.id ?? null, round: roundId });
    },
    [activePeriod?.id, setQueryParams],
  );

  const handleSelectPeriod = useCallback(
    (periodId: string) => {
      setQueryParams({ season: periodId, round: null });
    },
    [setQueryParams],
  );

  const handleGenerateAll = useCallback(() => {
    if (!activePeriod) return;
    startGenerateTransition(async () => {
      const fd = new FormData();
      fd.set("leagueSeasonId", activePeriod.id);
      const result = await fixturePopulateAllAction({ error: "" }, fd);
      if (result.error) {
        setStatusMessage(result.error);
        return;
      }
      const refreshed = await fetchFixturesOverview();
      setData(refreshed);
      setStatusMessage(null);
    });
  }, [activePeriod, startGenerateTransition]);

  // The "Generate all draft squads" action is contextual (07§Step 9): a primary action when the
  // focused round itself needs generating, else a compact phase-level secondary action when any
  // other round in the season still needs it.
  const focusedNeedsGeneration = viewModel?.focusedRound?.needsGeneration ?? false;
  const seasonHasUngenerated =
    activePeriod?.rounds.some((r) => r.selectionState === "NOT_GENERATED") ?? false;

  return (
    <div className="touchline flex min-w-0 flex-col gap-6">
      <TouchlinePageHeader
        title="League"
        context={
          activePeriod?.dateRange
            ? `${activePeriod.title} · ${activePeriod.dateRange}`
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
            value={activePeriod?.id ?? ""}
            onChange={(e) => handleSelectPeriod(e.target.value)}
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

      {seasonHasUngenerated && !focusedNeedsGeneration && (
        <div className="flex items-center gap-3">
          <TouchlineButton
            type="button"
            variant="secondary"
            disabled={isGenerating}
            onClick={handleGenerateAll}
          >
            {isGenerating ? "Generating…" : "Generate all draft squads"}
          </TouchlineButton>
          {statusMessage && <span className="text-[12px] text-[var(--text-muted)]">{statusMessage}</span>}
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
      ) : viewModel ? (
        <>
          {focusedNeedsGeneration && activePeriod && (
            <div className="flex items-center gap-3">
              <TouchlineButton
                type="button"
                variant="primary"
                disabled={isGenerating}
                onClick={handleGenerateAll}
              >
                {isGenerating ? "Generating…" : "Generate all draft squads"}
              </TouchlineButton>
              {statusMessage && <span className="text-[12px] text-[var(--text-muted)]">{statusMessage}</span>}
            </div>
          )}
          <LeagueSurface
            viewModel={viewModel}
            onSelectRound={handleSelectRound}
            earlierExpanded={earlierExpanded}
            onToggleEarlier={() => setEarlierExpanded((v) => !v)}
          />
        </>
      ) : null}
    </div>
  );
}
