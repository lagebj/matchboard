import { Suspense } from "react";
import { TeamReviewPage } from "@/components/assistant/team-review-page";
import { requirePageActorContext } from "@/lib/auth/actor-context";

type TeamReviewRouteProps = {
  params: Promise<{ orgSlug: string; teamId: string }>;
};

export default async function TeamReviewRoute({ params }: TeamReviewRouteProps) {
  const { orgSlug, teamId } = await params;
  await requirePageActorContext(orgSlug);
  return (
    <Suspense fallback={<div className="touchline p-4 text-sm text-[var(--text-muted)]">Loading team review...</div>}>
      <TeamReviewPage teamId={teamId} />
    </Suspense>
  );
}