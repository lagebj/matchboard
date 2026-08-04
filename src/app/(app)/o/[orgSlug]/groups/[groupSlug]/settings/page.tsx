export const dynamic = "force-dynamic";

import { requireActorContext } from "@/lib/auth/actor-context";
import { getGroupDetailAction, listGroupMovementPathsAction } from "@/app/(app)/o/[orgSlug]/groups/actions";
import { notFound } from "next/navigation";
import { GroupSettingsClient } from "./group-settings-client";

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; groupSlug: string }>;
}) {
  const { orgSlug, groupSlug } = await params;
  const ctx = await requireActorContext(orgSlug);
  const group = await getGroupDetailAction(groupSlug);

  if (!group) {
    notFound();
  }

  const movementPaths = await listGroupMovementPathsAction({
    groupId: group.id,
    activeOnly: false,
  });

  return <GroupSettingsClient group={group} orgSlug={orgSlug} canMutate={ctx.role === "OWNER" || ctx.role === "ADMIN" || ctx.role === "COACH"} movementPaths={movementPaths} />;
}