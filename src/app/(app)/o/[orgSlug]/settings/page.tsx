import { getOrgContext } from "../org-context";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { OrgSettingsClient } from "./org-settings-client";

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  let ctx;
  try {
    ctx = await getOrgContext(orgSlug);
  } catch {
    redirect("/organisations");
  }

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    redirect(`/o/${orgSlug}`);
  }

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

  return (
    <OrgSettingsClient
      org={JSON.parse(JSON.stringify(org))}
      principals={JSON.parse(JSON.stringify(principals))}
      orgSlug={orgSlug}
      isOwner={ctx.role === "OWNER"}
      isSuspended={org.suspendedAt !== null && org.suspendedAt !== undefined}
      suspendedReason={org.suspendedReason}
    />
  );
}