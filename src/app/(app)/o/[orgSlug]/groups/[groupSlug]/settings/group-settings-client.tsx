"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings, Users, Plus, Trash2, Shield } from "lucide-react";
import {
  addGroupAccessAction,
  removeGroupAccessAction,
  deactivateGroupAction,
} from "@/app/(app)/o/[orgSlug]/groups/actions";

const GROUP_TYPE_LABELS: Record<string, string> = {
  AGE_GROUP: "Age group",
  GENDER_GROUP: "Gender group",
  COMPETITIVE_GROUP: "Competitive group",
  CUSTOM: "Custom",
};

type GroupAccessItem = {
  id: string;
  role: string;
  membership: {
    id: string;
    userId: string;
    role: string;
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
};

export function GroupSettingsClient({
  group,
  orgSlug,
  canMutate,
}: {
  group: GroupDetail;
  orgSlug: string;
  canMutate: boolean;
}) {
  const [adding, setAdding] = useState(false);
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
                  <span className="font-medium">{access.membership.userId}</span>
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
          <AddAccessForm groupId={group.id} />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Player pool
        </h2>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            {group.playerCount} player{group.playerCount !== 1 ? "s" : ""} in this group.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Player pool management will be available in a future update.
          </p>
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

function AddAccessForm({ groupId }: { groupId: string }) {
  const [membershipId, setMembershipId] = useState("");
  const [role, setRole] = useState("GROUP_COACH");

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="text-sm font-medium">Add group access</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Membership ID</label>
          <input
            type="text"
            value={membershipId}
            onChange={(e) => setMembershipId(e.target.value)}
            placeholder="Enter membership ID"
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
            <option value="GROUP_COACH">Coach</option>
            <option value="GROUP_VIEWER">Viewer</option>
          </select>
        </div>
      </div>
      <button
        onClick={async () => {
          if (!membershipId.trim()) return;
          const result = await addGroupAccessAction(groupId, membershipId.trim(), role);
          if (result?.success) {
            setMembershipId("");
          }
        }}
        disabled={!membershipId.trim()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        <Plus className="inline h-4 w-4 mr-1" />
        Add access
      </button>
    </div>
  );
}