import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { MatchCreateForm } from "@/components/matches/match-create-form";
import { Surface } from "@/components/ui/surface";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { TouchlineButton, TouchlinePageHeader } from "@/components/touchline";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export default async function NewMatchPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);

  const [teams, opponentTeams] = await Promise.all([
    db.team.findMany({
      where: { archivedAt: null, ...ctx.orgFilter.filter },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.opponentTeam.findMany({
      where: { archivedAt: null, ...ctx.orgFilter.filter },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
  ]);

  if (teams.length === 0) {
    return (
      // Touchline island (theme-aware — Phase 10 preparatory pass, ADR-0134).
      <main className="touchline flex min-h-full flex-col gap-6 text-foreground">
        <TouchlinePageHeader title="Create match" />
        <DecisionBanner
          variant="decision"
          title="Create at least one team before adding matches."
          action={
            <TouchlineButton variant="primary" size="sm" as="a" href={`/o/${orgSlug}/teams/new`}>
              Create a team
            </TouchlineButton>
          }
        />
      </main>
    );
  }

  return (
    <main className="touchline flex min-h-full flex-col gap-6 text-foreground">
      <TouchlinePageHeader
        title="Create match"
        context="Register match details. Matches are assigned to rounds by date."
      />

      <Surface variant="default" padding="lg">
        <MatchCreateForm teams={teams} opponentTeams={opponentTeams} />
      </Surface>
    </main>
  );
}