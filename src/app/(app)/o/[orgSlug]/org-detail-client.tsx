"use client";

import { useState } from "react";
import {
  createInvitationAction,
  revokeInvitationAction,
  updateMembershipRoleAction,
  addTeamAccessAction,
  removeTeamAccessAction,
} from "@/app/(app)/organisations/actions";

type TeamAccess = {
  id: string;
  teamId: string;
  team: { id: string; name: string };
};

type Membership = {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string | null; email: string };
  teamAccesses: TeamAccess[];
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
  teams: Team[];
};

type Team = { id: string; name: string };

export function OrgDetailClient({
  org,
  orgSlug,
  currentUserId,
  currentUserRole,
  canInvite,
  canManageRoles,
  canManageTeamAccess,
  teams,
}: {
  org: Org;
  orgSlug: string;
  currentUserId: string;
  currentUserRole: string;
  canInvite: boolean;
  canManageRoles: boolean;
  canManageTeamAccess: boolean;
  teams: Team[];
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

  async function handleAddTeamAccess(membershipId: string, teamId: string) {
    const result = await addTeamAccessAction(orgSlug, membershipId, teamId);
    if (result.success) {
      setRefreshKey((k) => k + 1);
    }
  }

  async function handleRemoveTeamAccess(membershipId: string, teamId: string) {
    const result = await removeTeamAccessAction(orgSlug, membershipId, teamId);
    if (result.success) {
      setRefreshKey((k) => k + 1);
    }
  }

  const roleOrder = ["OWNER", "ADMIN", "COACH", "VIEWER"];

  return (
    <div className="space-y-6" key={refreshKey}>
      <div>
        <h1 className="text-2xl font-bold">{org.name}</h1>
        <p className="text-sm text-muted-foreground">
          Slug: {org.slug}
          {org.isSynthetic ? " \u00b7 Synthetic" : ""}
        </p>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Members</h2>
          {canInvite && (
            <button
              onClick={() => setShowInviteForm(!showInviteForm)}
              className="rounded-md bg-[var(--surface-2)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-3)]"
            >
              {showInviteForm ? "Cancel" : "Invite member"}
            </button>
          )}
        </div>

        {showInviteForm && (
          <div className="rounded-md border border-[var(--border-soft)] p-4 mb-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="coach@example.com"
                className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-1)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Role</label>
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
              className="rounded-md bg-[var(--surface-2)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-3)] disabled:opacity-50"
            >
              {inviteSending ? "Sending..." : "Send invitation"}
            </button>
          </div>
        )}

        {org.memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
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
                        <span className="text-xs text-muted-foreground ml-2">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.user.email}</p>
                  </div>
                  <div className="shrink-0">
                    {canManageRoles && m.userId !== currentUserId ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                        disabled={m.userId === currentUserId}
                        className="text-xs font-medium px-2 py-1 rounded bg-[var(--surface-2)] border border-[var(--border-soft)]"
                      >
                        {roleOrder.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--surface-2)]">{m.role}</span>
                    )}
                  </div>
                </div>

                {(m.role === "COACH" || m.role === "VIEWER") && canManageTeamAccess && (
                  <div className="mt-2 pt-2 border-t border-[var(--border-soft)]">
                    <div className="flex flex-wrap gap-1 mb-2">
                      {m.teamAccesses.map((ta) => (
                        <span
                          key={ta.id}
                          className="inline-flex items-center gap-1 text-xs bg-[var(--surface-2)] px-2 py-0.5 rounded"
                        >
                          {ta.team.name}
                          <button
                            onClick={() => handleRemoveTeamAccess(m.id, ta.teamId)}
                            className="text-muted-foreground hover:text-red-500"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                    {teams.length > m.teamAccesses.length && (
                      <select
                        className="text-xs border border-[var(--border-soft)] rounded px-2 py-1 bg-[var(--surface-1)]"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddTeamAccess(m.id, e.target.value);
                            e.target.value = "";
                          }
                        }}
                      >
                        <option value="">+ Add team access</option>
                        {teams
                          .filter((t) => !m.teamAccesses.some((ta) => ta.teamId === t.id))
                          .map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                      </select>
                    )}
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
                  <p className="text-xs text-muted-foreground">
                    {inv.intendedRole} &middot; Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleRevokeInvitation(inv.id)}
                  className="text-xs text-muted-foreground hover:text-red-500"
                >
                  Revoke
                </button>
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