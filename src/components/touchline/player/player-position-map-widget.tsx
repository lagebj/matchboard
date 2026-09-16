"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { TouchlinePositionMap, type TouchlinePositionMapEntry } from "@/components/touchline/pitch/touchline-position-map";

/**
 * `PlayerPositionMapWidget` (Atlas Follow-up, `04_PLAYER_DETAIL_CONTRACT.md §4`,
 * `06_CANONICAL_PITCH_RENDERING_CONTRACT.md`; `layout="compact"` added by the Players Operating
 * Surface visual-convergence follow-up, §14). Thin widget wrapper around the one canonical
 * `TouchlinePositionMap` — this component owns no position-evidence logic of its own (contract
 * `08_...md §6`); `layout` only changes surrounding composition, never pitch markings, evidence-
 * dot coordinates, confidence, or support-band semantics.
 *
 * `layout="default"` (Player Detail): full-width pitch, its own card frame/header, vertical
 * position list below.
 *
 * `layout="compact"` (Players Overview inspector): no outer card/header of its own — the caller
 * (e.g. `PlayerInspector`) supplies the section heading as part of one cohesive surface — a
 * fixed-width pitch beside a compact position list, sized to sit inside an inspector rail.
 */
export type PlayerPositionMapWidgetProps = {
  positions: TouchlinePositionMapEntry[];
  layout?: "default" | "compact";
  className?: string;
};

function rankLabel(rank: TouchlinePositionMapEntry["rank"]): string {
  return rank === 1 ? "Primary" : rank === 2 ? "Secondary" : rank === 3 ? "Tertiary" : "—";
}

export function PlayerPositionMapWidget({ positions, layout = "default", className }: PlayerPositionMapWidgetProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedEntry = positions.find((p) => p.positionCode === selected) ?? null;

  if (layout === "compact") {
    return (
      <div className={cn("flex items-start gap-3", className)}>
        <TouchlinePositionMap
          positions={positions}
          selectedPositionCode={selected}
          onSelectPosition={(code) => setSelected(selected === code ? null : code)}
          className="w-[150px] shrink-0"
        />
        <div className="min-w-0 flex-1">
          <ul className="flex flex-col gap-1">
            {positions.map((p) => (
              <li key={p.positionCode} className="flex items-start justify-between gap-2 text-[12px]">
                <span className="text-[var(--text-soft)]">{p.positionLabel}</span>
                <span className="shrink-0 text-[var(--text-muted)]">{rankLabel(p.rank)}</span>
              </li>
            ))}
            {positions.length === 0 ? (
              <li className="text-[12px] text-[var(--text-muted)]">No position evidence recorded yet.</li>
            ) : null}
          </ul>
          {selectedEntry ? (
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
              {selectedEntry.positionLabel}: {selectedEntry.supportBand.toLowerCase()} support, {selectedEntry.confidence.toLowerCase()} confidence.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

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
            <span className="text-[var(--text-muted)]">{rankLabel(p.rank)}</span>
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
