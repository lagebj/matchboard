import type { SeasonCombinationSummary } from "@/lib/evidence/combination-aggregation";

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
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-4">
      <h2 className="text-sm font-semibold text-zinc-50">Combination evidence vs this opponent</h2>
      <p className="mt-1 text-xs text-zinc-500">
        What actually happened on the pitch across matches against this opponent. Descriptive context, not a chemistry score.
      </p>
      {shown.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-400">No combination evidence recorded yet for matches against this opponent.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {shown.map((summary) => {
            const names = summary.playerIds.map((id) => playerNameById[id] ?? "Unknown player").join(" & ");
            const familyLabel = FAMILY_LABELS[summary.family] ?? summary.family;
            const confidenceLabel = CONFIDENCE_LABELS[summary.confidence] ?? summary.confidence;
            return (
              <li
                key={`${summary.family}-${summary.playerIds.join(":")}`}
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-200"
              >
                <span className="font-medium text-zinc-100">{names}</span>
                <span className="text-zinc-500"> · {familyLabel}</span>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {Math.round(summary.totalMinutesTogether)} min together across {summary.matchCount} match{summary.matchCount === 1 ? "" : "es"} vs this opponent · {confidenceLabel} confidence
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
