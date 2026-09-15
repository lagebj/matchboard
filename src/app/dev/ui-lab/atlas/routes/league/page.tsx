"use client";

import { useState } from "react";
import { TouchlinePageHeader } from "@/components/touchline";
import { LeagueSurface } from "@/components/fixtures/league-surface";
import { UiLabShell } from "../../../ui-lab-shells";
import { atlasNav, leagueUiLabStates, type LeagueUiLabStateKey } from "../../fixtures";

const STATE_LABELS: Record<LeagueUiLabStateKey, string> = {
  "current-attention": "Current — attention",
  "current-ready": "Current — ready",
  "past-needs-closure": "Past — needs closure",
  "all-history": "All history",
  "not-generated": "Not generated",
};

const STATE_KEYS = Object.keys(STATE_LABELS) as LeagueUiLabStateKey[];

/**
 * League / Fixtures — Matchboard League Operating Surface bundle
 * (`06_COMPONENT_COMPOSITION_CONTRACT.md`, `08_UI_LAB_AND_VISUAL_MERGE_GATE.md`).
 *
 * Exercises the real production composition (`LeagueSurface`) against the 5 required
 * deterministic states rather than a bespoke lab-only layout, so this page is genuine visual
 * evidence for the merge gate, not a lookalike.
 */
export default function AtlasLeaguePage() {
  const [stateKey, setStateKey] = useState<LeagueUiLabStateKey>("current-attention");
  const [earlierExpanded, setEarlierExpanded] = useState(false);
  const vm = leagueUiLabStates[stateKey];

  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-[900px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="League" context={vm.activePeriod?.title} />

      <div className="mt-4 flex flex-wrap gap-2 border-b border-[var(--border-soft)] pb-4">
        {STATE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setStateKey(key);
              setEarlierExpanded(false);
            }}
            aria-pressed={stateKey === key}
            className={
              "rounded-full border px-3 py-1.5 text-[12px] font-medium " +
              (stateKey === key
                ? "border-[var(--accent)] bg-[var(--tl-c-surface-hover)] text-[var(--foreground)]"
                : "border-[var(--border-soft)] text-[var(--text-muted)]")
            }
          >
            {STATE_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <LeagueSurface
          viewModel={vm}
          onSelectRound={() => {
            /* UI Lab is read-only evidence; round selection is exercised on the real route. */
          }}
          earlierExpanded={earlierExpanded}
          onToggleEarlier={() => setEarlierExpanded((v) => !v)}
        />
      </div>
    </UiLabShell>
  );
}
