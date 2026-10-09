"use client";

import Link from "next/link";
import { useState } from "react";
import { AppearanceControl } from "@/components/touchline";
import { CandidateTacticalPositionMap } from "./candidate-tactical-position-map";
import { FlatProfilePositionMap } from "./flat-profile-position-map";
import { exactTacticalEvidence, profileEvidence } from "./fixtures";
import type { ProfilePosition } from "../shared/profile-position-model";

/**
 * `/dev/ui-lab/gate-a/a06-position-pitches` — A06 candidate: the proposed 24-code tactical
 * presentation (perspective, canonical vocabulary, ADR-0154) side by side with the isolated flat
 * 3×6 profile analysis map candidate (14-role vocabulary). Same underlying evidence, same visual
 * dot language — the only intended difference is projection (perspective vs flat) and vocabulary
 * (24-code exact vs 14-role profile).
 *
 * Owner visual feedback (2026-10-09): the left panel now renders through
 * `CandidateTacticalPositionMap`, NOT the real production `TouchlinePositionMap` — it shows the
 * *proposed* 24-point presentation (LW/RW on the attacking-midfield line, matching the 14-point
 * profile view), not the unmodified production coordinate placement (production still shows
 * LW/RW on the attack line; see `/dev/ui-lab/atlas-followup/position-map` for that unmodified
 * view). This is a presentation-only candidate choice — see `candidate-position-grid.ts` — it does
 * not change canonical formation-cell eligibility, `primaryDisplayCellFor`, or persistence.
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
          Left: <code>CandidateTacticalPositionMap</code> — the proposed 24-code exact presentation
          (perspective, canonical vocabulary; LW/RW on the attacking-midfield line per owner
          feedback), not the unmodified production <code>TouchlinePositionMap</code>. Right:
          isolated flat 3×6 profile candidate (14-role, no shirts, orthogonal grid) — the same
          evidence collapsed through the real 24→14 mapping. No dot exists where there is no
          evidence in either panel.
        </p>
      </div>

      <AppearanceControl />

      <div className="grid gap-6 medium:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Tactical — 24-code exact (proposed presentation)
          </p>
          <p className="mb-2 text-[11px] text-[var(--text-muted)]" data-testid="a06-presentation-disclosure">
            Candidate presentation, not the unmodified production coordinate placement: LW/RW
            display on the attacking-midfield line, per owner feedback. Production&rsquo;s
            <code> TouchlinePositionMap</code> (unchanged, see the atlas-followup position-map
            route) still shows LW/RW on the attack line.
          </p>
          <CandidateTacticalPositionMap
            positions={exactTacticalEvidence}
            selectedPositionCode={selectedExact}
            onSelectPosition={(code) => setSelectedExact(selectedExact === code ? null : code)}
          />
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Profile — 14-role flat 3×6 (candidate)
          </p>
          <p className="mb-2 text-[11px] text-[var(--text-muted)]" data-testid="a06-illustrative-disclosure">
            The 5 consolidated dots (CB/DM/CM/AM/F) show an illustrative placeholder value, not a
            computed aggregate — no approved rule exists yet for combining 3 sided positions&rsquo;
            support/confidence into one. See the tactical panel for the real per-code evidence.
          </p>
          <FlatProfilePositionMap
            entries={profileEvidence}
            selectedPosition={selectedProfile}
            onSelectPosition={(p) => setSelectedProfile(selectedProfile === p ? null : p)}
          />
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-3 text-[11px] text-[var(--text-muted)]">
        <p>LW and RW now display on the attacking-midfield line (candidate presentation), alongside LAM/CAM/RAM — never collapsed into a single unsided &ldquo;W&rdquo;, and still their own distinct sided codes.</p>
        <p>GK and the central forward (CF) stay central at every line — GK alone at the goalkeeper line, CF alone (with LCF/RCF distinct beside it) at the attack line.</p>
        <p>LB/LWB and RB/RWB each have their own evidence and their own grid cell — distinct, simultaneously visible, and independently selectable (PR #777 remediation; previously these shared a cell).</p>
        <p>Five centre-line groups collapse to one profile dot each — the <em>position</em> mapping is approved and real: LCB/CB/RCB → CB, LDM/CDM/RDM → DM, LCM/CM/RCM → CM, LAM/CAM/RAM → AM, LCF/CF/RCF → F. Each dot&rsquo;s support/confidence value, however, is an illustrative placeholder (see above) — not derived from its three source codes.</p>
      </div>
    </div>
  );
}
