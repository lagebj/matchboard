import { getOrgContext } from "./org-context";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

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
      createdAt: true,
      memberships: {
        select: {
          id: true,
          userId: true,
          role: true,
          user: { select: { name: true, email: true } },
          teamAccesses: { select: { teamId: true, team: { select: { name: true } } } },
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
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!org) {
    redirect("/organisations");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{org.name}</h1>
        <p className="text-sm text-muted-foreground">Slug: {org.slug}</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Members</h2>
        {org.memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <div className="space-y-2">
            {org.memberships.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-md border border-[var(--border-soft)] px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.user.name || m.user.email}</p>
                  <p className="text-xs text-muted-foreground">{m.user.email}</p>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--surface-2)]">{m.role}</span>
                {m.teamAccesses.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Teams: {m.teamAccesses.map((ta) => ta.team.name).join(", ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {org.invitations.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Pending Invitations</h2>
          <div className="space-y-2">
            {org.invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 rounded-md border border-[var(--border-soft)] px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{inv.invitedEmail}</p>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--surface-2)]">{inv.intendedRole}</span>
                <span className="text-xs text-muted-foreground">
                  Expires {inv.expiresAt.toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Teams</h2>
        {org.teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teams yet.</p>
        ) : (
          <div className="space-y-1">
            {org.teams.map((t) => (
              <div key={t.id} className="text-sm">{t.name}</div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}