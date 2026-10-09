"use client";

import Link from "next/link";
import { useState } from "react";
import { AppearanceControl } from "@/components/touchline";
import { ProfilePositionTripleEditor } from "./profile-position-triple-editor";
import { LegacyEvidenceDrilldown } from "./legacy-evidence-drilldown";
import { initialDeclaredTriple, profileEvidenceAggregates, legacyForwardConsolidationPreview } from "./fixtures";
import type { ProfilePositionTriple } from "./profile-triple-selection";
import type { ProfilePosition } from "../shared/profile-position-model";

/**
 * `/dev/ui-lab/gate-a/a12-profile-editor` — A12 candidate (PR #777 remediation): the full
 * primary/secondary/tertiary declared-profile editor (14-role vocabulary), next to the real exact
 * match evidence that backs each declared slot — never hidden, never double-counted — plus a
 * legacy migration preview proving `LCF`/`CF`/`RCF` consolidates to one `F` primary without
 * inventing a secondary/tertiary. Visual/data candidate only — `PlayerEditorForm` is untouched
 * (BLK-03); no production mutation path is wired here, and this page saves nothing.
 */
export default function A12ProfileEditorPage() {
  const [triple, setTriple] = useState<ProfilePositionTriple>(initialDeclaredTriple);

  const slots: { label: string; position: ProfilePosition | null }[] = [
    { label: "Primary", position: triple.primary },
    { label: "Secondary", position: triple.secondary },
    { label: "Tertiary", position: triple.tertiary },
  ];

  return (
    <div className="touchline mx-auto flex max-w-[480px] flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/dev/ui-lab/gate-a" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate A candidates
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A12 — Profile picker &amp; exact evidence boundary</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Declared profile (primary required, secondary/tertiary optional, 14-role vocabulary)
          above; the real sided match evidence each declared slot is built from below — never
          hidden, never double-counted. Writes nothing; no production record is saved here.
        </p>
      </div>

      <AppearanceControl />

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Declared profile position
        </p>
        <ProfilePositionTripleEditor value={triple} onChange={setTriple} />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Exact match evidence behind each declared slot
        </p>
        {slots.map(({ label, position }) => {
          const aggregate = position ? profileEvidenceAggregates.find((a) => a.profile === position) : undefined;
          return (
            <div key={label}>
              <p className="mb-1 text-[11px] text-[var(--text-soft)]">{label}</p>
              {position === null ? (
                <p className="text-[12px] text-[var(--text-soft)]">Not declared.</p>
              ) : aggregate ? (
                <LegacyEvidenceDrilldown aggregate={aggregate} />
              ) : (
                <p className="text-[12px] text-[var(--text-soft)]">No recorded exact-position evidence for {position} yet.</p>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Legacy migration preview
        </p>
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-3 text-[12px] text-[var(--text-muted)]">
          <p>
            Historical exact record: <code>{legacyForwardConsolidationPreview.sourceCodes.join(", ")}</code>
          </p>
          <p className="mt-1">
            Consolidates to one declared primary:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {legacyForwardConsolidationPreview.singleProfile ?? "— ambiguous, not auto-declared —"}
            </span>
            . Secondary and tertiary stay empty — nothing in the source record distinguishes them,
            so nothing is invented.
          </p>
        </div>
      </div>
    </div>
  );
}
