import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";

/**
 * New presentational component — no existing production component surfaces qualitative-evidence
 * supersession lineage to a coach today. The underlying data model is real and already shipped
 * (`src/lib/evidence/qualitative-evidence-service.ts`: resubmitting a source marks the prior
 * `SUCCEEDED` extraction run's `supersededAt`, per ADR-0152's governed-learning loop); every
 * existing read helper in that file returns only non-superseded ("active") observations
 * (`ACTIVE_RUN_FILTER`), so there is no existing query or component that already exposes a
 * superseded run alongside the active one. This component is built directly from the real
 * `QualitativeEvidenceObservation`/extraction-run field shapes to expose that existing lineage —
 * per the owner's decision #6, this is "exposing existing lineage," not "another supersession
 * model." See `DATA_TRUTH_AND_FIXTURES.md` for the full disclosure.
 */
export type EvidenceLineageEntry = {
  id: string;
  statement: string;
  explicitness: "EXPLICIT" | "TENTATIVE";
  createdAt: string;
  status: "SUPERSEDED" | "ACTIVE";
  supersededAt: string | null;
};

export function EvidenceLineageDisplay({ entries }: { entries: EvidenceLineageEntry[] }) {
  return (
    <Surface>
      <div className="p-4">
        <SectionHeader
          title="Observation lineage"
          description="The coach's original wording is preserved; a resubmission supersedes the prior extraction, it does not rewrite history."
        />
        <ol className="mt-3 space-y-2">
          {entries.map((entry) => (
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
          ))}
        </ol>
      </div>
    </Surface>
  );
}
