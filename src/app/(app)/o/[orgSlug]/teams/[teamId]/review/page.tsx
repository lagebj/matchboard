import { Suspense } from "react";
import { TeamReviewPage } from "@/components/assistant/team-review-page";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { getWeeklyTeamReviewAdvisorViewModel } from "@/lib/ai/presentation/weekly-team-review-advisor";

type TeamReviewRouteProps = {
  params: Promise<{ orgSlug: string; teamId: string }>;
};

export default async function TeamReviewRoute({ params }: TeamReviewRouteProps) {
  const { orgSlug, teamId } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  const advisorViewModel = await getWeeklyTeamReviewAdvisorViewModel({ organisationId: ctx.organisationId, teamId });
  return (
    <Suspense fallback={<div className="touchline p-4 text-sm text-[var(--text-muted)]">Loading team review...</div>}>
      <TeamReviewPage teamId={teamId} advisorViewModel={advisorViewModel} />
    </Suspense>
  );
}