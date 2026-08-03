import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { ConflictReviewClient } from "@/app/(app)/insights/conflicts/conflict-review-client";

export const dynamic = "force-dynamic";

export default async function ConflictReviewPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireActorContext(orgSlug);
  const orgWhere = ctx.orgFilter.type === "org" ? ctx.orgFilter.filter : {};

  const leagueSeasons = await db.leagueSeason.findMany({
    where: { ...orgWhere },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
    },
  });

  const activeLeagueSeason = leagueSeasons[0] ?? null;

  return (
    <ConflictReviewClient
      leagueSeasons={leagueSeasons.map((ls) => ({
        id: ls.id,
        name: ls.name,
        startDate: ls.startDate.toISOString(),
        endDate: ls.endDate.toISOString(),
      }))}
      activeLeagueSeasonId={activeLeagueSeason?.id ?? null}
    />
  );
}