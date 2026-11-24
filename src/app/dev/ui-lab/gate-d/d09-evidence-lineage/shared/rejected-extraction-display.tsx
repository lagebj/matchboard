import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";

/**
 * Presentational component for a genuinely different situation from `EvidenceLineageDisplay`:
 * a submission that never became an observation at all. The real contract
 * (`src/lib/evidence/qualitative-evidence-extraction-contract.ts`'s `validateExtractionSemantics`)
 * rejects the ENTIRE extraction response when a PLAYER/PAIR-scoped claim has no resolvable
 * `playerRef` — there is no "kept but flagged ambiguous" tier in the real domain model. A vague
 * reference like "he" with no identifiable player therefore produces **zero** observations, not
 * a low-confidence one. This component shows that real outcome honestly, rather than inventing an
 * "ambiguous" observation status that doesn't exist in the actual contract.
 */
export type RejectedExtractionSubmission = {
  submittedText: string;
  rejectionReason: string;
  resultingObservationCount: 0;
};

export function RejectedExtractionDisplay({ submission }: { submission: RejectedExtractionSubmission }) {
  return (
    <Surface>
      <div className="p-4">
        <SectionHeader
          title="Submission rejected — no observation created"
          description="The real extraction contract discards the whole response when a player-scoped claim can't be resolved to a known player. It never keeps a vague claim as a low-confidence observation."
        />
        <div className="mt-3 rounded-md border px-3 py-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Coach-submitted text</p>
          <p className="mt-1">{submission.submittedText}</p>
        </div>
        <div className="mt-3 rounded-md border border-[var(--warning)] px-3 py-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--warning)]">Rejected</p>
          <p className="mt-1">{submission.rejectionReason}</p>
        </div>
        <p className="mt-3 text-[11px] text-[var(--text-muted)]" data-testid="observation-count">
          Resulting observations created: {submission.resultingObservationCount}. No player-specific
          assessment is derived from an unresolvable reference.
        </p>
      </div>
    </Surface>
  );
}
