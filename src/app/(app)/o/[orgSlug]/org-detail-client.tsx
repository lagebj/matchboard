"use client";

import { useState } from "react";
import {
  createInvitationAction,
  revokeInvitationAction,
  updateMembershipRoleAction,
} from "@/app/(app)/organisations/actions";

type GroupAccess = {
  id: string;
  footballGroupId: string;
  role: string;
  group: { id: string; name: string };
};

type Membership = {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string | null; email: string };
  groupAccesses: GroupAccess[];
};

type Invitation = {
  id: string;
  invitedEmail: string;
  intendedRole: string;
  status: string;
  expiresAt: string;
  createdAt: string;
};

type Org = {
  id: string;
  name: string;
  slug: string;
  isSynthetic: boolean;
  createdAt: string;
  memberships: Membership[];
  invitations: Invitation[];
  footballGroups: Group[];
};

type Group = { id: string; name: string; slug: string };

export function OrgDetailClient({
  org,
  orgSlug,
  currentUserId,
  currentUserRole,
  canInvite,
  canManageRoles,
  canManageGroupAccess,
}: {
  org: Org;
  orgSlug: string;
  currentUserId: string;
  currentUserRole: string;
  canInvite: boolean;
  canManageRoles: boolean;
  canManageGroupAccess: boolean;
}) {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("COACH");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isOwner = currentUserRole === "OWNER";
  const isAdmin = currentUserRole === "ADMIN";

  async function handleInvite() {
    setInviteSending(true);
    setInviteError(null);
    const result = await createInvitationAction(orgSlug, inviteEmail, inviteRole);
    if (result.success) {
      setInviteEmail("");
      setInviteRole("COACH");
      setShowInviteForm(false);
      setRefreshKey((k) => k + 1);
    } else {
      setInviteError(result.error);
    }
    setInviteSending(false);
  }

  async function handleRevokeInvitation(invitationId: string) {
    const result = await revokeInvitationAction(orgSlug, invitationId);
    if (result.success) {
      setRefreshKey((k) => k + 1);
    }
  }

  async function handleRoleChange(membershipId: string, newRole: string) {
    await updateMembershipRoleAction(orgSlug, membershipId, newRole);
    setRefreshKey((k) => k + 1);
  }

  const roleOrder = ["OWNER", "ADMIN", "COACH", "VIEWER"];

  return (
    <div className="space-y-6" key={refreshKey}>
      <div>
        <h1 className="text-2xl font-bold">{org.name}</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Slug: {org.slug}
          {org.isSynthetic ? " · Synthetic" : ""}
          {(canInvite || canManageRoles) && (
            <a href={`/o/${orgSlug}/settings`} className="ml-2 underline hover:text-foreground">
              Settings
            </a>
          )}
        </p>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Members</h2>
          {canInvite && (
            <button
              onClick={() => setShowInviteForm(!showInviteForm)}
              className="rounded-md bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-hover)]"
            >
              {showInviteForm ? "Cancel" : "Invite member"}
            </button>
          )}
        </div>

        {showInviteForm && (
          <div className="rounded-md border border-[var(--border-soft)] p-4 mb-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)]">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="coach@example.com"
                className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-1)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)]">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-1)] px-3 py-2 text-sm"
              >
                {isOwner && <option value="OWNER">Owner</option>}
                {(isOwner || isAdmin) && <option value="ADMIN">Admin</option>}
                <option value="COACH">Coach</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>
            {inviteError && <p className="text-sm text-red-500">{inviteError}</p>}
            <button
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || inviteSending}
              className="rounded-md bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              {inviteSending ? "Sending..." : "Send invitation"}
            </button>
          </div>
        )}

        {org.memberships.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No members yet.</p>
        ) : (
          <div className="space-y-2">
            {org.memberships
              .sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role))
              .map((m) => (
              <div key={m.id} className="rounded-md border border-[var(--border-soft)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {m.user.name || m.user.email}
                      {m.userId === currentUserId && (
                        <span className="text-xs text-[var(--text-muted)] ml-2">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">{m.user.email}</p>
                  </div>
                  <div className="shrink-0">
                    {canManageRoles && m.userId !== currentUserId ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                        disabled={m.userId === currentUserId}
                        className="text-xs font-medium px-2 py-1 rounded bg-[var(--surface-muted)] border border-[var(--border-soft)]"
                      >
                        {roleOrder.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--surface-muted)]">{m.role}</span>
                    )}
                  </div>
                </div>

                {(m.role === "COACH" || m.role === "VIEWER") && canManageGroupAccess && (
                  <div className="mt-2 pt-2 border-t border-[var(--border-soft)]">
                    <div className="flex flex-wrap gap-1 mb-2">
                      {m.groupAccesses.map((ga) => (
                        <span
                          key={ga.id}
                          className="inline-flex items-center gap-1 text-xs bg-[var(--surface-muted)] px-2 py-0.5 rounded"
                        >
                          {ga.group.name} ({ga.role})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {org.invitations.length > 0 && canInvite && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Pending Invitations</h2>
          <div className="space-y-2">
            {org.invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 rounded-md border border-[var(--border-soft)] px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{inv.invitedEmail}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {inv.intendedRole} &middot; Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleRevokeInvitation(inv.id)}
                  className="text-xs text-[var(--text-muted)] hover:text-red-500"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Groups</h2>
          <a
            href={`/o/${orgSlug}/groups`}
            className="rounded-md bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-hover)]"
          >
            View all
          </a>
        </div>
        {org.footballGroups.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No groups yet. <a href={`/o/${orgSlug}/groups/new`} className="underline hover:text-foreground">Create a group</a>.</p>
        ) : (
          <div className="space-y-1">
            {org.footballGroups.map((g) => (
              <a
                key={g.id}
                href={`/o/${orgSlug}/groups/${g.slug ?? g.id}`}
                className="block text-sm hover:underline"
              >
                {g.name}
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}