export const dynamic = "force-dynamic";

import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { CreateGroupForm } from "./create-group-form";

export default async function CreateGroupPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  requireMutationRole(ctx);

  return <CreateGroupForm orgSlug={orgSlug} />;
}