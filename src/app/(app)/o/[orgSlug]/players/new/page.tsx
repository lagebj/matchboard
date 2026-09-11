export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { createPlayerAction } from "@/app/(app)/players/actions";
import { PlayerEditorForm } from "@/components/players/player-editor-form";
import { Surface } from "@/components/ui/surface";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { TouchlineButton, TouchlinePageHeader } from "@/components/touchline";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export default async function NewPlayerPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);

  const teams = await db.team.findMany({
    where: { archivedAt: null, ...ctx.orgFilter.filter },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (teams.length === 0) {
    return (
      // Touchline island (dark-pinned during the phased migration — ADR-0134 Phase 8).
      <main className="touchline flex min-h-full flex-col gap-6" data-theme="dark">
        <TouchlinePageHeader title="Create player" />
        <DecisionBanner
          variant="decision"
          title="Create at least one team before adding players."
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
    // Touchline island (dark-pinned during the phased migration — ADR-0134 Phase 8).
    <main className="touchline flex min-h-full flex-col gap-6" data-theme="dark">
      <TouchlinePageHeader
        title="Create player"
        context="Add a player to the registry. The player code is generated automatically."
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