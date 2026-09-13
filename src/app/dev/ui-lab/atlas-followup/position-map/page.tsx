"use client";

import Link from "next/link";
import { useState } from "react";
import { TouchlinePositionMap } from "@/components/touchline/pitch/touchline-position-map";
import { AppearanceControl } from "@/components/touchline";
import { positionMapEntries } from "../fixtures";

/**
 * `/dev/ui-lab/atlas-followup/position-map` — Phase F2 fixture, Hard Human Gate A.
 * Reference target: `05-followup-pitch-position-system.png` (supersedes the position-exposure
 * pitch shown in `02-player-detail-original-golden.png`, per `01_GOLDEN_REFERENCE_INDEX...md`).
 * Static fixture data only — see `../fixtures.ts`.
 */
export default function PositionMapFixturePage() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="touchline mx-auto flex max-w-[420px] flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/dev/ui-lab/atlas-followup" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Atlas Follow-up
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">Player Detail position map</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          TouchlinePositionMap — same pitch graphic as the planning pitch, GK bottom / attack top,
          green evidence dots only (no shirts).
        </p>
      </div>

      <AppearanceControl />

      <TouchlinePositionMap
        positions={positionMapEntries}
        selectedPositionCode={selected}
        onSelectPosition={(code) => setSelected(selected === code ? null : code)}
      />

      {selected ? (
        <p className="text-[12px] text-[var(--text-soft)]">
          Selected: {positionMapEntries.find((p) => p.positionCode === selected)?.positionLabel}
        </p>
      ) : null}

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-3 text-[11px] text-[var(--text-muted)]">
        <p>LW: primary, strongest support, high confidence (solid outline).</p>
        <p>LM: secondary, strong support, medium confidence.</p>
        <p>ST: no rank, limited support, low confidence (dashed outline, smaller/fainter dot).</p>
        <p>No dot exists for any position not in this list — e.g. CB has no legitimate evidence here.</p>
      </div>
    </div>
  );
}
