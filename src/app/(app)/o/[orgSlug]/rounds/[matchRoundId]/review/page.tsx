import { Suspense } from "react";
import { RoundReviewPage } from "@/components/assistant/round-review-page";
import { requireActorContext } from "@/lib/auth/actor-context";

type RoundReviewRouteProps = {
  params: Promise<{ orgSlug: string; matchRoundId: string }>;
};

export default async function RoundReviewRoute({ params }: RoundReviewRouteProps) {
  const { orgSlug, matchRoundId } = await params;
  await requireActorContext(orgSlug);
  return (
    <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading round review...</div>}>
      <RoundReviewPage roundId={matchRoundId} />
    </Suspense>
  );
}