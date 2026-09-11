import type { SeasonCombinationSummary } from "@/lib/evidence/combination-aggregation";
import { MetricStory, PairedOutcomeBar } from "@/components/viz";

const FAMILY_LABELS: Record<string, string> = {
  PARTNERSHIP: "Partnership",
  TRIANGLE: "Triangle",
  LINE: "Line",
  CORRIDOR: "Corridor",
  FUNCTIONAL_UNIT: "Functional unit",
  FULL_CONFIGURATION: "Full configuration",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  INSUFFICIENT: "Insufficient",
  EMERGING: "Emerging",
  ESTABLISHED: "Established",
};

const MAX_ROWS_SHOWN = 8;

/**
 * Factual combination evidence recorded in matches against this specific opponent (AGENTS.md
 * "Previous encounters"). Purely informational context — never a selection-scoring input and
 * never a synthesized score (AGENTS.md "Opponent teams and encounter observations").
 *
 * Presented as an evidence story per the fixed mapping (ADR-0125): on-field combination
 * pattern → `MetricStory` + `PairedOutcomeBar`. Goals-for and goals-against while the
 * combination was present are shown on one scale — a factual paired outcome, never a ranking
 * against other combinations and never a good/bad encoding.
 */
export function OpponentCombinationEvidenceSection({
  summaries,
  playerNameById,
}: {
  summaries: SeasonCombinationSummary[];
  playerNameById: Record<string, string>;
}) {
  const shown = summaries.filter((s) => s.confidence !== "INSUFFICIENT").slice(0, MAX_ROWS_SHOWN);

  return (
    <div className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-4">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">Combination evidence vs this opponent</h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        What actually happened on the pitch across matches against this opponent. Descriptive context, not a chemistry score.
      </p>
      {shown.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">No combination evidence recorded yet for matches against this opponent.</p>
      ) : (
        <div className="mt-3 flex flex-col divide-y divide-[var(--border-soft)]">
          {shown.map((summary) => {
            const names = summary.playerIds
              .map((id) => playerNameById[id] ?? "Unknown player")
              .join(" · ");
            const familyLabel = FAMILY_LABELS[summary.family] ?? summary.family;
            const confidenceLabel = CONFIDENCE_LABELS[summary.confidence] ?? summary.confidence;
            const matchLabel = `${summary.matchCount} match${summary.matchCount === 1 ? "" : "es"}`;
            return (
              <div key={`${summary.family}-${summary.playerIds.join(":")}`} className="py-3 first:pt-0 last:pb-0">
                <MetricStory
                  question={`What happened when ${names} were on the field together against this opponent?`}
                  label={familyLabel}
                  value={`Observed in ${matchLabel}`}
                  comparator={`${Math.round(summary.totalMinutesTogether)} min together`}
                  visual={
                    <PairedOutcomeBar
                      question={`Goals for and against while ${names} were on the field together vs this opponent`}
                      rows={[
                        { label: "Goals for", value: summary.goalsForTotal },
                        { label: "Goals against", value: summary.goalsAgainstTotal },
                      ]}
                    />
                  }
                  interpretation={
                    summary.matchCount > 1
                      ? "This pattern has appeared across several matches against this opponent."
                      : "This pattern has been observed against this opponent once so far."
                  }
                  sampleContext={`${confidenceLabel} confidence · ${matchLabel} vs this opponent`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
