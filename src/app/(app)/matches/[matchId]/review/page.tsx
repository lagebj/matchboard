import { Suspense } from "react";
import { MatchReviewPage } from "@/components/assistant/match-review-page";
import { PlannedVsActualPanel } from "@/components/audit/planned-vs-actual-panel";

type MatchReviewRouteProps = {
  params: Promise<{ matchId: string }>;
};

export default async function MatchReviewRoute({ params }: MatchReviewRouteProps) {
  const { matchId } = await params;
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading match review...</div>}>
        <MatchReviewPage matchId={matchId} />
      </Suspense>
      <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading planned vs actual...</div>}>
        <PlannedVsActualPanel matchId={matchId} />
      </Suspense>
    </div>
  );
}