"use client";

import Link from "next/link";
import { Users, Shield, Calendar, Settings } from "lucide-react";

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

export function GroupDetailClient({
  group,
  orgSlug,
}: {
  group: GroupDetail;
  orgSlug: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {GROUP_TYPE_LABELS[group.type] ?? group.type}
            </span>
          </div>
          {group.cohortYear && (
            <p className="text-sm text-muted-foreground mt-1">
              Born {group.cohortYear}
            </p>
          )}
          {group.description && (
            <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
          )}
        </div>
        <Link
          href={`/o/${orgSlug}/groups/${group.slug}/settings`}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-muted-foreground" />
            Players
          </div>
          <p className="mt-1 text-2xl font-semibold">{group.playerCount}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Teams
          </div>
          <p className="mt-1 text-2xl font-semibold">{group.teams.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Coaches
          </div>
          <p className="mt-1 text-2xl font-semibold">{group.groupAccesses.length}</p>
        </div>
      </div>

      {group.teams.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Teams</h2>
          <div className="space-y-2">
            {group.teams.map((team: TeamItem) => (
              <Link
                key={team.id}
                href={`/o/${orgSlug}/teams/${team.id}`}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <span className="font-medium">{team.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {group.groupAccesses.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Coaches</h2>
          <div className="space-y-2">
            {group.groupAccesses.map((access: GroupAccessItem) => (
              <div
                key={access.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <span className="font-medium">{access.membership.userId}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {access.role === "GROUP_COACH" ? "Coach" : "Viewer"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}