import { requirePageActorContext, canAdmin } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { redirect } from "next/navigation";
import { OpponentPopulationContent } from "../opponent-population-client-content";

export const dynamic = "force-dynamic";

export default async function OpponentPopulationPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);

  if (!canAdmin(ctx)) {
    redirect(`/o/${orgSlug}/more`);
  }

  return <OpponentPopulationContent orgSlug={orgSlug} />;
}