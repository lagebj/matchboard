import type { OpponentPlayingStyleTag } from "@/generated/prisma/client";
import { PLAYING_STYLE_TAG_LABELS } from "@/lib/opponents/playing-style-tags";
import type { OpponentTacticalTendency, OpponentTendencyOutcome } from "@/lib/opponents/playing-style-aggregation";

const CONFIDENCE_LABELS: Record<string, string> = {
  INSUFFICIENT: "Limited evidence",
  EMERGING: "Emerging",
  ESTABLISHED: "Established",
};

/**
 * Evidence-Informed Match Planning programme, Bundle 3: coach-facing "what has this opponent
 * repeatedly shown, and how confident is that?" (PROGRAMME.md's Opponent profile requirement).
 * Purely descriptive — never a synthesized score, never framed as a prediction (D-017,
 * DOCUMENTATION-MAP.md writing rules: "Matchboard has observed this pattern repeatedly," never
 * "this opponent always...").
 *
 * INSUFFICIENT-confidence tags are excluded from the list (one observation is not a pattern yet)
 * — matches OpponentCombinationEvidenceSection's same exclusion on this page, for consistency.
 */
export function OpponentTacticalTendencySection({
  tendencies,
  outcomes,
}: {
  tendencies: OpponentTacticalTendency[];
  outcomes: OpponentTendencyOutcome[];
}) {
  const shown = tendencies.filter((t) => t.confidence !== "INSUFFICIENT");
  const outcomeByTag = new Map(outcomes.map((o) => [o.tag, o]));

  return (
    <div className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-4">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">Tactical tendencies</h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        Recent observations recorded by coaches after matches against this opponent. Not a prediction, and not the same as sporting level.
      </p>
      {shown.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">Not enough observations recorded yet to describe a repeated tendency.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {shown.map((tendency) => {
            const label = PLAYING_STYLE_TAG_LABELS[tendency.tag as OpponentPlayingStyleTag] ?? tendency.tag;
            const confidenceLabel = CONFIDENCE_LABELS[tendency.confidence] ?? tendency.confidence;
            const outcome = outcomeByTag.get(tendency.tag);
            return (
              <li
                key={tendency.tag}
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-[var(--foreground)]"
              >
                <span className="font-medium text-[var(--foreground)]">{label}</span>
                <span className="text-[var(--text-muted)]"> · {confidenceLabel}</span>
                <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Recent observations repeatedly show this in {tendency.occurrences} recorded encounter{tendency.occurrences === 1 ? "" : "s"}
                  {" "}(last seen {tendency.lastObservedAt.toLocaleDateString()}).
                </div>
                {outcome && (
                  <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                    In those {outcome.matchCount} match{outcome.matchCount === 1 ? "" : "es"}, the team recorded {outcome.goalsFor} goal
                    {outcome.goalsFor === 1 ? "" : "s"} for and {outcome.goalsAgainst} against.
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
