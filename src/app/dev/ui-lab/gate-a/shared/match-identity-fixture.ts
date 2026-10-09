import { buildMatchPresentation, type MatchPresentation } from "@/lib/matches/match-presentation";

/**
 * Gate A W1 UI Lab candidate — one fixed match identity (`gate-a-match-1`, Rød vs Sætre Lions),
 * reused across A01 and A02 so the same football object visibly persists across composition and
 * lifecycle states (`01_APPROVED_PRODUCT_EXPERIENCE_CONTRACT.md` D1; XR-S01/XR-V01).
 *
 * Fixed UTC kickoff — never `Date.now()` (`21_FIXTURE_CAPTURE_AND_AUTHORITY.md`: fixtures must be
 * deterministic, not clock-dependent).
 */
const KICKOFF_AT = new Date("2026-10-11T10:00:00.000Z");

const BASE = {
  id: "gate-a-match-1",
  href: "/dev/ui-lab/gate-a/a02-match-lifecycle",
  teamName: "Rød",
  opponentName: "Sætre Lions",
  isHome: true as const,
  kickoffAt: KICKOFF_AT,
};

/** Before kickoff: no score exists yet. A planned match is never shown "0-0". */
export const plannedMatchIdentity: MatchPresentation = buildMatchPresentation({
  ...BASE,
  lifecycleStatus: "planning_closed",
});

/** Live: an in-progress, provable score — 2 goals for, 1 against, 37th minute. */
export const liveMatchIdentity: MatchPresentation = buildMatchPresentation({
  ...BASE,
  lifecycleStatus: "live",
  ownGoals: 2,
  opponentGoals: 1,
  liveClockLabel: "37′",
});

/**
 * Completed: final score 6-4, own win — deliberately a high, lopsided scoreline paired with a
 * low recorded-goal-event count elsewhere in the programme's domain-truth rules (`05_DATA_AND_
 * VISUALIZATION_TRUTH.md`: "a 6-4 scoreline may coexist with only one logged goal event" — the
 * final score here is the canonical result, independent of how many individual goal events
 * happen to have been logged in any particular timeline fixture).
 */
export const completedMatchIdentity: MatchPresentation = buildMatchPresentation({
  ...BASE,
  lifecycleStatus: "done",
  ownGoals: 6,
  opponentGoals: 4,
  outcome: "WON",
});

export const GATE_A_MATCH_IDENTITY_FIXTURE_ID = "gate-a-match-1@v1";
