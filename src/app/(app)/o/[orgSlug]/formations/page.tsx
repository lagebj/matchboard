export const dynamic = "force-dynamic";

import Link from "next/link";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { getFormationsForFormat } from "@/app/(app)/rules/formation-actions";
import { formatGameFormatShort } from "@/lib/formations/types";
import type { GameFormat } from "@/generated/prisma/client";
import { Surface } from "@/components/ui/surface";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { TouchlineButton, TouchlinePageHeader } from "@/components/touchline";

const GAME_FORMATS: GameFormat[] = ["THREE_A_SIDE", "FIVE_A_SIDE", "SEVEN_A_SIDE", "NINE_A_SIDE", "ELEVEN_A_SIDE"];

type FormationsPageProps = {
  searchParams: Promise<{
    gameFormat?: string;
  }>;
};

export default async function FormationsPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: FormationsPageProps["searchParams"] }) {
  const { orgSlug } = await params;
  await requirePageActorContext(orgSlug);
  const { gameFormat } = await searchParams;
  const selectedFormat = (GAME_FORMATS.includes(gameFormat as GameFormat) ? gameFormat : "SEVEN_A_SIDE") as GameFormat;

  const formations = await getFormationsForFormat(selectedFormat);

  return (
    // Touchline island (theme-aware — Phase 10 preparatory pass, ADR-0134).
    <div className="touchline flex flex-col gap-4">
      <TouchlinePageHeader
        title="Formations"
        context="Manage system and custom formations for each game format."
        actions={
          <TouchlineButton variant="primary" size="sm" as="a" href={`/o/${orgSlug}/formations/new?gameFormat=${selectedFormat}`}>
            Create formation
          </TouchlineButton>
        }
      />

      <div className="flex items-center gap-1.5 flex-wrap">
        {GAME_FORMATS.map((gf) => (
          <Link
            key={gf}
            href={`/o/${orgSlug}/formations?gameFormat=${gf}`}
            className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
              gf === selectedFormat
                ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent-strong)]"
                : "border-[var(--border-soft)] bg-[var(--surface-base)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
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
            <TouchlineButton variant="primary" size="sm" as="a" href={`/o/${orgSlug}/formations/new?gameFormat=${selectedFormat}`}>
              Create formation
            </TouchlineButton>
          }
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {formations.map((formation) => (
            <Surface key={formation.id} variant="default" padding="sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-[var(--foreground)] truncate">{formation.name}</span>
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
                  <TouchlineButton variant="ghost" size="sm" as="a" href={`/o/${orgSlug}/formations/${formation.id}/edit`}>
                    Edit
                  </TouchlineButton>
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
      <TouchlineButton variant="ghost" size="sm" type="submit">Duplicate</TouchlineButton>
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
      <TouchlineButton variant="ghost" size="sm" type="submit" className="text-[var(--danger)] hover:text-[var(--danger)]">Archive</TouchlineButton>
    </form>
  );
}