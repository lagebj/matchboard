import { Suspense } from "react";
import { MatchReviewPage } from "@/components/assistant/match-review-page";
import { PlannedVsActualPanel } from "@/components/audit/planned-vs-actual-panel";

type MatchReviewRouteProps = {
  params: Promise<{ orgSlug: string; matchId: string }>;
};

export default async function MatchReviewRoute({ params }: MatchReviewRouteProps) {
  const { matchId } = await params;
  return (
    // Touchline island (theme-aware — Phase 10 preparatory pass, ADR-0134).
    <div className="touchline flex flex-col gap-6">
      <Suspense fallback={<div className="p-4 text-sm text-[var(--text-muted)]">Loading match review...</div>}>
        <MatchReviewPage matchId={matchId} />
      </Suspense>
      <Suspense fallback={<div className="p-4 text-sm text-[var(--text-muted)]">Loading planned vs actual...</div>}>
        <PlannedVsActualPanel matchId={matchId} />
      </Suspense>
    </div>
  );
}