import { useState } from "react";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { TouchlinePositionMap, type TouchlinePositionMapEntry } from "@/components/touchline/pitch/touchline-position-map";

/**
 * `PlayerPositionMapWidget` (Atlas Follow-up, `04_PLAYER_DETAIL_CONTRACT.md §4`,
 * `06_CANONICAL_PITCH_RENDERING_CONTRACT.md`). Thin widget wrapper around the one canonical
 * `TouchlinePositionMap` — this component owns no position-evidence logic of its own (contract
 * `08_...md §6`).
 */
export type PlayerPositionMapWidgetProps = {
  positions: TouchlinePositionMapEntry[];
  className?: string;
};

export function PlayerPositionMapWidget({ positions, className }: PlayerPositionMapWidgetProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedEntry = positions.find((p) => p.positionCode === selected) ?? null;

  return (
    <TouchlineWidget className={className}>
      <WidgetHeader eyebrow="Position exposure" title="Effective position profile" />
      <div className="mt-3">
        <TouchlinePositionMap
          positions={positions}
          selectedPositionCode={selected}
          onSelectPosition={(code) => setSelected(selected === code ? null : code)}
        />
      </div>
      <ul className="mt-3 flex flex-col gap-1">
        {positions.map((p) => (
          <li key={p.positionCode} className="flex items-center justify-between text-[12px]">
            <span className="text-[var(--text-soft)]">{p.positionLabel}</span>
            <span className="text-[var(--text-muted)]">{p.rank === 1 ? "Primary" : p.rank === 2 ? "Secondary" : p.rank === 3 ? "Tertiary" : "—"}</span>
          </li>
        ))}
        {positions.length === 0 ? <li className="text-[12px] text-[var(--text-muted)]">No position evidence recorded yet.</li> : null}
      </ul>
      {selectedEntry ? (
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">
          {selectedEntry.positionLabel}: {selectedEntry.supportBand.toLowerCase()} support, {selectedEntry.confidence.toLowerCase()} confidence.
        </p>
      ) : null}
    </TouchlineWidget>
  );
}
