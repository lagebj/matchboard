import { Suspense } from "react";
import { TeamReviewPage } from "@/components/assistant/team-review-page";

type TeamReviewRouteProps = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamReviewRoute({ params }: TeamReviewRouteProps) {
  const { teamId } = await params;
  return (
    <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading team review...</div>}>
      <TeamReviewPage teamId={teamId} />
    </Suspense>
  );
}