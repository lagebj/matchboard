export const dynamic = "force-dynamic";

import { requirePageActorContext } from "@/lib/auth/actor-context";
import { listGroupsForOrganisation } from "@/lib/groups/group-domain";
import { GroupListClient } from "./group-list-client";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export default async function GroupsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  // OWNER and ADMIN can see all groups; COACH/VIEWER/SUPPORT see only groups they have access to
  const accessibleGroupIds = ctx.role === "OWNER" || ctx.role === "ADMIN" ? undefined : ctx.accessibleGroupIds;
  const groups = await listGroupsForOrganisation(ctx.organisationId, accessibleGroupIds);

  return <GroupListClient groups={groups} orgSlug={orgSlug} />;
}