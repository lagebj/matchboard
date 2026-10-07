import { redirect } from "next/navigation";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

/**
 * ADR-0157 slice C8: the standalone formation-library list is retired as an independent
 * discoverability destination. Formation management (select/duplicate/archive/create) is
 * reachable contextually from Match Tactics' formation-library drawer; a contextless legacy
 * deep link lands on League, the entry to the next match's Tactics flow. The create/edit
 * builder routes (`/formations/new`, `/formations/[id]/edit`) remain — the slot-grid editor
 * needs its own canvas and round-trips back via `returnTo`.
 */
export const dynamic = "force-dynamic";

export default async function FormationsRedirectPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  redirect(`/o/${orgSlug}/fixtures`);
}