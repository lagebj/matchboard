import { Suspense } from "react";
import { MatchReviewPage } from "@/components/assistant/match-review-page";
import { PlannedVsActualPanel } from "@/components/audit/planned-vs-actual-panel";

type MatchReviewRouteProps = {
  params: Promise<{ orgSlug: string; matchId: string }>;
};

export default async function MatchReviewRoute({ params }: MatchReviewRouteProps) {
  const { orgSlug, matchId } = await params;
  return (
    // Touchline island (theme-aware — Phase 10 preparatory pass, ADR-0134).
    <div className="touchline flex flex-col gap-6">
      {/* Exact-goldens Match Details convergence: a quiet drill-down back-link, no second full
          match query tree (this route already has its own bounded loaders below). */}
      <a
        href={`/o/${orgSlug}/matches/${matchId}`}
        className="inline-flex w-fit items-center gap-1.5 text-[13px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
      >
        ‹ Back to match
      </a>
      <Suspense fallback={<div className="p-4 text-sm text-[var(--text-muted)]">Loading match review...</div>}>
        <MatchReviewPage matchId={matchId} />
      </Suspense>
      <Suspense fallback={<div className="p-4 text-sm text-[var(--text-muted)]">Loading planned vs actual...</div>}>
        <PlannedVsActualPanel matchId={matchId} />
      </Suspense>
    </div>
  );
}
