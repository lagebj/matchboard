"use client";

import { useState } from "react";
import Link from "next/link";
import { TeamKitMark } from "@/components/touchline/identity/team-kit-mark";
import { KIT_COLOR_PALETTE, resolveKitColorSwatch, type KitColorId } from "@/lib/teams/kit-color";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/atlas-followup/team-kit-colour` — Phase F1 fixture
 * (`10_IMPLEMENTATION_SEQUENCE_AND_HUMAN_GATES.md`, `01_GOLDEN_REFERENCE_INDEX...md §2 Step B`).
 * Team settings (`NORMAL` gate per `data/surface-conformance-matrix.csv`, not golden-sensitive)
 * already ships the same `TeamKitMark`/`KIT_COLOR_PALETTE` primitives live on
 * `/o/{orgSlug}/teams/[teamId]/configuration` — this fixture exists to exercise the shared
 * primitive at every size in isolation, per the bundle's "build in UI Lab first" requirement.
 */
export default function TeamKitColourFixturePage() {
  const [selected, setSelected] = useState<KitColorId | null>("BLUE");
  const swatch = resolveKitColorSwatch(selected);

  return (
    <div className="touchline mx-auto max-w-[720px] px-6 py-10">
      <Link href="/dev/ui-lab/atlas-followup" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Atlas Follow-up
      </Link>
      <h1 className="mt-2 text-[24px] font-[650] text-[var(--foreground)]">Team Kit Colour</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        One canonical shirt geometry (`TeamKitMark`), dynamic fill, automatic readable number
        colour. No per-colour image assets, no badge upload.
      </p>

      <div className="mt-6">
        <AppearanceControl />
      </div>

      <section className="mt-8 flex flex-col gap-4">
        <h2 className="text-[13px] font-semibold text-[var(--foreground)]">Preset swatch palette</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Kit colour">
          {KIT_COLOR_PALETTE.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(selected === s.id ? null : s.id)}
              aria-pressed={selected === s.id}
              className="h-7 w-7 rounded-full ring-1 ring-[var(--border-soft)] hover:scale-110 transition-transform"
              style={{
                backgroundColor: s.hex,
                boxShadow: selected === s.id ? "0 0 0 2px var(--surface-base), 0 0 0 4px var(--accent)" : undefined,
              }}
              title={s.label}
            />
          ))}
        </div>
        <div className="flex items-center gap-4">
          <TeamKitMark color={swatch?.hex ?? null} number={9} size="hero" ariaLabel={swatch ? `${swatch.label} shirt, number 9` : "Neutral shirt"} />
          <div className="text-[13px] text-[var(--text-soft)]">
            <p className="font-semibold text-[var(--foreground)]">{swatch?.label ?? "Neutral (unset)"}</p>
            <p className="text-[12px] text-[var(--text-muted)]">Number shown when a shirt number is known.</p>
          </div>
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-[13px] font-semibold text-[var(--foreground)]">Sizes</h2>
        <div className="flex items-end gap-6">
          {(["xs", "sm", "md", "lg", "hero"] as const).map((size) => (
            <div key={size} className="flex flex-col items-center gap-1">
              <TeamKitMark color={swatch?.hex ?? null} number={7} size={size} />
              <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{size}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-[13px] font-semibold text-[var(--foreground)]">States</h2>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <TeamKitMark color={swatch?.hex ?? null} number={10} size="lg" />
            <span className="text-[10px] text-[var(--text-muted)]">normal</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <TeamKitMark color={swatch?.hex ?? null} number={10} size="lg" selected />
            <span className="text-[10px] text-[var(--text-muted)]">selected</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <TeamKitMark color={swatch?.hex ?? null} number={10} size="lg" muted />
            <span className="text-[10px] text-[var(--text-muted)]">muted</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <TeamKitMark color={null} number={null} size="lg" />
            <span className="text-[10px] text-[var(--text-muted)]">neutral/unset</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <TeamKitMark color={null} number={4} size="lg" />
            <span className="text-[10px] text-[var(--text-muted)]">no colour, number known</span>
          </div>
        </div>
      </section>
    </div>
  );
}
