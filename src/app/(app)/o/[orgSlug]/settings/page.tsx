import { getOrgContext } from "../org-context";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { OrgSettingsClient } from "./org-settings-client";
import { getAiAdvisorSettingsAction } from "./ai-advisor-actions";
import { SeasonAdministrationSection } from "./season-administration-section";
import { SettingsDiscoverySections } from "./settings-discovery-sections";

export default async function OrgSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ seasonAdminId?: string }>;
}) {
  const { orgSlug } = await params;
  const { seasonAdminId } = await searchParams;

  let ctx;
  try {
    ctx = await getOrgContext(orgSlug);
  } catch {
    redirect("/organisations");
  }

  // ADR-0157 slice C8: Settings is the administration entry point for every member (the retired
  // More hub was all-role accessible; its replacement must be too). Owner/admin-only sections
  // (Season administration, Machine principals, Danger zone, Advanced tools) are conditionally
  // rendered below; every mutation keeps its own server-side role enforcement.
  const isAdmin = ctx.role === "OWNER" || ctx.role === "ADMIN";

  const org = await db.organisation.findUnique({
    where: { id: ctx.organisationId },
    select: {
      id: true,
      name: true,
      slug: true,
      isSynthetic: true,
      suspendedAt: true,
      suspendedReason: true,
      createdAt: true,
      _count: {
        select: {
          memberships: true,
          teams: true,
          players: true,
          machinePrincipals: true,
        },
      },
    },
  });

  if (!org) {
    redirect("/organisations");
  }

  const principals = await db.machinePrincipal.findMany({
    where: { organisationId: ctx.organisationId },
    select: {
      id: true,
      name: true,
      description: true,
      scopes: true,
      status: true,
      clientCredentialPrefix: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const leagueSeasons = await db.leagueSeason.findMany({
    where: { organisationId: ctx.organisationId },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      status: true,
      finalizedAt: true,
      finalizedBy: true,
      defaultNumberOfPeriods: true,
      defaultPeriodDurationMinutes: true,
      defaultBreakDurationMinutes: true,
    },
  });
  const selectedLeagueSeason = (seasonAdminId ? leagueSeasons.find((ls) => ls.id === seasonAdminId) : undefined) ?? leagueSeasons[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && (
        <SeasonAdministrationSection orgSlug={orgSlug} leagueSeasons={leagueSeasons} selected={selectedLeagueSeason} />
      )}
      <SettingsDiscoverySections orgSlug={orgSlug} isAdmin={isAdmin} />
      <OrgSettingsClient
        org={JSON.parse(JSON.stringify(org))}
        principals={JSON.parse(JSON.stringify(principals))}
        orgSlug={orgSlug}
        isOwner={ctx.role === "OWNER"}
        isSuspended={org.suspendedAt !== null && org.suspendedAt !== undefined}
        suspendedReason={org.suspendedReason}
        aiAdvisor={ctx.role === "OWNER" ? await getAiAdvisorSettingsAction(orgSlug) : null}
      />
    </div>
  );
}