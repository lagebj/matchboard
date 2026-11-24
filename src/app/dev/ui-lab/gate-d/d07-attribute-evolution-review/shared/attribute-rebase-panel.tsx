"use client";

import { useState } from "react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { canResumeAutomationAfterManualEdit } from "./materiality-policy";

/**
 * Directional design candidate for ADR-0160 §5 (manual-edit rebase at attribute level, not
 * player level). No production equivalent exists: today's `Player.evidenceCutoverAt` is a single
 * player-wide timestamp (confirmed in `src/lib/evidence/player-evidence-service.ts` and
 * ADR-0092's own schema) — there is no per-attribute cutover field to rebase independently, and
 * no production UI shows this. This component models the accepted behaviour as an explicit,
 * clearly-synthetic state machine over fixture rows; it does not invent or imply any specific
 * database schema. If a persistence detail is genuinely undecided (e.g. the exact column shape
 * for a per-attribute cutover), that is a production-implementation gap, not something this
 * candidate resolves — see `DATA_TRUTH_AND_FIXTURES.md`.
 *
 * Lock/unlock is simulated: no Server Action is called, no attribute lock state is persisted.
 */
export type AttributeRebaseRow = {
  attributeKey: string;
  attributeLabel: string;
  /** The current authoritative baseline for THIS attribute only. */
  baselineValue: number;
  baselineSource: "COACH_ESTABLISHED" | "MANUAL_EDIT" | "AUTOMATIC";
  /** Set when this row demonstrates a manual rebase; omitted for an unaffected attribute. */
  manualEdit?: {
    preEditValue: number;
    preEditSource: "AUTOMATIC" | "COACH_ESTABLISHED";
    editedAt: string;
    editedBy: string;
  };
  matchesSinceBaseline: number;
  confidenceSinceBaseline: number | null;
  locked: boolean;
};

function resumeStatus(row: AttributeRebaseRow): string {
  if (row.locked) return "Locked — automation blocked until the coach unlocks this attribute.";
  const eligible = canResumeAutomationAfterManualEdit(row.matchesSinceBaseline, row.confidenceSinceBaseline, row.locked);
  if (eligible) return "Eligible to resume automatic evaluation (≥3 matches, confidence ≥0.7 since the baseline).";
  const matches = row.matchesSinceBaseline;
  const confidence = row.confidenceSinceBaseline;
  return `Not yet eligible to resume automatically (${matches} match${matches === 1 ? "" : "es"} since baseline${
    confidence !== null ? `, confidence ${confidence.toFixed(2)}` : ", no new evidence yet"
  } — needs ≥3 matches and confidence ≥0.7).`;
}

export function AttributeRebasePanel({ rows }: { rows: AttributeRebaseRow[] }) {
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});

  const simulatedUnlock = (attributeKey: string) => () => {
    setUnlocked((prev) => ({ ...prev, [attributeKey]: true }));
  };

  return (
    <Surface>
      <div className="p-4">
        <SectionHeader
          title="Attribute-level rebase"
          description="Each attribute keeps its own baseline and evidence progression — a manual edit to one never resets another (ADR-0160 §5)."
        />
        <div className="mt-3 flex flex-col gap-3">
          {rows.map((row) => {
            const isLocked = row.locked && !unlocked[row.attributeKey];
            return (
              <div key={row.attributeKey} className="rounded-md border px-3 py-2 text-sm" data-testid={`rebase-row-${row.attributeKey}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{row.attributeLabel}</span>
                  <span className="font-mono text-sm" data-testid={`baseline-${row.attributeKey}`}>
                    {row.baselineValue}
                  </span>
                </div>
                {row.manualEdit ? (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Manually edited to {row.baselineValue} by {row.manualEdit.editedBy} on{" "}
                    {new Date(row.manualEdit.editedAt).toLocaleDateString()} — new baseline for{" "}
                    {row.attributeLabel} only. Prior automatic evidence (last value {row.manualEdit.preEditValue}) remains
                    visible as history but cannot immediately reverse this edit.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    No manual edit — continuing its own independent automatic evidence progression, unaffected by any
                    edit to another attribute.
                  </p>
                )}
                <p className="mt-1 text-xs" data-testid={`resume-status-${row.attributeKey}`}>
                  {isLocked ? resumeStatus({ ...row, locked: true }) : resumeStatus({ ...row, locked: false })}
                </p>
                {row.locked && (
                  <button
                    type="button"
                    onClick={simulatedUnlock(row.attributeKey)}
                    disabled={!isLocked}
                    className="mt-2 rounded-md border px-2 py-1 text-xs disabled:opacity-50"
                  >
                    {isLocked ? "Unlock (simulated)" : "Unlocked (simulated)"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-[var(--text-muted)]">
          Lock/unlock on this candidate is simulated: no Server Action is called, no lock state is
          persisted. This attribute-level rebase surface does not exist in production yet.
        </p>
      </div>
    </Surface>
  );
}
