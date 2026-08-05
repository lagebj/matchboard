"use client";

import { TacticalSurface } from "@/components/ui/tactical-surface";
import { SectionHeader } from "@/components/ui/section-header";
import { InlineEditField } from "@/components/ui/inline-edit-field";
import { getPlayerAttributeAverages } from "@/lib/player-metrics";
import { RATING_SCALE_LABELS } from "@/lib/ratings/player-rating";

const RATING_LABELS: Record<string, string> = {
  ballControl: "Ball Control",
  passing: "Passing",
  firstTouch: "First Touch",
  oneVOneAttacking: "1v1 Att.",
  positioning: "Positioning",
  oneVOneDefending: "1v1 Def.",
  decisionMaking: "Decisions",
  effort: "Effort",
  teamplay: "Team Play",
  concentration: "Concentration",
  speed: "Speed",
  strength: "Strength",
};

type PlayerWithAttributes = {
  id: string;
  ballControl: number | null;
  passing: number | null;
  firstTouch: number | null;
  oneVOneAttacking: number | null;
  positioning: number | null;
  oneVOneDefending: number | null;
  decisionMaking: number | null;
  effort: number | null;
  teamplay: number | null;
  concentration: number | null;
  speed: number | null;
  strength: number | null;
};

const ATTRIBUTE_CATEGORIES = [
  { label: "Technical", keys: ["ballControl", "passing", "firstTouch", "oneVOneAttacking"] as const },
  { label: "Tactical", keys: ["positioning", "oneVOneDefending", "decisionMaking"] as const },
  { label: "Mental", keys: ["effort", "teamplay", "concentration"] as const },
  { label: "Physical", keys: ["speed", "strength"] as const },
];

type PlayerAttributesPanelProps = {
  player: PlayerWithAttributes;
  updateFieldAction: (playerId: string, field: string, value: string) => Promise<{ success: boolean; error?: string }>;
};

function formatAvg(val: number | null): string {
  if (val === null) return "—";
  return val.toFixed(1);
}

function formatRatingDisplay(value: string | number | null): string {
  if (value == null || value === "") return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (isNaN(num) || num < 1 || num > 10) return "—";
  const label = RATING_SCALE_LABELS[num];
  return label ? `${num} — ${label}` : `${num}`;
}

export function PlayerAttributesPanel({ player, updateFieldAction }: PlayerAttributesPanelProps) {
  const handleSave = (field: string) => async (value: string) => {
    const result = await updateFieldAction(player.id, field, value);
    if (!result.success) {
      throw new Error(result.error ?? "Save failed");
    }
  };

  const averages = getPlayerAttributeAverages(player);

  return (
    <TacticalSurface variant="default" padding="sm">
      <SectionHeader title="Attributes" />
      <div className="mt-1 flex flex-col gap-2">
        {ATTRIBUTE_CATEGORIES.map((cat) => {
          const catAvg = averages[cat.label.toLowerCase() as keyof ReturnType<typeof getPlayerAttributeAverages>];
          return (
            <div key={cat.label}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">{cat.label}</span>
                <span className="text-[10px] tabular-nums text-zinc-500">{formatAvg(catAvg as number | null)}</span>
              </div>
              <div className="flex flex-col gap-px">
                {cat.keys.map((key) => (
                  <div key={key} className="flex items-center justify-between gap-2 py-0.5">
                    <InlineEditField
                      label={RATING_LABELS[key]}
                      value={player[key]}
                      renderValue={formatRatingDisplay}
                      onSave={handleSave(key)}
                      inputType="number"
                      min={1}
                      max={10}
                      emptyLabel="—"
                      className="flex-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </TacticalSurface>
  );
}