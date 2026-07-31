import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { PolicyWarningReviewClient } from "./policy-warning-review-client";

export const dynamic = "force-dynamic";

export default async function PolicyWarningReviewPage() {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");
  const orgWhere = orgFilter.type === "org" ? orgFilter.filter : {};

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
    <PolicyWarningReviewClient
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