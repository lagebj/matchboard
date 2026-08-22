"use client";

import { useState } from "react";
import {
  createMachinePrincipalAction,
  revokeMachinePrincipalAction,
  reactivateMachinePrincipalAction,
  rotateMachinePrincipalSecretAction,
} from "@/app/(app)/organisations/machine-principal-actions";
import {
  suspendOrganisationAction,
  reactivateOrganisationAction,
  deleteOrganisationAction,
} from "@/app/(app)/organisations/actions";

type Org = {
  id: string;
  name: string;
  slug: string;
  isSynthetic: boolean;
  createdAt: string;
  _count: { memberships: number; teams: number; players: number; machinePrincipals: number };
};

type Principal = {
  id: string;
  name: string;
  description: string | null;
  scopes: string[];
  status: string;
  clientCredentialPrefix: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

export function OrgSettingsClient({
  org,
  principals,
  orgSlug,
  isOwner,
  isSuspended,
  suspendedReason,
}: {
  org: Org;
  principals: Principal[];
  orgSlug: string;
  isOwner: boolean;
  isSuspended: boolean;
  suspendedReason: string | null;
}) {
  const [showCreatePrincipal, setShowCreatePrincipal] = useState(false);
  const [principalName, setPrincipalName] = useState("");
  const [principalDescription, setPrincipalDescription] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["scenario:read"]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const allScopes = [
    "scenario:read",
    "scenario:execute",
    "scenario:reset-own-data",
    "ui:simulate",
    "fixtures:read",
    "players:read",
    "teams:read",
    "selections:read",
    "selections:write",
  ];

  async function handleCreatePrincipal() {
    setCreateLoading(true);
    setCreateError(null);
    const result = await createMachinePrincipalAction(orgSlug, principalName, principalDescription || undefined, selectedScopes);
    if (result.success) {
      setCreatedSecret(result.data.clientSecret);
      setPrincipalName("");
      setPrincipalDescription("");
      setSelectedScopes(["scenario:read"]);
      setRefreshKey((k) => k + 1);
    } else {
      setCreateError(result.error);
    }
    setCreateLoading(false);
  }

  function toggleScope(scope: string) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  return (
    <div className="space-y-8" key={refreshKey}>
      <div>
        <h1 className="text-2xl font-bold">Organisation Settings</h1>
        <p className="text-sm text-[var(--text-muted)]">Manage {org.name}</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-[var(--text-muted)]">Name</span>
            <p className="font-medium">{org.name}</p>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Slug</span>
            <p className="font-medium">{org.slug}</p>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Created</span>
            <p className="font-medium">{new Date(org.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Members</span>
            <p className="font-medium">{org._count.memberships}</p>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Teams</span>
            <p className="font-medium">{org._count.teams}</p>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Players</span>
            <p className="font-medium">{org._count.players}</p>
          </div>
        </div>
      </section>

      {isOwner && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Machine Principals</h2>
            <button
              onClick={() => { setShowCreatePrincipal(!showCreatePrincipal); setCreatedSecret(null); }}
              className="rounded-md bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-hover)]"
            >
              {showCreatePrincipal ? "Cancel" : "Create principal"}
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Machine principals are API clients for automation. They are scoped to this organisation and cannot access data from other organisations.
          </p>

          {showCreatePrincipal && (
            <div className="rounded-md border border-[var(--border-soft)] p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)]">Name</label>
                <input
                  type="text"
                  value={principalName}
                  onChange={(e) => setPrincipalName(e.target.value)}
                  placeholder="e.g., Simulation Bot"
                  className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-1)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)]">Description (optional)</label>
                <input
                  type="text"
                  value={principalDescription}
                  onChange={(e) => setPrincipalDescription(e.target.value)}
                  placeholder="Purpose of this machine principal"
                  className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-1)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)]">Scopes</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {allScopes.map((scope) => (
                    <label key={scope} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope)}
                        onChange={() => toggleScope(scope)}
                        className="rounded"
                      />
                      {scope}
                    </label>
                  ))}
                </div>
              </div>
              {createError && <p className="text-sm text-red-500">{createError}</p>}
              {createdSecret && (
                <div className="rounded-md border border-green-800 bg-green-950/30 p-3">
                  <p className="text-sm font-medium text-green-400">Principal created!</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Copy this client secret now. It will not be shown again.
                  </p>
                  <code className="block mt-2 rounded bg-[var(--surface-1)] px-2 py-1 text-xs break-all">{createdSecret}</code>
                </div>
              )}
              <button
                onClick={handleCreatePrincipal}
                disabled={!principalName.trim() || selectedScopes.length === 0 || createLoading}
                className="rounded-md bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
              >
                {createLoading ? "Creating..." : "Create principal"}
              </button>
            </div>
          )}

          {principals.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No machine principals yet.</p>
          ) : (
            <div className="space-y-2">
              {principals.map((p) => (
                <div key={p.id} className="rounded-md border border-[var(--border-soft)] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{p.name}</p>
                      {p.description && <p className="text-xs text-[var(--text-muted)]">{p.description}</p>}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${p.status === "ACTIVE" ? "bg-green-950/30 text-green-400" : "bg-red-950/30 text-red-400"}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.scopes.map((s) => (
                      <span key={s} className="text-xs bg-[var(--surface-muted)] px-1.5 py-0.5 rounded">{s}</span>
                    ))}
                  </div>
                  {p.clientCredentialPrefix && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">Prefix: {p.clientCredentialPrefix}...</p>
                  )}
                  <div className="mt-2 flex gap-2">
                    {p.status === "ACTIVE" && (
                      <>
                        <RotateSecretButton principalId={p.id} orgSlug={orgSlug} />
                        <RevokeButton principalId={p.id} orgSlug={orgSlug} />
                      </>
                    )}
                    {p.status === "REVOKED" && (
                      <ReactivateButton principalId={p.id} orgSlug={orgSlug} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {isOwner && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>

          {isSuspended ? (
            <div className="rounded-md border border-red-800 bg-red-950/20 p-4 space-y-3">
              <p className="text-sm font-medium text-red-400">
                This organisation is suspended.
              </p>
              {suspendedReason && (
                <p className="text-xs text-[var(--text-muted)]">Reason: {suspendedReason}</p>
              )}
              <p className="text-xs text-[var(--text-muted)]">
                Suspended organisations block all member access. Reactivate to restore access.
              </p>
              <div className="flex gap-3">
                <SuspendActionButton orgSlug={orgSlug} action="reactivate" />
                <DeleteOrgButton orgSlug={orgSlug} />
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-[var(--border-soft)] p-4 space-y-3">
              <p className="text-sm text-[var(--text-muted)]">
                Suspending an organisation blocks all member access. This is reversible.
              </p>
              <SuspendActionButton orgSlug={orgSlug} action="suspend" />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SuspendActionButton({ orgSlug, action }: { orgSlug: string; action: "suspend" | "reactivate" }) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSuspend() {
    if (action === "suspend" && !reason.trim()) {
      setError("A reason is required for suspension.");
      return;
    }
    if (action === "suspend" && !confirm("Suspend this organisation? All members will lose access.")) return;
    if (action === "reactivate" && !confirm("Reactivate this organisation? Members will regain access.")) return;

    setLoading(true);
    setError(null);

    const result = action === "suspend"
      ? await suspendOrganisationAction(orgSlug, reason)
      : await reactivateOrganisationAction(orgSlug);

    if (!result.success) {
      setError(result.error ?? "Unknown error");
    } else {
      window.location.reload();
    }
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      {action === "suspend" && (
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for suspension"
          className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-1)] px-3 py-2 text-sm"
        />
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        onClick={handleSuspend}
        disabled={loading}
        className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
          action === "suspend"
            ? "bg-red-950/30 text-red-400 hover:bg-red-950/50"
            : "bg-green-950/30 text-green-400 hover:bg-green-950/50"
        }`}
      >
        {loading
          ? action === "suspend" ? "Suspending..." : "Reactivating..."
          : action === "suspend" ? "Suspend organisation"
          : "Reactivate organisation"}
      </button>
    </div>
  );
}

function DeleteOrgButton({ orgSlug }: { orgSlug: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Permanently delete this organisation and all its data? This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? All teams, players, matches, selections, and history will be deleted forever.")) return;

    setLoading(true);
    setError(null);
    const result = await deleteOrganisationAction(orgSlug);
    if (!result.success) {
      setError(result.error ?? "Unknown error");
    } else {
      window.location.href = "/organisations";
    }
    setLoading(false);
  }

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="rounded-md bg-red-950/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-950/50 disabled:opacity-50"
      >
        {loading ? "Deleting..." : "Delete organisation permanently"}
      </button>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function RevokeButton({ principalId, orgSlug }: { principalId: string; orgSlug: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke() {
    if (!confirm("Revoke this machine principal? It will immediately lose all access.")) return;
    setLoading(true);
    setError(null);
    const result = await revokeMachinePrincipalAction(orgSlug, principalId);
    if (!result.success) setError(result.error ?? "Unknown error");
    else window.location.reload();
    setLoading(false);
  }

  return (
    <div>
      <button
        onClick={handleRevoke}
        disabled={loading}
        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
      >
        {loading ? "Revoking..." : "Revoke"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function ReactivateButton({ principalId, orgSlug }: { principalId: string; orgSlug: string }) {
  const [loading, setLoading] = useState(false);

  async function handleReactivate() {
    setLoading(true);
    const result = await reactivateMachinePrincipalAction(orgSlug, principalId);
    if (result.success) window.location.reload();
    setLoading(false);
  }

  return (
    <button
      onClick={handleReactivate}
      disabled={loading}
      className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50"
    >
      {loading ? "Reactivating..." : "Reactivate"}
    </button>
  );
}

function RotateSecretButton({ principalId, orgSlug }: { principalId: string; orgSlug: string }) {
  const [loading, setLoading] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  async function handleRotate() {
    if (!confirm("Rotate the client secret? The old secret will stop working immediately.")) return;
    setLoading(true);
    const result = await rotateMachinePrincipalSecretAction(orgSlug, principalId);
    if (result.success && result.data) {
      setNewSecret(result.data.clientSecret);
    }
    setLoading(false);
  }

  if (newSecret) {
    return (
      <div className="rounded border border-green-800 bg-green-950/30 p-2">
        <p className="text-xs text-green-400 font-medium">New secret generated</p>
        <code className="text-xs break-all">{newSecret}</code>
        <p className="text-xs text-[var(--text-muted)] mt-1">Copy now. Won&apos;t be shown again.</p>
      </div>
    );
  }

  return (
    <button
      onClick={handleRotate}
      disabled={loading}
      className="text-xs text-[var(--text-muted)] hover:text-foreground disabled:opacity-50"
    >
      {loading ? "Rotating..." : "Rotate secret"}
    </button>
  );
}