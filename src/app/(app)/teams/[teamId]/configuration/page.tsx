import { Suspense } from "react";
import { TeamConfigurationPage } from "@/components/team/team-configuration-page";

type TeamConfigRouteProps = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamConfigurationRoute({ params }: TeamConfigRouteProps) {
  const { teamId } = await params;
  return (
    <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading configuration...</div>}>
      <TeamConfigurationPage teamId={teamId} />
    </Suspense>
  );
}