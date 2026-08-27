import type { SeasonCombinationSummary } from "@/lib/evidence/combination-aggregation";

const CONFIDENCE_LABELS: Record<string, string> = {
  EMERGING: "Emerging",
  ESTABLISHED: "Established",
};

const SUBTYPE_LABELS: Record<string, string> = {
  HORIZONTAL: "horizontal partnership",
  VERTICAL: "vertical partnership",
  GOALKEEPER_LINK: "goalkeeper link",
};

/**
 * Factual season partnership evidence for a set of players currently planned together (line-up
 * or rotation planning) — never a chemistry score, and never per-match evidence for a match that
 * has not been played yet (see AGENTS.md "Combination evidence"). Shared by the Tactics and
 * Rotations tabs.
 */
export function PlannedPartnershipEvidenceList({
  summaries,
  playerNameById,
}: {
  summaries: SeasonCombinationSummary[];
  playerNameById: Record<string, string>;
}) {
  if (summaries.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1.5">
      {summaries.map((s) => {
        const names = s.playerIds.map((id) => playerNameById[id] ?? "Unknown player").join(" & ");
        const confidenceLabel = CONFIDENCE_LABELS[s.confidence] ?? s.confidence;
        const subtypeLabel = s.subtype ? SUBTYPE_LABELS[s.subtype] ?? s.subtype.toLowerCase() : "partnership";
        return (
          <li
            key={s.playerIds.join(":")}
            className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-2.5 py-1.5 text-xs"
          >
            <span className="font-medium text-zinc-100">{names}</span>
            <span className="text-[var(--text-muted)]">
              {" "}
              — {confidenceLabel} {subtypeLabel}: {Math.round(s.totalMinutesTogether)} min across {s.matchCount} match
              {s.matchCount === 1 ? "" : "es"} this season
            </span>
          </li>
        );
      })}
    </ul>
  );
}
