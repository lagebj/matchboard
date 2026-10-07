import { redirect } from "next/navigation";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

/**
 * ADR-0157 slice C8: the generic `/reviews` hub is retired. Peer-review due work, resolve/
 * cancel actions, and resolved history live on Today (`10_INFORMATION_ARCHITECTURE_CONVERGENCE.md`
 * "/reviews"); each review entry links to the reviewed object (event squad / match lineup).
 */
export const dynamic = "force-dynamic";

export default async function ReviewsRedirectPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  redirect(`/o/${orgSlug}/today`);
}