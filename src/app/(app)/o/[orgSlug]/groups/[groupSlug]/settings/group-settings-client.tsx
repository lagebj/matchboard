"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings, Users, Plus, Trash2, Shield, Pencil, ArrowRight } from "lucide-react";
import {
  addGroupAccessAction,
  removeGroupAccessAction,
  deactivateGroupAction,
  updateGroupAction,
  addPlayerToGroupAction,
  removePlayerFromGroupAction,
  createGroupMovementPathAction,
  deactivateGroupMovementPathAction,
  reactivateGroupMovementPathAction,
} from "@/app/(app)/o/[orgSlug]/groups/actions";

const GROUP_TYPE_LABELS: Record<string, string> = {
  AGE_GROUP: "Age group",
  GENDER_GROUP: "Gender group",
  COMPETITIVE_GROUP: "Competitive group",
  CUSTOM: "Custom",
};

const GROUP_TYPE_OPTIONS = [
  { value: "AGE_GROUP", label: "Age group" },
  { value: "GENDER_GROUP", label: "Gender group" },
  { value: "COMPETITIVE_GROUP", label: "Competitive group" },
  { value: "CUSTOM", label: "Custom" },
];

const MEMBERSHIP_TYPE_LABELS: Record<string, string> = {
  PRIMARY: "Primary",
  SECONDARY: "Secondary",
  TEMPORARY: "Temporary",
};

const MOVEMENT_ROLE_LABELS: Record<string, string> = {
  SUPPORT: "Support",
  DEVELOPMENT: "Development",
  CONFIDENCE_REBUILD: "Confidence rebuild",
  BACKFILL: "Squad repair",
};

const MOVEMENT_SCOPE_LABELS: Record<string, string> = {
  MATCH: "Match",
  EVENT: "Event",
};

type MovementPathItem = {
  id: string;
  fromGroupId: string;
  toGroupId: string;
  role: string;
  scope: string;
  isActive: boolean;
  fromGroup: { id: string; name: string; slug: string };
  toGroup: { id: string; name: string; slug: string };
};

type PlayerItem = {
  id: string;
  playerId: string;
  membershipType: string;
  coreTeamId: string | null;
  player: {
    id: string;
    firstName: string;
    lastName: string | null;
    active: boolean;
    coreTeamId: string | null;
    coreTeam: { id: string; name: string } | null;
  };
};

type GroupAccessItem = {
  id: string;
  role: string;
  membership: {
    id: string;
    userId: string;
    role: string;
    user: {
      id: string;
      name: string | null;
      email: string;
    };
  };
};

type TeamItem = {
  id: string;
  name: string;
};

type GroupDetail = {
  id: string;
  name: string;
  slug: string;
  type: string;
  cohortYear: number | null;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  teams: TeamItem[];
  groupAccesses: GroupAccessItem[];
  playerCount: number;
  players: PlayerItem[];
};

export function GroupSettingsClient({
  group,
  orgSlug,
  canMutate,
  movementPaths,
  availableMembers,
}: {
  group: GroupDetail;
  orgSlug: string;
  canMutate: boolean;
  movementPaths: MovementPathItem[];
  availableMembers: { id: string; role: string; user: { id: string; name: string | null; email: string } }[];
}) {
  const [deactivating, setDeactivating] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <Link href={`/o/${orgSlug}/groups/${group.slug}`} className="text-muted-foreground hover:underline">
              {group.name}
            </Link>
            <span className="mx-2 text-muted-foreground">/</span>
            Settings
          </h1>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Group details
        </h2>
        {canMutate ? (
          <GroupEditForm group={group} />
        ) : (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Name</div>
              <div className="font-medium">{group.name}</div>
              <div className="text-muted-foreground">Type</div>
              <div className="font-medium">{GROUP_TYPE_LABELS[group.type] ?? group.type}</div>
              <div className="text-muted-foreground">Cohort year</div>
              <div className="font-medium">{group.cohortYear ?? "—"}</div>
              <div className="text-muted-foreground">Slug</div>
              <div className="font-medium font-mono text-xs">{group.slug}</div>
              <div className="text-muted-foreground">Description</div>
              <div className="font-medium">{group.description ?? "—"}</div>
              <div className="text-muted-foreground">Created</div>
              <div className="font-medium">{new Date(group.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Group access
        </h2>
        {group.groupAccesses.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No coaches or viewers have explicit group access yet.
            <br />
            OWNER and ADMIN have implicit access to all groups.
          </div>
        ) : (
          <div className="space-y-2">
            {group.groupAccesses.map((access: GroupAccessItem) => (
              <div
                key={access.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{access.membership.user.name ?? access.membership.user.email}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {access.role === "GROUP_COACH" ? "Coach" : "Viewer"}
                  </span>
                </div>
                {canMutate && (
                  <form
                    action={async () => {
                      await removeGroupAccessAction(group.id, access.membership.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                      title="Remove access"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}

        {canMutate && (
          <AddAccessForm groupId={group.id} availableMembers={availableMembers} />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Player pool
        </h2>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground mb-3">
            {group.playerCount} player{group.playerCount !== 1 ? "s" : ""} in this group.
          </p>
          {group.players && group.players.length > 0 ? (
            <div className="space-y-1">
              {group.players.map((p: PlayerItem) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.player.firstName}{p.player.lastName ? ` ${p.player.lastName}` : ""}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {MEMBERSHIP_TYPE_LABELS[p.membershipType] ?? p.membershipType}
                    </span>
                    {p.player.coreTeam && (
                      <span className="text-xs text-muted-foreground">{p.player.coreTeam.name}</span>
                    )}
                  </div>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ArrowRight className="h-5 w-5" />
          Movement paths
        </h2>
        <p className="text-sm text-muted-foreground">
          Movement paths define which groups players can move between and for what role.
        </p>
        {movementPaths.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No movement paths configured for this group yet.
          </div>
        ) : (
          <div className="space-y-2">
            {movementPaths.map((path) => (
              <div key={path.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{path.fromGroup.name}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{path.toGroup.name}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {MOVEMENT_ROLE_LABELS[path.role] ?? path.role}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {MOVEMENT_SCOPE_LABELS[path.scope] ?? path.scope}
                  </span>
                  {!path.isActive && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-orange-600">Inactive</span>
                  )}
                </div>
                {canMutate && (
                  <form
                    action={async () => {
                      if (path.isActive) {
                        await deactivateGroupMovementPathAction(path.id);
                      } else {
                        await reactivateGroupMovementPathAction(path.id);
                      }
                    }}
                  >
                    <button
                      type="submit"
                      className={`rounded-md px-3 py-1 text-xs font-medium ${
                        path.isActive
                          ? "text-destructive hover:bg-destructive/10"
                          : "text-primary hover:bg-primary/10"
                      }`}
                    >
                      {path.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
        {canMutate && (
          <AddMovementPathForm groupId={group.id} />
        )}
      </section>

      {canMutate && (
                    <form
                      action={async () => {
                        await removePlayerFromGroupAction(group.id, p.playerId);
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Remove from group"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No players in this group yet.</p>
          )}
          {canMutate && (
            <AddPlayerForm groupId={group.id} />
          )}
        </div>
      </section>

      {canMutate && (
        <section className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-semibold text-destructive">Danger zone</h2>
          <div className="rounded-lg border border-destructive/20 p-4">
            <p className="text-sm text-muted-foreground">
              Deactivating this group will remove it from the active groups list.
              This cannot be undone if the group has players, teams, or seasons.
            </p>
            <button
              onClick={() => {
                if (confirm("Are you sure you want to deactivate this group?")) {
                  setDeactivating(true);
                  deactivateGroupAction(group.id);
                }
              }}
              disabled={deactivating}
              className="mt-3 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {deactivating ? "Deactivating..." : "Deactivate group"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function GroupEditForm({ group }: { group: GroupDetail }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [type, setType] = useState(group.type);
  const [cohortYear, setCohortYear] = useState(group.cohortYear?.toString() ?? "");
  const [description, setDescription] = useState(group.description ?? "");
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Group details</span>
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">Name</div>
          <div className="font-medium">{group.name}</div>
          <div className="text-muted-foreground">Type</div>
          <div className="font-medium">{GROUP_TYPE_LABELS[group.type] ?? group.type}</div>
          <div className="text-muted-foreground">Cohort year</div>
          <div className="font-medium">{group.cohortYear ?? "—"}</div>
          <div className="text-muted-foreground">Slug</div>
          <div className="font-medium font-mono text-xs">{group.slug}</div>
          <div className="text-muted-foreground">Description</div>
          <div className="font-medium">{group.description ?? "—"}</div>
          <div className="text-muted-foreground">Created</div>
          <div className="font-medium">{new Date(group.createdAt).toLocaleDateString()}</div>
        </div>
      </div>
    );
  }

  return (
    <form
      action={async () => {
        setSaving(true);
        const formData = new FormData();
        formData.set("name", name);
        formData.set("type", type);
        formData.set("cohortYear", cohortYear);
        formData.set("description", description);
        await updateGroupAction(group.id, formData);
      }}
      className="rounded-lg border p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Edit group details</span>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Name</label>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Type</label>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {GROUP_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Cohort year</label>
          <input
            type="number"
            name="cohortYear"
            value={cohortYear}
            onChange={(e) => setCohortYear(e.target.value)}
            placeholder="e.g. 2015"
            min="2000"
            max="2100"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Slug</label>
          <input
            type="text"
            value={group.slug}
            disabled
            className="w-full rounded-md border bg-muted px-3 py-2 text-sm font-mono text-muted-foreground"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Description</label>
        <textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Optional description"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}

type AvailableMember = {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string };
};

function AddAccessForm({ groupId, availableMembers }: { groupId: string; availableMembers: AvailableMember[] }) {
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [role, setRole] = useState("GROUP_COACH");

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="text-sm font-medium">Add group access</h3>
      {availableMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground">All coaches and viewers already have access to this group.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Member</label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a member</option>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.user.name ?? m.user.email} ({m.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="GROUP_COACH">Coach</option>
                <option value="GROUP_VIEWER">Viewer</option>
              </select>
            </div>
          </div>
          <button
            onClick={async () => {
              if (!selectedMemberId) return;
              const result = await addGroupAccessAction(groupId, selectedMemberId, role);
              if (result?.success) {
                setSelectedMemberId("");
              }
            }}
            disabled={!selectedMemberId}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="inline h-4 w-4 mr-1" />
            Add access
          </button>
        </>
      )}
    </div>
  );
}

function AddPlayerForm({ groupId }: { groupId: string }) {
  const [playerId, setPlayerId] = useState("");
  const [membershipType, setMembershipType] = useState("PRIMARY");
  const [adding, setAdding] = useState(false);

  return (
    <div className="mt-3 rounded-lg border border-dashed p-4 space-y-3">
      <h3 className="text-sm font-medium">Add player to group</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Player ID</label>
          <input
            type="text"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            placeholder="Enter player ID"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Membership type</label>
          <select
            value={membershipType}
            onChange={(e) => setMembershipType(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="PRIMARY">Primary</option>
            <option value="SECONDARY">Secondary</option>
            <option value="TEMPORARY">Temporary</option>
          </select>
        </div>
      </div>
      <button
        onClick={async () => {
          if (!playerId.trim()) return;
          setAdding(true);
          const formData = new FormData();
          formData.set("membershipType", membershipType);
          const result = await addPlayerToGroupAction(groupId, playerId.trim(), formData);
          if (result?.success) {
            setPlayerId("");
          }
          setAdding(false);
        }}
        disabled={!playerId.trim() || adding}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        <Plus className="inline h-4 w-4 mr-1" />
        {adding ? "Adding..." : "Add player"}
      </button>
    </div>
  );
}

function AddMovementPathForm({ groupId }: { groupId: string }) {
  const [toGroupId, setToGroupId] = useState("");
  const [role, setRole] = useState("SUPPORT");
  const [scope, setScope] = useState("MATCH");
  const [creating, setCreating] = useState(false);

  return (
    <div className="mt-3 rounded-lg border border-dashed p-4 space-y-3">
      <h3 className="text-sm font-medium">Add movement path</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Target group ID</label>
          <input
            type="text"
            value={toGroupId}
            onChange={(e) => setToGroupId(e.target.value)}
            placeholder="Enter group ID"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {Object.entries(MOVEMENT_ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Scope</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {Object.entries(MOVEMENT_SCOPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        This group will be the source. The target group ID is the group players can move to.
      </p>
      <button
        onClick={async () => {
          if (!toGroupId.trim()) return;
          setCreating(true);
          const result = await createGroupMovementPathAction(groupId, toGroupId.trim(), role, scope);
          if (result?.success) {
            setToGroupId("");
          }
          setCreating(false);
        }}
        disabled={!toGroupId.trim() || creating}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        <Plus className="inline h-4 w-4 mr-1" />
        {creating ? "Creating..." : "Add path"}
      </button>
    </div>
  );
}