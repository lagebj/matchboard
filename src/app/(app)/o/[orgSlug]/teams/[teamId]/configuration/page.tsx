import { Suspense } from "react";
import { TeamConfigurationPage } from "@/components/team/team-configuration-page";
import { requirePageActorContext } from "@/lib/auth/actor-context";

type TeamConfigRouteProps = {
  params: Promise<{ orgSlug: string; teamId: string }>;
};

export default async function TeamConfigurationRoute({ params }: TeamConfigRouteProps) {
  const { orgSlug, teamId } = await params;
  await requirePageActorContext(orgSlug);
  return (
    <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading configuration...</div>}>
      <TeamConfigurationPage teamId={teamId} />
    </Suspense>
  );
}