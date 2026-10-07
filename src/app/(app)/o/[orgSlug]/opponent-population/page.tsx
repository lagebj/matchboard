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
    // More is retired (ADR-0157 C8) — Settings > Advanced is where admin tools are discovered now.
    redirect(`/o/${orgSlug}/settings`);
  }

  return <OpponentPopulationContent orgSlug={orgSlug} />;
}