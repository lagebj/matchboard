export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { createPlayerAction } from "@/app/(app)/players/actions";
import { PlayerEditorForm } from "@/components/players/player-editor-form";
import { Surface } from "@/components/ui/surface";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export default async function NewPlayerPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);

  const teams = await db.team.findMany({
    where: { archivedAt: null, ...ctx.orgFilter.filter },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (teams.length === 0) {
    return (
      <main className="flex min-h-full flex-col gap-6 text-foreground">
        <PageHeader title="Create player" />
        <DecisionBanner
          variant="decision"
          title="Create at least one team before adding players."
          action={
            <Button variant="primary" size="sm" as="a" href={`/o/${orgSlug}/teams/new`}>
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
        title="Create player"
        description="Add a player to the registry. The player code is generated automatically."
      />

      <Surface variant="default" padding="lg">
        <PlayerEditorForm
          action={createPlayerAction}
          cancelHref={`/o/${orgSlug}/players`}
          submitLabel="Create player"
          teams={teams}
        />
      </Surface>
    </main>
  );
}