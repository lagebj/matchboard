export const dynamic = "force-dynamic";

import { requirePageActorContext } from "@/lib/auth/actor-context";
import { getGroupDetailAction } from "@/app/(app)/o/[orgSlug]/groups/actions";
import { getGroupGuestPlayersAction } from "@/app/(app)/groups/guest-player-actions";
import { notFound } from "next/navigation";
import { GroupDetailClient } from "./group-detail-client";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; groupSlug: string }>;
}) {
  const { orgSlug, groupSlug } = await params;
  await requirePageActorContext(orgSlug);
  const group = await getGroupDetailAction(groupSlug);

  if (!group) {
    notFound();
  }

  const guestPlayers = await getGroupGuestPlayersAction(groupSlug);

  return <GroupDetailClient group={group} orgSlug={orgSlug} guestPlayers={guestPlayers} />;
}