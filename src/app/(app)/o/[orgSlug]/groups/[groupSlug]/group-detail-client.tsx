"use client";

import Link from "next/link";
import { Users, Shield, Settings, UserCheck, ArrowRight, Trophy, GitBranch } from "lucide-react";

const GROUP_TYPE_LABELS: Record<string, string> = {
  AGE_GROUP: "Age group",
  GENDER_GROUP: "Gender group",
  COMPETITIVE_GROUP: "Competitive group",
  CUSTOM: "Custom",
};

const MEMBERSHIP_TYPE_LABELS: Record<string, string> = {
  PRIMARY: "Primary",
  SECONDARY: "Secondary",
  TEMPORARY: "Temporary",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  CUP: "Cup",
  TOURNAMENT: "Tournament",
  FRIENDLY_DAY: "Friendly day",
  OTHER: "Other",
};

const PATH_ROLE_LABELS: Record<string, string> = {
  SUPPORT: "Support",
  DEVELOPMENT: "Development",
  CONFIDENCE_REBUILD: "Confidence rebuild",
  BACKFILL: "Squad repair",
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
  players: PlayerItem[];
  playerCount: number;
  leagueSeasons: { id: string; name: string; status: string }[];
  events: { id: string; name: string; eventType: string }[];
  outgoingPaths: { id: string; toGroupId: string; toGroupName: string; role: string; isActive: boolean }[];
  incomingPaths: { id: string; fromGroupId: string; fromGroupName: string; role: string; isActive: boolean }[];
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

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
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
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            Coaches
          </div>
          <p className="mt-1 text-2xl font-semibold">{group.groupAccesses.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            Paths
          </div>
          <p className="mt-1 text-2xl font-semibold">{group.outgoingPaths.length + group.incomingPaths.length}</p>
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
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {group.players.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Players</h2>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Core team</th>
                  <th className="px-3 py-2 text-left font-medium">Membership</th>
                </tr>
              </thead>
              <tbody>
                {group.players.map((gp: PlayerItem) => (
                  <tr key={gp.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link
                        href={`/o/${orgSlug}/players/${gp.player.id}`}
                        className="text-primary hover:underline"
                      >
                        {gp.player.firstName}{gp.player.lastName ? ` ${gp.player.lastName}` : ""}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {gp.player.coreTeam?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {MEMBERSHIP_TYPE_LABELS[gp.membershipType] ?? gp.membershipType}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                <span className="font-medium">
                  {access.membership.user.name ?? access.membership.user.email}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {access.role === "GROUP_COACH" ? "Coach" : "Viewer"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {group.leagueSeasons.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">League seasons</h2>
          <div className="space-y-2">
            {group.leagueSeasons.map((season) => (
              <div
                key={season.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <span className="font-medium">{season.name}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {season.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {group.events.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            Events
          </h2>
          <div className="space-y-2">
            {group.events.map((event) => (
              <Link
                key={event.id}
                href={`/o/${orgSlug}/events/${event.id}`}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <span className="font-medium">{event.name}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {(group.outgoingPaths.length > 0 || group.incomingPaths.length > 0) && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            Movement paths
          </h2>
          <div className="space-y-2">
            {group.outgoingPaths.map((path) => (
              <div
                key={path.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <span className="text-sm">
                  <span className="font-medium">{group.name}</span>
                  <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                  <span className="font-medium">{path.toGroupName}</span>
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {PATH_ROLE_LABELS[path.role] ?? path.role}
                </span>
              </div>
            ))}
            {group.incomingPaths.map((path) => (
              <div
                key={path.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <span className="text-sm">
                  <span className="font-medium">{path.fromGroupName}</span>
                  <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                  <span className="font-medium">{group.name}</span>
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {PATH_ROLE_LABELS[path.role] ?? path.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}