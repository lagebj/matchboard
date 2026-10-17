import type { MatchFlowChronology } from "@/lib/matches/completed-match-story";
import type { MatchPresentation } from "@/lib/matches/match-presentation";

/**
 * UI-Lab-local only -- demonstrates a disclosure the real `match-flow-panel.tsx` does not have
 * yet (see B03's design-audit finding in its `page.tsx` and `BLOCKERS.md`). Not imported by, or
 * proposed as a change to, the real component in this wave.
 *
 * `buildMatchFlowChronology()`'s own `trustworthy` flag only covers unknown-minute goals; a fully
 * trustworthy chronology can still be sparse relative to the real final score (one logged goal,
 * final score 6-4). Returns `true` (nothing to disclose) whenever the real panel already handles
 * the case itself -- untrustworthy, empty, or no score recorded yet.
 */
export function chronologyReconcilesWithFinalScore(
  matchIdentity: Pick<MatchPresentation, "score" | "ownTeamSide">,
  chronology: MatchFlowChronology,
): boolean {
  if (!chronology.trustworthy) return true;
  const finalPoint = chronology.points.at(-1);
  if (!finalPoint || !matchIdentity.score || !matchIdentity.ownTeamSide) return true;

  const [expectedOwnGoals, expectedOpponentGoals] =
    matchIdentity.ownTeamSide === "home"
      ? [matchIdentity.score.home, matchIdentity.score.away]
      : [matchIdentity.score.away, matchIdentity.score.home];

  return finalPoint.ownGoals === expectedOwnGoals && finalPoint.opponentGoals === expectedOpponentGoals;
}
