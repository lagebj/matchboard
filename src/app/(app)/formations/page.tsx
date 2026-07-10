export const dynamic = "force-dynamic";

import Link from "next/link";
import { getFormationsForFormat } from "@/app/(app)/rules/formation-actions";
import { formatGameFormatShort } from "@/lib/formations/types";
import type { GameFormat } from "@/generated/prisma/client";
import { Surface } from "@/components/ui/surface";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

const GAME_FORMATS: GameFormat[] = ["THREE_A_SIDE", "FIVE_A_SIDE", "SEVEN_A_SIDE", "NINE_A_SIDE", "ELEVEN_A_SIDE"];

type FormationsPageProps = {
  searchParams: Promise<{
    gameFormat?: string;
  }>;
};

export default async function FormationsPage({ searchParams }: FormationsPageProps) {
  const { gameFormat } = await searchParams;
  const selectedFormat = (GAME_FORMATS.includes(gameFormat as GameFormat) ? gameFormat : "SEVEN_A_SIDE") as GameFormat;

  const formations = await getFormationsForFormat(selectedFormat);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Formations"
        description="Manage system and custom formations for each game format."
        actions={
          <Button variant="primary" size="sm" as="a" href={`/formations/new?gameFormat=${selectedFormat}`}>
            Create formation
          </Button>
        }
      />

      <div className="flex items-center gap-1.5 flex-wrap">
        {GAME_FORMATS.map((gf) => (
          <Link
            key={gf}
            href={`/formations?gameFormat=${gf}`}
            className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
              gf === selectedFormat
                ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent-strong)]"
                : "border-[var(--border-soft)] bg-[var(--surface-base)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-zinc-50"
            }`}
          >
            {formatGameFormatShort(gf)}
          </Link>
        ))}
      </div>

      {formations.length === 0 ? (
        <EmptyState
          title="No formations for this format"
          description={`Create a ${formatGameFormatShort(selectedFormat)} formation to define pitch positions and roles.`}
          illustration="emptyLineup"
          action={
            <Button variant="primary" size="sm" as="a" href={`/formations/new?gameFormat=${selectedFormat}`}>
              Create formation
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {formations.map((formation) => (
            <Surface key={formation.id} variant="default" padding="sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-zinc-200 truncate">{formation.name}</span>
                    <StatusPill variant={formation.source === "SYSTEM" ? "info" : "neutral"} size="sm">
                      {formation.source === "SYSTEM" ? "System" : "Custom"}
                    </StatusPill>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {formatGameFormatShort(formation.gameFormat)} · {formation.slots.length} slots
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-2">
                {formation.source === "CUSTOM" && (
                  <Button variant="ghost" size="sm" as="a" href={`/formations/${formation.id}/edit`}>
                    Edit
                  </Button>
                )}
                <FormationsDuplicateButton formationId={formation.id} />
                {formation.source === "CUSTOM" && (
                  <FormationsArchiveButton formationId={formation.id} />
                )}
              </div>
            </Surface>
          ))}
        </div>
      )}
    </div>
  );
}

function FormationsDuplicateButton({ formationId }: { formationId: string }) {
  return (
    <form action={async () => {
      "use server";
      const { duplicateFormation } = await import("@/app/(app)/rules/formation-actions");
      await duplicateFormation(formationId);
    }}>
      <Button variant="ghost" size="sm" type="submit">Duplicate</Button>
    </form>
  );
}

function FormationsArchiveButton({ formationId }: { formationId: string }) {
  return (
    <form action={async () => {
      "use server";
      const { archiveFormation } = await import("@/app/(app)/rules/formation-actions");
      await archiveFormation(formationId);
    }}>
      <Button variant="ghost" size="sm" type="submit" className="text-[var(--danger)] hover:text-[var(--danger)]">Archive</Button>
    </form>
  );
}