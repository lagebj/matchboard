import { Suspense } from "react";
import { MatchReviewPage } from "@/components/assistant/match-review-page";

type MatchReviewRouteProps = {
  params: Promise<{ matchId: string }>;
};

export default async function MatchReviewRoute({ params }: MatchReviewRouteProps) {
  const { matchId } = await params;
  return (
    <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading match review...</div>}>
      <MatchReviewPage matchId={matchId} />
    </Suspense>
  );
}