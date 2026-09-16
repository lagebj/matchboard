"use client";

import { useState } from "react";
import { EventsOperatingSurface } from "@/components/events/events-operating-surface";
import { UiLabShell } from "../../../ui-lab-shells";
import { atlasNav, eventsOverviewUiLabStates, type EventsUiLabStateKey } from "../../fixtures";

const STATE_LABELS: Record<EventsUiLabStateKey, string> = {
  primary: "Primary",
  "no-upcoming": "No upcoming",
  empty: "Empty",
  "finalized-next": "Finalised next",
  "attention-heavy": "Attention heavy",
};

const STATE_KEYS = Object.keys(STATE_LABELS) as EventsUiLabStateKey[];

/**
 * Events — Matchboard Events Operating Surface bundle
 * (`08_UI_LAB_AND_VISUAL_MERGE_GATE.md`).
 *
 * Exercises the real production composition (`EventsOperatingSurface`) against the 5 required
 * deterministic states rather than a bespoke lab-only layout, so this page is genuine visual
 * evidence for the merge gate, not a lookalike (mirrors League's `atlas/routes/league/page.tsx`).
 */
export default function AtlasEventsPage() {
  const [stateKey, setStateKey] = useState<EventsUiLabStateKey>("primary");
  const vm = eventsOverviewUiLabStates[stateKey];

  return (
    <UiLabShell activeKey="events" contentWidthClass="max-w-[1100px]" navBuilder={atlasNav}>
      <div className="flex flex-wrap gap-2 border-b border-[var(--border-soft)] pb-4">
        {STATE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setStateKey(key)}
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
        <EventsOperatingSurface orgSlug="atlas-demo" viewModel={vm} />
      </div>
    </UiLabShell>
  );
}
