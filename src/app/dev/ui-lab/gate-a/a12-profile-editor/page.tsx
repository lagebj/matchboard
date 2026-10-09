"use client";

import Link from "next/link";
import { useState } from "react";
import { AppearanceControl } from "@/components/touchline";
import { ProfilePositionSelector } from "./profile-position-selector";
import { LegacyEvidenceDrilldown } from "./legacy-evidence-drilldown";
import { declaredProfilePosition, profileEvidenceAggregates } from "./fixtures";
import type { ProfilePosition } from "../shared/profile-position-model";

/**
 * `/dev/ui-lab/gate-a/a12-profile-editor` — A12 candidate: a 14-role declared-profile picker next
 * to the real exact-match evidence that backs it, collapsed without loss. Visual/data candidate
 * only — `PlayerEditorForm` is untouched (BLK-03); no production mutation path is wired here.
 */
export default function A12ProfileEditorPage() {
  const [declared, setDeclared] = useState<ProfilePosition>(declaredProfilePosition);

  const selectedAggregate = profileEvidenceAggregates.find((a) => a.profile === declared);

  return (
    <div className="touchline mx-auto flex max-w-[480px] flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/dev/ui-lab/gate-a" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate A candidates
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A12 — Profile picker & exact evidence boundary</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Declared profile (14 roles) above; the real sided match evidence it is built from below —
          never hidden, never double-counted.
        </p>
      </div>

      <AppearanceControl />

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Declared profile position
        </p>
        <ProfilePositionSelector value={declared} onChange={setDeclared} />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Exact match evidence behind this profile
        </p>
        {selectedAggregate ? (
          <LegacyEvidenceDrilldown aggregate={selectedAggregate} />
        ) : (
          <p className="text-[12px] text-[var(--text-soft)]">No recorded exact-position evidence for this profile yet.</p>
        )}
      </div>
    </div>
  );
}
