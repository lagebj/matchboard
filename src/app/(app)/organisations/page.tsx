import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export default async function OrganisationsPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/api/auth/signin");
  }

  const userOrgs = await db.organisationMembership.findMany({
    where: { userId: session.user.id ?? "" },
    select: {
      id: true,
      role: true,
      organisation: {
        select: {
          id: true,
          name: true,
          slug: true,
          isSynthetic: true,
          createdAt: true,
          _count: {
            select: {
              memberships: true,
              teams: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const pendingInvitations = await db.organisationInvitation.findMany({
    where: {
      invitedEmail: session.user.email,
      status: "PENDING",
      expiresAt: { gte: new Date() },
    },
    select: {
      id: true,
      token: true,
      intendedRole: true,
      organisation: {
        select: { name: true, slug: true },
      },
      expiresAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organisations</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Your organisations and pending invitations
          </p>
        </div>
      </div>

      {pendingInvitations.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Pending Invitations</h2>
          <div className="space-y-2">
            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-md border border-[var(--border-soft)] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{inv.organisation.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Invited as {inv.intendedRole} &middot; Expires {inv.expiresAt.toLocaleDateString()}
                  </p>
                </div>
                <a
                  href={`/invite/${inv.token}`}
                  className="rounded-md bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-hover)]"
                >
                  View invitation
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your Organisations</h2>
        {userOrgs.length === 0 ? (
          <div className="rounded-md border border-[var(--border-soft)] p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              You are not a member of any organisation yet.
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Matchboard is invitation-only. Ask an organisation owner or admin to invite you.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {userOrgs.map((membership) => (
              <a
                key={membership.id}
                href={`/o/${membership.organisation.slug}`}
                className="flex items-center justify-between rounded-md border border-[var(--border-soft)] px-4 py-3 hover:bg-[var(--surface-muted)] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{membership.organisation.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {membership.organisation._count.memberships} member{membership.organisation._count.memberships !== 1 ? "s" : ""} &middot; {membership.organisation._count.teams} team{membership.organisation._count.teams !== 1 ? "s" : ""}
                    {membership.organisation.isSynthetic ? " \u00b7 Synthetic" : ""}
                  </p>
                </div>
                <span className="ml-3 text-xs font-medium px-2 py-0.5 rounded bg-[var(--surface-muted)]">
                  {membership.role}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}