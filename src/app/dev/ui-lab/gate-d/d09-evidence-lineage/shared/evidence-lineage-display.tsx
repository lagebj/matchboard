"use client";

import { useState } from "react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";

/**
 * Presentational component exposing qualitative-evidence supersession lineage — no existing
 * production component surfaces this to a coach today. The underlying data model is real and
 * already shipped (`src/lib/evidence/qualitative-evidence-service.ts`): resubmitting a source
 * marks the prior `SUCCEEDED` extraction run's `supersededAt`, and the service's own doc comment
 * confirms resubmitting with zero observations is the real retraction path ("safe to call with
 * zero observations (e.g. a coach retracted a claim on resubmit) — that still supersedes stale
 * prior evidence; it just leaves nothing active to replace it with"). Every existing read helper
 * returns only non-superseded ("active") observations (`ACTIVE_RUN_FILTER`). Per the owner's
 * decision #6, this is "exposing existing lineage," not "another supersession model" — Edit and
 * Retract below are UI Lab simulations of that exact real resubmission mechanism, not a new one.
 *
 * Disclosed gap (see `DATA_TRUTH_AND_FIXTURES.md`): `QualitativeEvidenceExtractionRun` persists
 * only a `sourceFingerprint` and char counts, never the raw originally-submitted text. The closest
 * real "original wording" this schema can show is each `QualitativeEvidenceObservation.statement`
 * — the structured claim, not necessarily a byte-identical copy of free text the coach typed. A
 * true original-source view would require the specific `sourceType`'s own storage (e.g. a match
 * debrief field), which this module does not read and this candidate does not claim to show.
 *
 * Edit/Retract are simulated: no `recordDeterministicExtraction()` call, no database write.
 */
export type EvidenceLineageEntry = {
  id: string;
  statement: string;
  explicitness: "EXPLICIT" | "TENTATIVE";
  createdAt: string;
  status: "SUPERSEDED" | "ACTIVE";
  supersededAt: string | null;
};

function LineageEntryRow({
  entry,
  onRetract,
  onEdit,
}: {
  entry: EvidenceLineageEntry;
  onRetract: () => void;
  onEdit: (nextStatement: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.statement);

  return (
    <li className={`rounded-md border px-3 py-2 text-sm ${entry.status === "SUPERSEDED" ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {entry.status === "ACTIVE" ? "Active" : "Superseded"}
        </span>
        <span className="text-xs text-[var(--text-muted)]">{new Date(entry.createdAt).toLocaleDateString()}</span>
      </div>
      {editing ? (
        <div className="mt-1 flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded-md border bg-transparent p-2 text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onEdit(draft);
                setEditing(false);
              }}
              className="rounded-md border border-[var(--accent)] px-2 py-1 text-xs text-[var(--accent)]"
            >
              Save edit (simulated)
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-md border px-2 py-1 text-xs">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className={entry.status === "SUPERSEDED" ? "line-through" : ""}>{entry.statement}</p>
      )}
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-[var(--text-muted)]">
          {entry.explicitness === "TENTATIVE" ? "Tentative" : "Explicit"}
          {entry.supersededAt ? ` · superseded ${new Date(entry.supersededAt).toLocaleDateString()}` : ""}
        </span>
        {entry.status === "ACTIVE" && !editing && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)} className="text-xs text-[var(--accent)] underline">
              Edit
            </button>
            <button type="button" onClick={onRetract} className="text-xs text-[var(--danger)] underline">
              Retract
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

export function EvidenceLineageDisplay({
  entries: initialEntries,
  interactive = false,
}: {
  entries: EvidenceLineageEntry[];
  /** Enables simulated Edit/Retract controls on active entries (default false preserves the
   * original read-only presentation for states that don't need interaction). */
  interactive?: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);

  const retract = (id: string) => {
    const now = new Date().toISOString();
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status: "SUPERSEDED", supersededAt: now } : e)));
  };

  const edit = (id: string, nextStatement: string) => {
    const now = new Date().toISOString();
    setEntries((prev) => {
      const superseded = prev.map((e) => (e.id === id ? { ...e, status: "SUPERSEDED" as const, supersededAt: now } : e));
      const original = prev.find((e) => e.id === id);
      if (!original) return superseded;
      return [
        ...superseded,
        {
          id: `${id}-edit-${now}`,
          statement: nextStatement,
          explicitness: original.explicitness,
          createdAt: now,
          status: "ACTIVE",
          supersededAt: null,
        },
      ];
    });
  };

  return (
    <Surface>
      <div className="p-4">
        <SectionHeader
          title="Observation lineage"
          description="Previous extracted observation wording is retained when a newer extraction supersedes it. The original coach-submitted source is not shown here."
        />
        <ol className="mt-3 space-y-2">
          {entries.map((entry) =>
            interactive ? (
              <LineageEntryRow
                key={entry.id}
                entry={entry}
                onRetract={() => retract(entry.id)}
                onEdit={(next) => edit(entry.id, next)}
              />
            ) : (
              <li
                key={entry.id}
                className={`rounded-md border px-3 py-2 text-sm ${entry.status === "SUPERSEDED" ? "opacity-60" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {entry.status === "ACTIVE" ? "Active" : "Superseded"}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">{new Date(entry.createdAt).toLocaleDateString()}</span>
                </div>
                <p className={entry.status === "SUPERSEDED" ? "line-through" : ""}>{entry.statement}</p>
                <span className="text-xs text-[var(--text-muted)]">
                  {entry.explicitness === "TENTATIVE" ? "Tentative" : "Explicit"}
                  {entry.supersededAt ? ` · superseded ${new Date(entry.supersededAt).toLocaleDateString()}` : ""}
                </span>
              </li>
            ),
          )}
        </ol>
        {interactive && (
          <p className="mt-3 text-[11px] text-[var(--text-muted)]">
            Edit and Retract on this candidate are simulated: no real resubmission is recorded, no
            database write occurs. They model the real `recordDeterministicExtraction()`
            supersession behavior locally.
          </p>
        )}
      </div>
    </Surface>
  );
}
