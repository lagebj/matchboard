"use client";

import Link from "next/link";
import { Plus, Users, Shield, Calendar, ArrowRight } from "lucide-react";

const GROUP_TYPE_LABELS: Record<string, string> = {
  AGE_GROUP: "Age group",
  GENDER_GROUP: "Gender group",
  COMPETITIVE_GROUP: "Competitive group",
  CUSTOM: "Custom",
};

type GroupListItem = {
  id: string;
  name: string;
  slug: string;
  type: string;
  cohortYear: number | null;
  isActive: boolean;
  createdAt: Date;
  _count: {
    teams: number;
    players: number;
    groupAccesses: number;
  };
};

export function GroupListClient({
  groups,
  orgSlug,
}: {
  groups: GroupListItem[];
  orgSlug: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage player pools, teams, and access for each group.
          </p>
        </div>
        <Link
          href={`/o/${orgSlug}/groups/new`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create group
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-sm font-medium">No groups yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a group to start managing player pools and team access.
          </p>
          <Link
            href={`/o/${orgSlug}/groups/new`}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create group
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/o/${orgSlug}/groups/${group.slug}`}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{group.name}</h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {GROUP_TYPE_LABELS[group.type] ?? group.type}
                  </span>
                  {group.cohortYear && (
                    <span className="text-xs text-muted-foreground">
                      Born {group.cohortYear}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {group._count.players} players
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5" />
                    {group._count.teams} teams
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {group._count.groupAccesses} coaches
                  </span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}