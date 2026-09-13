"use client";

import { TouchlinePositionMap } from "@/components/touchline/pitch/touchline-position-map";
import { InlineEditSelect } from "@/components/ui/inline-edit-select";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { exactPositionLabel } from "@/lib/touchline/presentation/exact-position-labels";

type PlayerWithPositions = {
  id: string;
  primaryPosition: string | null;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
};

type SelectOption = { label: string; value: string };

type PlayerPositionProfileProps = {
  player: PlayerWithPositions;
  positionOptions: ReadonlyArray<SelectOption>;
  optionalPositionOptions: ReadonlyArray<SelectOption>;
  updateFieldAction: (playerId: string, field: string, value: string) => Promise<{ success: boolean; error?: string }>;
};

/**
 * Declared-position editing on Player Detail's Manage tab (Atlas Follow-up Phase F8). The
 * visual is the one canonical `TouchlinePositionMap` — the same renderer the Overview tab's
 * position-exposure widget uses — rendering the declared triple as its three rank entries.
 * The old pre-Followup horizontal `src/components/ui/position-map.tsx` `PositionMap` was
 * removed once this became its last consumer.
 */
export function PlayerPositionProfile({ player, positionOptions, optionalPositionOptions, updateFieldAction }: PlayerPositionProfileProps) {
  const handleSave = (field: string) => async (value: string) => {
    await updateFieldAction(player.id, field, value);
  };

  const entries = [player.primaryPosition, player.secondaryPosition, player.tertiaryPosition]
    .map((position, index) => ({ position, rank: index + 1 }))
    .filter((entry): entry is { position: string; rank: 1 | 2 | 3 } => entry.position != null)
    .map((entry) => ({
      positionCode: entry.position,
      positionLabel: exactPositionLabel(entry.position),
      rank: entry.rank,
      // The declared triple is coach-stated truth — rendered with the strongest support band,
      // distinct from the evidence-derived bands the Overview map shows.
      supportBand: "STRONGEST" as const,
      confidence: "HIGH" as const,
    }));

  return (
    <TouchlineWidget>
      <WidgetHeader eyebrow="Positions" title="Declared positions" />
      <div className="mt-3">
        <TouchlinePositionMap positions={entries} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
        <InlineEditSelect
          label="Position"
          value={player.primaryPosition}
          options={positionOptions}
          onSave={handleSave("primaryPosition")}
        />
        <InlineEditSelect
          label="2nd"
          value={player.secondaryPosition ?? ""}
          options={optionalPositionOptions}
          onSave={handleSave("secondaryPosition")}
        />
        <InlineEditSelect
          label="3rd"
          value={player.tertiaryPosition ?? ""}
          options={optionalPositionOptions}
          onSave={handleSave("tertiaryPosition")}
        />
      </div>
      <p className="mt-2 text-center text-[11px] text-[var(--text-muted)]">
        Coach declaration. The Overview tab shows how declared positions and recorded match evidence combine.
      </p>
    </TouchlineWidget>
  );
}