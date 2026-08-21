export const dynamic = "force-dynamic";

import { requirePageActorContext } from "@/lib/auth/actor-context";
import { getGroupDetailAction, listGroupMovementPathsAction, listAvailableMembersAction } from "@/app/(app)/o/[orgSlug]/groups/actions";
import { notFound } from "next/navigation";
import { GroupSettingsClient } from "./group-settings-client";

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; groupSlug: string }>;
}) {
  const { orgSlug, groupSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  const group = await getGroupDetailAction(groupSlug);

  if (!group) {
    notFound();
  }

  const [movementPaths, availableMembers] = await Promise.all([
    listGroupMovementPathsAction({
      groupId: group.id,
      activeOnly: false,
    }),
    listAvailableMembersAction(group.id),
  ]);

  return <GroupSettingsClient group={group} orgSlug={orgSlug} canMutate={ctx.role === "OWNER" || ctx.role === "ADMIN" || ctx.role === "COACH"} movementPaths={movementPaths} availableMembers={availableMembers} />;
}