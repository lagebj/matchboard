"use client";

import { useState } from "react";
import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { TacticsBoard } from "@/components/formations/tactics-board";
import { TouchlineInspector, InspectorFact } from "@/components/touchline/workbench/touchline-inspector";
import { atlasNav, formationsList, lineupSlots } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

/**
 * Formations — `10_ROUTE_COMPOSITION_CONFIG_MORE_REVIEWS_AUTH.md §A`.
 * Desktop: formation list left, pitch editor centre, selected-slot details right. `FREE` shows
 * "Manual-only for automatic planning" verbatim (ADR-0129).
 */
export default function AtlasFormationsPage() {
  const [selectedId, setSelectedId] = useState(formationsList[0].id);
  const selectedSlot = lineupSlots[4]; // CM — a non-FREE example slot

  return (
    <UiLabShell activeKey="more" contentWidthClass="max-w-[1180px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="Formations" context="Manage reusable formation templates" actions={<TouchlineButton variant="primary">New formation</TouchlineButton>} />

      <div className="mt-5 flex flex-col gap-6 large:flex-row">
        <div className="large:w-[220px] shrink-0">
          <ul className="flex flex-col gap-1">
            {formationsList.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(f.id)}
                  className={
                    "w-full rounded-[var(--tl-c-radius-control)] px-3 py-2 text-left text-[13px] " +
                    (f.id === selectedId ? "bg-[var(--tl-c-surface-selected)] font-[600] text-[var(--foreground)]" : "text-[var(--text-soft)]")
                  }
                >
                  {f.name} <span className="text-[var(--text-muted)]">· {f.gameFormat} · {f.source}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 flex-1">
          <TacticsBoard
            mode="formation-preview"
            slots={lineupSlots}
            canAddMore={false}
            readOnly
            onAddSlot={() => {}}
            onEditSlot={() => {}}
            pitchStyle="perspective"
          />
        </div>

        <div className="hidden large:block">
          <TouchlineInspector title={selectedSlot.label} headline={selectedSlot.shortLabel}>
            <InspectorFact label="Role type">{selectedSlot.roleType}</InspectorFact>
            <InspectorFact label="Exact derived target role">{selectedSlot.shortLabel}</InspectorFact>
            <InspectorFact label="Automatic-planning eligibility">
              Natural/Strong/Plausible fit is required for automatic assignment to this role.
            </InspectorFact>
          </TouchlineInspector>
        </div>
      </div>
    </UiLabShell>
  );
}
