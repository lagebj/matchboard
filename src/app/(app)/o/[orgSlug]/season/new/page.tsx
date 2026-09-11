import { requirePageActorContext } from "@/lib/auth/actor-context";
import { getFootballGroupsAction } from "@/app/(app)/season/create-league-season-action";
import { createLeagueSeasonAction } from "@/app/(app)/season/create-league-season-action";
import { Surface } from "@/components/ui/surface";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { TouchlinePageHeader } from "@/components/touchline";
import { CreateLeagueSeasonForm } from "./create-league-season-form";

type NewLeagueSeasonPageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function NewLeagueSeasonPage({ params, searchParams }: NewLeagueSeasonPageProps) {
  const { orgSlug } = await params;
  await requirePageActorContext(orgSlug);
  const { error } = await searchParams;
  const groups = await getFootballGroupsAction();

  return (
    // Touchline island (theme-aware, no longer dark-pinned — ADR-0134 Phase 8).
    <main className="touchline flex min-h-full flex-col gap-8">
      <TouchlinePageHeader
        title="Create league season"
        context="Set up a new league season for squad planning. Matches are grouped into rounds within a league season."
      />

      <Surface variant="default" padding="lg">
        {error && <DecisionBanner variant="blocked" title={error} />}
        <CreateLeagueSeasonForm
          action={createLeagueSeasonAction}
          groups={groups}
          orgSlug={orgSlug}
        />
      </Surface>
    </main>
  );
}