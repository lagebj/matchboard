import { Suspense } from "react";
import { RoundReviewPage } from "@/components/assistant/round-review-page";
import { requireCoachAccess } from "@/lib/auth";

type RoundReviewRouteProps = {
  params: Promise<{ matchRoundId: string }>;
};

export default async function RoundReviewRoute({ params }: RoundReviewRouteProps) {
  await requireCoachAccess();
  const { matchRoundId } = await params;
  return (
    <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading round review...</div>}>
      <RoundReviewPage roundId={matchRoundId} />
    </Suspense>
  );
}