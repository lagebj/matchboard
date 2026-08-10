export const dynamic = "force-dynamic";

import { requireActorContext } from "@/lib/auth/actor-context";
import { getGroupDetailAction } from "@/app/(app)/o/[orgSlug]/groups/actions";
import { notFound } from "next/navigation";
import { GroupDetailClient } from "./group-detail-client";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; groupSlug: string }>;
}) {
  const { orgSlug, groupSlug } = await params;
  await requireActorContext(orgSlug);
  const group = await getGroupDetailAction(groupSlug);

  if (!group) {
    notFound();
  }

  return <GroupDetailClient group={group} orgSlug={orgSlug} />;
}