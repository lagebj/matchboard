import { db } from "@/lib/db";
import { requirePageActorContext, requireMatchGroupAccess } from "@/lib/auth/actor-context";
import { AuthorizationError } from "@/lib/auth";
import { FollowLiveClient } from "@/components/live-match/follow-live-client";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export const dynamic = "force-dynamic";

interface FollowLivePageProps {
  params: Promise<{ orgSlug: string; matchId: string }>;
}

/**
 * Read-only "Follow live" viewer (ADR-0086 amendment). Server-side authorization here is the
 * real boundary — `requireMatchGroupAccess()` accepts GROUP_COACH or GROUP_VIEWER, matching
 * exactly what `/api/live-match/[matchId]/realtime-ticket`'s `mode: "view"` path requires, so
 * a coach who can reach this page can also actually obtain a view ticket. This page never
 * renders reporting controls — `FollowLiveClient` only ever calls read RPCs
 * (`getSnapshot`/callback handlers), never `recordEvent`/`endSession`.
 */
export default async function FollowLivePage({ params }: FollowLivePageProps) {
  const { orgSlug, matchId } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);

  const match = await db.match.findFirst({
    where: { id: matchId, ...ctx.orgFilter.filter },
    select: {
      id: true,
      opponent: true,
      homeAway: true,
      team: { select: { id: true, name: true } },
    },
  });

  if (!match) {
    return <div className="p-6 text-center text-zinc-400">Match not found.</div>;
  }

  try {
    await requireMatchGroupAccess(ctx, matchId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return (
        <div className="p-6 text-center text-zinc-400">
          You do not have access to follow this match live.
        </div>
      );
    }
    throw error;
  }

  const session = await db.liveMatchSession.findUnique({
    where: { matchId, ...ctx.orgFilter.filter },
    select: { id: true, status: true },
  });

  if (!session || session.status !== "ACTIVE") {
    return (
      <div className="p-6 text-center text-zinc-400">
        This match is not being reported live right now.
      </div>
    );
  }

  return (
    <FollowLiveClient
      matchId={match.id}
      teamName={match.team.name}
      opponentName={match.opponent}
      homeAway={match.homeAway}
    />
  );
}
