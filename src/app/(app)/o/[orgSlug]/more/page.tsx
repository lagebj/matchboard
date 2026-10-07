import { redirect } from "next/navigation";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

/**
 * ADR-0157 slice C8: the More hub is retired. Every job it owned has a contextual destination,
 * a Settings section, or its own redirect (see `docs/product/navigation-model.md`
 * "Route disposition (post-More)"). Administration-only legacy links land on Settings.
 */
export const dynamic = "force-dynamic";

export default async function MoreRedirectPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  redirect(`/o/${orgSlug}/settings`);
}