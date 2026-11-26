"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FixturePeriod } from "@/domain/fixtures/types";
import { buildLeagueOperatingViewModel } from "@/lib/touchline/presentation/league-view-model";
import { LeagueSurface } from "@/components/fixtures/league-surface";

/**
 * Gate E — E01 (League, register row E01). Fixture-safe mount for the real, unmodified
 * `buildLeagueOperatingViewModel()` + `LeagueSurface` — the production League composition
 * (ADR-0144). `FixturesPage` (`src/components/fixtures/fixtures-page.tsx`) is not reusable
 * directly because it self-fetches via `fetchFixturesOverview()` and calls a real Server Action
 * (`fixturePopulateAllAction`) for "Generate all draft squads"; this mount reproduces only its
 * data-free URL-state orchestration (the `season`/`round` query-param selection authority,
 * ADR-0144 "URL as selection authority") and injects fixture `FixturePeriod[]` data instead of a
 * real fetch. No mutation control is rendered — "Generate all draft squads" and "Create match"
 * are intentionally omitted, since Section 11's "never invoke real Server Actions from synthetic
 * UI Lab controls" leaves no safe way to represent them here.
 *
 * The "League teams" / "Review season" links use the production org-scoped href shape with a
 * fixed synthetic org slug ("acme", matching the Gate C precedent), consistent with ARR-0035:
 * `buildLeagueOperatingViewModel()`'s own internal `focusedRound.matches[].href`/`roundBoardHref`
 * are bare unscoped paths (`/matches/{id}`, `/rounds/{id}`) — a known, already-tracked residue
 * (ARR-0035 lists `fixtures-page.tsx` explicitly), not a new defect introduced here. Both shapes
 * resolve to a real `redirectToOrgSlug()`/auth-boundary redirect to `/signin` in this unauthenticated
 * UI Lab context, verified in `e2e/ui-lab-gate-e.spec.ts`.
 */
export function LeagueFixtureMount({ periods, now, orgSlug = "acme" }: { periods: FixturePeriod[]; now: Date; orgSlug?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [earlierExpanded, setEarlierExpanded] = useState(false);

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

  const viewModel = buildLeagueOperatingViewModel({ periods, selectedPeriodId, selectedRoundId, now });
  const activePeriod = viewModel.activePeriod;

  // Mirrors production (`fixtures-page.tsx`): the "earlier rounds" disclosure is deliberately
  // local, ephemeral UI state, reset whenever the focused round changes.
  useEffect(() => {
    setEarlierExpanded(false);
  }, [viewModel.focusedRound?.id]);

  const handleSelectRound = useCallback(
    (roundId: string) => setQueryParams({ season: activePeriod?.id ?? null, round: roundId }),
    [activePeriod?.id, setQueryParams],
  );

  const handleSelectPeriod = useCallback(
    (periodId: string) => setQueryParams({ season: periodId, round: null }),
    [setQueryParams],
  );

  return (
    <div className="touchline flex min-w-0 flex-col gap-6" data-ui-lab-ready="true">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-[20px] font-[650] text-[var(--foreground)]">League</h1>
          <p className="text-[13px] text-[var(--text-muted)]">
            {activePeriod?.dateRange ? `${activePeriod.title} · ${activePeriod.dateRange}` : "Seasons, rounds and matches."}
          </p>
        </div>
        <Link
          href={`/o/${orgSlug}/teams`}
          className="text-[13px] font-medium text-[var(--text-soft)] no-underline hover:text-[var(--foreground)]"
        >
          League teams <span aria-hidden="true">›</span>
        </Link>
      </div>

      {periods.length > 1 && (
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
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.title}
                {period.dateRange ? ` · ${period.dateRange}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {activePeriod && (
        <div>
          <Link
            href={`/o/${orgSlug}/season?leagueSeasonId=${encodeURIComponent(activePeriod.id)}`}
            className="text-[13px] font-medium text-[var(--text-soft)] no-underline hover:text-[var(--foreground)]"
          >
            Review season <span aria-hidden="true">›</span>
          </Link>
        </div>
      )}

      <LeagueSurface
        viewModel={viewModel}
        onSelectRound={handleSelectRound}
        earlierExpanded={earlierExpanded}
        onToggleEarlier={() => setEarlierExpanded((v) => !v)}
      />
    </div>
  );
}
