import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/organisations/organisation-invitation";
import { logOrganisationInvitationExpire } from "@/lib/security/audit-log";
import { setTenantUserId, runWithSystemPrivilege } from "@/lib/tenancy/tenant-async-storage";

import { InviteAcceptanceForm } from "./invite-acceptance-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/api/auth/signin?callbackUrl=/invite/${encodeURIComponent(token)}`);
  }

  setTenantUserId(session.user.id);

  const tokenHash = hashToken(token);

  const invitation = await runWithSystemPrivilege(
    "invite-page-token-lookup",
    async () =>
      db.organisationInvitation.findFirst({
        where: { tokenHash },
        select: {
          id: true,
          invitedEmail: true,
          intendedRole: true,
          status: true,
          expiresAt: true,
          organisation: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
  );

  if (!invitation) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12">
        <h1 className="text-xl font-bold">Invitation Not Found</h1>
        <p className="text-sm text-[var(--text-muted)]">
          This invitation does not exist or has been removed.
        </p>
        <Link href="/organisations" className="text-sm underline">
          View your organisations
        </Link>
      </div>
    );
  }

  if (invitation.status === "ACCEPTED") {
    redirect(`/o/${invitation.organisation.slug}`);
  }

  if (invitation.status === "REVOKED") {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12">
        <h1 className="text-xl font-bold">Invitation Revoked</h1>
        <p className="text-sm text-[var(--text-muted)]">
          This invitation has been revoked by the organisation.
        </p>
        <Link href="/organisations" className="text-sm underline">
          View your organisations
        </Link>
      </div>
    );
  }

  if (invitation.status === "DECLINED") {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12">
        <h1 className="text-xl font-bold">Invitation Declined</h1>
        <p className="text-sm text-[var(--text-muted)]">
          You have already declined this invitation. Contact the organisation to request a new one.
        </p>
        <Link href="/organisations" className="text-sm underline">
          View your organisations
        </Link>
      </div>
    );
  }

  if (invitation.status === "EXPIRED" || new Date(invitation.expiresAt) < new Date()) {
    if (invitation.status === "PENDING") {
      await runWithSystemPrivilege(
        "invite-page-expire-invitation",
        async () =>
          db.organisationInvitation.update({
            where: { id: invitation.id },
            data: { status: "EXPIRED", token: null as unknown as string },
          }),
      );
      logOrganisationInvitationExpire(session.user.email ?? "unknown", invitation.organisation.id);
    }

    return (
      <div className="mx-auto max-w-md space-y-4 py-12">
        <h1 className="text-xl font-bold">Invitation Expired</h1>
        <p className="text-sm text-[var(--text-muted)]">
          This invitation expired on {invitation.expiresAt.toLocaleDateString()}.
        </p>
        <Link href="/organisations" className="text-sm underline">
          View your organisations
        </Link>
      </div>
    );
  }

  if (invitation.status !== "PENDING") {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12">
        <h1 className="text-xl font-bold">Invitation Unavailable</h1>
        <p className="text-sm text-[var(--text-muted)]">
          This invitation is no longer available.
        </p>
        <Link href="/organisations" className="text-sm underline">
          View your organisations
        </Link>
      </div>
    );
  }

  const existingMembership = await db.organisationMembership.findFirst({
    where: {
      userId: session.user.id,
      organisationId: invitation.organisation.id,
    },
  });

  if (existingMembership) {
    redirect(`/o/${invitation.organisation.slug}`);
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <div>
        <h1 className="text-xl font-bold">Organisation Invitation</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          You have been invited to join <strong>{invitation.organisation.name}</strong> as <strong>{invitation.intendedRole}</strong>.
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Invited email: {invitation.invitedEmail}
        </p>
      </div>

      <InviteAcceptanceForm token={token} organisationName={invitation.organisation.name} organisationSlug={invitation.organisation.slug} />
    </div>
  );
}