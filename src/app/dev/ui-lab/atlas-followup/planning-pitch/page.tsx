"use client";

import Link from "next/link";
import { useState } from "react";
import { TouchlinePlanningPitch } from "@/components/touchline/pitch/touchline-planning-pitch";
import { AppearanceControl } from "@/components/touchline";
import { planningPitchSlots, planningPitchAssignments } from "../fixtures";

/**
 * `/dev/ui-lab/atlas-followup/planning-pitch` — Phase F2 fixture, Hard Human Gate A.
 * Reference targets: `03-lineup-vertical-pitch-golden.png`, `05-followup-pitch-position-system.png`.
 * Static fixture data only (no domain data wired) — see `../fixtures.ts`.
 */
export default function PlanningPitchFixturePage() {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  return (
    <div className="touchline mx-auto flex max-w-[520px] flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/dev/ui-lab/atlas-followup" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Atlas Follow-up
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">Planning pitch</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          TouchlinePlanningPitch — GK bottom, attack top, subtle perspective, shirt tokens.
        </p>
      </div>

      <AppearanceControl />

      <TouchlinePlanningPitch
        slots={planningPitchSlots}
        assignments={planningPitchAssignments}
        onSlotClick={(slotId) => setSelectedSlot(slotId)}
      />

      {selectedSlot ? (
        <p className="text-[12px] text-[var(--text-soft)]">Selected slot: {selectedSlot}</p>
      ) : null}

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-3 text-[11px] text-[var(--text-muted)]">
        <p>One unassigned slot (RW) exercises the empty-slot state.</p>
        <p>Emil (CM) is selected; Sander (CM) is locked; Henrik (ST) shows an attention marker.</p>
      </div>
    </div>
  );
}
