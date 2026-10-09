"use client";

import Link from "next/link";
import { useState } from "react";
import { AppearanceControl } from "@/components/touchline";
import { TouchlinePositionMap } from "@/components/touchline/pitch/touchline-position-map";
import { FlatProfilePositionMap } from "./flat-profile-position-map";
import { exactTacticalEvidence, profileEvidence } from "./fixtures";
import type { ProfilePosition } from "../shared/profile-position-model";

/**
 * `/dev/ui-lab/gate-a/a06-position-pitches` — A06 candidate: the real, shipped, perspective
 * `TouchlinePositionMap` (canonical 24-code tactical vocabulary, 5×6 grid, ADR-0154) side by side
 * with a new isolated flat 3×6 profile analysis map candidate (14-role vocabulary). Same
 * underlying evidence, same visual dot language — the only intended difference is projection
 * (perspective vs flat) and vocabulary (24-code exact vs 14-role profile).
 */
export default function A06PositionPitchesPage() {
  const [selectedExact, setSelectedExact] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ProfilePosition | null>(null);

  return (
    <div className="touchline mx-auto flex max-w-[720px] flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/dev/ui-lab/gate-a" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate A candidates
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A06 — Tactical vs profile pitch pairing</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Left: real production <code>TouchlinePositionMap</code> (24-code exact, perspective).
          Right: isolated flat 3×6 profile candidate (14-role, no shirts, orthogonal grid). No dot
          exists where there is no evidence in either panel.
        </p>
      </div>

      <AppearanceControl />

      <div className="grid gap-6 medium:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Tactical — 24-code exact (production)
          </p>
          <TouchlinePositionMap
            positions={exactTacticalEvidence}
            selectedPositionCode={selectedExact}
            onSelectPosition={(code) => setSelectedExact(selectedExact === code ? null : code)}
          />
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Profile — 14-role flat 3×6 (candidate)
          </p>
          <FlatProfilePositionMap
            entries={profileEvidence}
            selectedPosition={selectedProfile}
            onSelectPosition={(p) => setSelectedProfile(selectedProfile === p ? null : p)}
          />
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-3 text-[11px] text-[var(--text-muted)]">
        <p>LW and RW stay their own sided profile labels — never collapsed into a single unsided &ldquo;W&rdquo;.</p>
        <p>CB has no dot here in either panel — no evidence exists for it in this fixture.</p>
      </div>
    </div>
  );
}
