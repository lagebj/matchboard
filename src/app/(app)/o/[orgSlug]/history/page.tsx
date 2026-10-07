import { redirect } from "next/navigation";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

/**
 * ADR-0157 slice C8: `/history` is retired. Movement/matrix/export parity was verified in
 * Season Review > Players (`/season?tab=players` — same matrix, movement paths, per-player
 * timeline, and export), so this route now preserves only the old deep-link intent.
 */
export const dynamic = "force-dynamic";

export default async function HistoryRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ leagueSeasonId?: string }>;
}) {
  const { orgSlug } = await params;
  const { leagueSeasonId } = await searchParams;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);

  const query = new URLSearchParams({ tab: "players" });
  if (leagueSeasonId) query.set("leagueSeasonId", leagueSeasonId);
  redirect(`/o/${orgSlug}/season?${query.toString()}`);
}