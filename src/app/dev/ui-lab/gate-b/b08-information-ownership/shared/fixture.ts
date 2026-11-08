import { buildMatchPresentation, type MatchPresentation } from "@/lib/matches/match-presentation";
import type { CanonicalTacticalPosition } from "@/domain/positions/roles";
import { MATCH_B_TEAM_NAME, type MatchBSquadMember } from "../../shared/match-b-fixture";
import type { CoachingIntentCategory } from "@/lib/coaching/types";

/**
 * Gate B W5 (B08) — one match identity, five lifecycle observation points. Unlike B06 (two
 * genuinely separate League/Event matches) or B01-B04 (four different matches), B08's own
 * register row is specifically about the SAME match moving through BEFORE -> LIVE -> AFTER ->
 * REPORT-DRAFT -> REPORT-COMPLETED — one `B08_MATCH_ID`/`B08_REPORT_ID` throughout, same team
 * (`MATCH_B_TEAM_NAME`, the one real squad persisting across the whole Gate B programme per
 * ADR-0157), same opponent/kickoff. Fixed UTC clocks only — never `Date.now()`.
 */
export const B08_MATCH_ID = "match-gate-b-08";
export const B08_REPORT_ID = "report-gate-b-08";
/** B08's own real debrief identity — third remediation ("final data-integrity remediation",
 * defect #4): `SafePostMatchReportShell` previously hardcoded B05's own `"debrief-gate-b-05"` id
 * unconditionally for every caller, including B08. */
export const B08_DEBRIEF_ID = "debrief-gate-b-08";
export const B08_OPPONENT_NAME = "Vollen IL";
export const B08_KICKOFF_AT = new Date("2026-11-05T10:00:00.000Z");

/**
 * Five real observation instants along one match's own lifecycle — never `Date.now()`, and each
 * strictly later than the one before it (checked in `__tests__/fixture.test.ts`).
 *
 * `B08_BEFORE_NOW`: two days before kickoff (planning).
 * `B08_LIVE_NOW`: kickoff + 55 minutes = 15 minutes into the second half (10:40 kickoff of the
 * half + 15'), deliberately BEFORE the match's own third/final goal (48') — the live snapshot
 * genuinely has unfinished work still ahead of it, not a relabeled final state.
 * `B08_AFTER_REFERENCE_AT`: kickoff + 105 minutes, after the final whistle (60' regulation + 10'
 * break + a short real-world buffer — the same convention B06's `AFTER_REFERENCE_AT` uses).
 * `B08_DRAFT_REFERENCE_AT`: later the same match day, once the coach sits down to the report.
 * `B08_COMPLETED_AT`: the next morning, when the report is actually locked.
 */
export const B08_BEFORE_NOW = new Date("2026-11-03T18:00:00.000Z");
export const B08_LIVE_NOW = new Date("2026-11-05T10:55:00.000Z");
export const B08_AFTER_REFERENCE_AT = new Date("2026-11-05T11:45:00.000Z");
export const B08_DRAFT_REFERENCE_AT = new Date("2026-11-05T12:30:00.000Z");
export const B08_COMPLETED_AT = new Date("2026-11-06T09:00:00.000Z");
export const B08_COMPLETED_BY = "Kristin Haug";

/**
 * Same real NFF Akershus G11 age-class format every other Gate B scenario with a resolved match
 * format uses (7-a-side, 2x30 minutes, 60 total regulation) — see `b05-post-match-report/shared/
 * report-data.ts`'s own doc comment for the authoritative NFF source. No match-specific exception
 * is introduced here; reusing the same already-established, authoritative format rather than
 * inventing a new duration.
 */
export const B08_MATCH_FORMAT = {
  ageGroup: "G11",
  squadFormat: "7v7",
  maxOnFieldPlayers: 7,
  numberOfPeriods: 2,
  periodDurationMinutes: 30,
  breakDurationMinutes: 10,
  regulationDurationMinutes: 60,
} as const;

/**
 * The real production conversion from a human-facing GLOBAL match minute to the period-relative
 * `{period, matchSeconds}` encoding `LiveMatchEvent` actually stores. Despite its legacy name,
 * `matchSeconds` is MILLISECONDS since period start — confirmed directly against
 * `src/components/live-match/live-match-client.tsx`'s own comment ("event.matchSeconds is
 * milliseconds since period start (legacy name — ADR-0133 H3)") and its real
 * `formatElapsedMs(event.matchSeconds)` renderer, and against `src/lib/live-match/match-clock.ts`'s
 * `getElapsedMs()`/`formatElapsedMs()` pair, which the same component uses for its own running
 * clock. B08 W5 remediation (independent review): this function previously multiplied by 60
 * (seconds), which rendered every live event at roughly 0:00 in `LiveMatchClient`'s own Recent
 * Events list once the real component was mounted — B05's own identically-named-but-dormant
 * helper (`b05-post-match-report/shared/report-data.ts`) carries the same latent bug, never
 * surfaced there because B05 never mounts the real `LiveMatchClient`/`formatElapsedMs` consumer
 * (tracked separately, out of this wave's scope — see BLOCKERS.md).
 *
 * Deliberately re-declared here rather than imported from `b05-post-match-report/shared/
 * report-data.ts` — each Gate B wave's own fixture module stays self-contained rather than
 * cross-importing another wave's scenario directory (the same discipline Gate A's W3 shared
 * fixture documents for `FixtureIdentity`).
 */
export function globalMinuteToPeriodRelative(
  globalMinute: number,
  format: { numberOfPeriods: number; periodDurationMinutes: number },
): { period: number; matchSeconds: number } {
  const periodIndex = Math.min(Math.floor(globalMinute / format.periodDurationMinutes), format.numberOfPeriods - 1);
  const periodRelativeMinutes = globalMinute - periodIndex * format.periodDurationMinutes;
  return { period: periodIndex + 1, matchSeconds: periodRelativeMinutes * 60 * 1000 };
}

/** The true inverse of `globalMinuteToPeriodRelative()` above — period (1-indexed) + real
 * milliseconds since that period's start, back to a human-facing global match minute. Used by
 * the B08-LIVE interactive journey (shared/b08-journey.ts) to label a goal recorded live with a
 * real minute, the same way `fixture-history.ts`'s own canonical events carry a `minuteLabel`. */
export function periodRelativeToGlobalMinute(
  period: number | null,
  matchSecondsMs: number | null,
  format: { periodDurationMinutes: number },
): number {
  return ((period ?? 1) - 1) * format.periodDurationMinutes + (matchSecondsMs ?? 0) / 60_000;
}

/** POSITIONAL_DISCIPLINE (`src/lib/coaching/types.ts`) — the real stored coaching-intent category
 * for this match, read by `AfterMatchOverview`'s "Coaching intent review" widget as a Class 1
 * (Fact) item (ADR-0157 C1). Themed to match this fixture's own reflection/debrief narrative
 * (defensive transitions after conceding), not an arbitrary pick. */
export const B08_COACHING_INTENT_CATEGORY: CoachingIntentCategory = "POSITIONAL_DISCIPLINE";
export const B08_COACHING_INTENT_NOTE =
  "Hold our defensive shape in transition — stop conceding from turnovers after we lose the ball high.";

/**
 * Full 7-a-side starting formation (GK + 6 outfield, every real NFF G11 7v7 slot filled) plus one
 * bench reserve who attends but does not play. No substitutions occur this match (`b08RotationEvents`
 * in `fixture-history.ts` is explicitly empty) and one squad member is a recorded no-show —
 * modeling both "present but unused" and "absent" without inventing an unexplained minutes value.
 */
export const b08Squad: readonly MatchBSquadMember[] = [
  { playerId: "player-gb8-jonas", displayName: "Jonas", shirtNumber: 1, tacticalPosition: "GK", role: "starter" },
  { playerId: "player-gb8-theodor", displayName: "Theodor", shirtNumber: 4, tacticalPosition: "LCB", role: "starter" },
  { playerId: "player-gb8-markus", displayName: "Markus", shirtNumber: 5, tacticalPosition: "RCB", role: "starter" },
  { playerId: "player-gb8-sindre", displayName: "Sindre", shirtNumber: 7, tacticalPosition: "LCM", role: "starter" },
  { playerId: "player-gb8-kasper", displayName: "Kasper", shirtNumber: 8, tacticalPosition: "CM", role: "starter" },
  { playerId: "player-gb8-noah", displayName: "Noah", shirtNumber: 9, tacticalPosition: "RCM", role: "starter" },
  { playerId: "player-gb8-vetle", displayName: "Vetle", shirtNumber: 10, tacticalPosition: "CF", role: "starter" },
  { playerId: "player-gb8-elias", displayName: "Elias", shirtNumber: 14, tacticalPosition: null, role: "reserve" },
];

export const B08_LINEUP_STARTER_SLOTS: readonly CanonicalTacticalPosition[] = ["GK", "LCB", "RCB", "LCM", "CM", "RCM", "CF"];

/**
 * One real `MatchPresentation` per lifecycle moment this match passes through — same real
 * `buildMatchPresentation()` projection every other surface uses (ADR-0125), never a hand-rolled
 * header. `score`/`outcome` only ever appear once the real canonical facts support them: BEFORE
 * has none, LIVE carries the real in-progress score at `B08_LIVE_NOW` (1-1 — the match's own
 * third and final goal has not happened yet, see `fixture-history.ts`'s canonical event list),
 * AFTER/REPORT both carry the real final 2-1 result.
 */
export const b08BeforeIdentity: MatchPresentation = buildMatchPresentation({
  id: B08_MATCH_ID,
  href: null,
  teamName: MATCH_B_TEAM_NAME,
  opponentName: B08_OPPONENT_NAME,
  isHome: true,
  kickoffAt: B08_KICKOFF_AT,
  lifecycleStatus: "planning_open",
});

export const b08LiveIdentity: MatchPresentation = buildMatchPresentation({
  id: B08_MATCH_ID,
  href: null,
  teamName: MATCH_B_TEAM_NAME,
  opponentName: B08_OPPONENT_NAME,
  isHome: true,
  kickoffAt: B08_KICKOFF_AT,
  lifecycleStatus: "live",
  ownGoals: 1,
  opponentGoals: 1,
  liveClockLabel: "45'",
});

/** `played`/`report_incomplete` (AFTER, report not yet complete) vs `done` (REPORT-COMPLETED's
 * own historical AFTER view) — the two real AFTER-eligible lifecycle statuses
 * (`deriveMatchDetailSurfaceState()`), both carrying the same final 2-1 result. */
export function b08AfterIdentity(variant: "draft" | "completed"): MatchPresentation {
  return buildMatchPresentation({
    id: B08_MATCH_ID,
    href: null,
    teamName: MATCH_B_TEAM_NAME,
    opponentName: B08_OPPONENT_NAME,
    isHome: true,
    kickoffAt: B08_KICKOFF_AT,
    lifecycleStatus: variant === "draft" ? "report_incomplete" : "done",
    ownGoals: 2,
    opponentGoals: 1,
    outcome: "WON",
  });
}
