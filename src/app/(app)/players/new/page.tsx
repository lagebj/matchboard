export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { createPlayerAction } from "@/app/(app)/players/actions";
import { PlayerEditorForm } from "@/components/players/player-editor-form";
import { Surface } from "@/components/ui/surface";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export default async function NewPlayerPage() {
  const ctx = await requireActorContext();

  const teams = await db.team.findMany({
    where: { archivedAt: null, ...(ctx.orgFilter.type === "org" ? ctx.orgFilter.filter : {}) },
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
        title="Create player"
        description="Add a player to the registry. The player code is generated automatically."
      />

      <Surface variant="default" padding="lg">
        <PlayerEditorForm
          action={createPlayerAction}
          cancelHref="/players"
          submitLabel="Create player"
          teams={teams}
        />
      </Surface>
    </main>
  );
}