import { Suspense } from "react";
import { TeamReviewPage } from "@/components/assistant/team-review-page";
import { requireActorContext } from "@/lib/auth/actor-context";

type TeamReviewRouteProps = {
  params: Promise<{ orgSlug: string; teamId: string }>;
};

export default async function TeamReviewRoute({ params }: TeamReviewRouteProps) {
  const { orgSlug, teamId } = await params;
  await requireActorContext(orgSlug);
  return (
    <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading team review...</div>}>
      <TeamReviewPage teamId={teamId} />
    </Suspense>
  );
}