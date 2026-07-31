import { getOrgContext } from "./org-context";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { OrgDetailClient } from "./org-detail-client";

export default async function OrgDetailPage({
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

  const org = await db.organisation.findUnique({
    where: { id: ctx.organisationId },
    select: {
      id: true,
      name: true,
      slug: true,
      isSynthetic: true,
      createdAt: true,
      memberships: {
        select: {
          id: true,
          userId: true,
          role: true,
          user: { select: { id: true, name: true, email: true } },
          teamAccesses: { select: { id: true, teamId: true, team: { select: { id: true, name: true } } } },
        },
        orderBy: { role: "asc" },
      },
      teams: {
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
      invitations: {
        where: { status: "PENDING" },
        select: {
          id: true,
          invitedEmail: true,
          intendedRole: true,
          status: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!org) {
    redirect("/organisations");
  }

  return (
    <OrgDetailClient
      org={JSON.parse(JSON.stringify(org))}
      orgSlug={orgSlug}
      currentUserId={ctx.userId}
      currentUserRole={ctx.role}
      canInvite={ctx.canManageMemberships}
      canManageRoles={ctx.role === "OWNER"}
      canManageTeamAccess={ctx.canManageMemberships}
      teams={JSON.parse(JSON.stringify(org.teams))}
    />
  );
}