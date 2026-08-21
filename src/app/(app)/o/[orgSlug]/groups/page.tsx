export const dynamic = "force-dynamic";

import { requirePageActorContext } from "@/lib/auth/actor-context";
import { listGroupsForOrganisation } from "@/lib/groups/group-domain";
import { GroupListClient } from "./group-list-client";

export default async function GroupsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  const groups = await listGroupsForOrganisation(ctx.organisationId);

  return <GroupListClient groups={groups} orgSlug={orgSlug} />;
}