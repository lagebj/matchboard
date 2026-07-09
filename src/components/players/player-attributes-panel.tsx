"use client";

import { TacticalSurface } from "@/components/ui/tactical-surface";
import { SectionHeader } from "@/components/ui/section-header";
import { InlineEditSelect } from "@/components/ui/inline-edit-select";
import { getPlayerAttributeAverages } from "@/lib/player-metrics";

const RATING_OPTIONS = [
  { label: "—", value: "" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
];

const RATING_LABELS: Record<string, string> = {
  ballControl: "Ball Control",
  passing: "Passing",
  firstTouch: "First Touch",
  oneVOneAttacking: "1v1 Attacking",
  positioning: "Positioning",
  oneVOneDefending: "1v1 Defending",
  decisionMaking: "Decision Making",
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

export function PlayerAttributesPanel({ player, updateFieldAction }: PlayerAttributesPanelProps) {
  const handleSave = (field: string) => async (value: string) => {
    await updateFieldAction(player.id, field, value);
  };

  const averages = getPlayerAttributeAverages(player);

  return (
    <TacticalSurface variant="default" padding="md">
      <SectionHeader title="Attributes" />
      <div className="mt-2 flex flex-col gap-3">
        {ATTRIBUTE_CATEGORIES.map((cat) => {
          const catAvg = averages[cat.label.toLowerCase() as keyof ReturnType<typeof getPlayerAttributeAverages>];
          return (
            <div key={cat.label}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{cat.label}</p>
                <span className="text-xs tabular-nums text-zinc-400">{formatAvg(catAvg as number | null)}</span>
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {cat.keys.map((key) => (
                    <tr key={key} className="border-b border-[var(--border-soft)]/30 last:border-0">
                      <td className="py-1 pr-2 text-zinc-300 font-medium whitespace-nowrap w-1/3">
                        {RATING_LABELS[key]}
                      </td>
                      <td className="py-1">
                        <InlineEditSelect
                          label={RATING_LABELS[key]}
                          value={player[key] != null ? String(player[key]) : ""}
                          options={RATING_OPTIONS}
                          onSave={handleSave(key)}
                          emptyLabel="Not rated"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </TacticalSurface>
  );
}