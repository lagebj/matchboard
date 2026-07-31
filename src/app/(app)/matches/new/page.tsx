import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { MatchCreateForm } from "@/components/matches/match-create-form";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { PageHeader } from "@/components/ui/page-header";

export default async function NewMatchPage() {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");

  const [teams, opponentTeams] = await Promise.all([
    db.team.findMany({
      where: { archivedAt: null, ...(orgFilter.type === "org" ? orgFilter.filter : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.opponentTeam.findMany({
      where: { archivedAt: null, ...(orgFilter.type === "org" ? orgFilter.filter : {}) },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
  ]);

  if (teams.length === 0) {
    return (
      <main className="flex min-h-full flex-col gap-6 text-foreground">
        <PageHeader title="Create match" />
        <DecisionBanner
          variant="decision"
          title="Create at least one team before adding matches."
          action={
            <Button variant="primary" size="sm" as="a" href="/teams/new">
              Create a team
            </Button>
          }
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-full flex-col gap-6 text-foreground">
      <PageHeader
        title="Create match"
        description="Register match details. Matches are assigned to rounds by date."
      />

      <Surface variant="default" padding="lg">
        <MatchCreateForm teams={teams} opponentTeams={opponentTeams} />
      </Surface>
    </main>
  );
}