import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { FixturePeriod, FixtureMatch } from "@/domain/fixtures/types";

/**
 * Gate E register E01 ("League / Fixtures and results — current planning round identifiable
 * among historical/upcoming; period navigation + context restoration", XR-T01/XR-S02).
 *
 * Mid-season state: the active league season ("Spring 2027") has past (FINAL and NEEDS_CLOSURE),
 * current, and future (NOT_GENERATED-attention and READY-quiet) rounds simultaneously, plus a
 * fully-completed second period ("Autumn 2026") to exercise period navigation and the resulting
 * re-resolution of "current"/focused round. All dates are computed as fixed offsets from a frozen
 * anchor instant (`ANCHOR`), never `Date.now()` — deterministic across every render, and the real
 * `buildLeagueOperatingViewModel()` classifies them, nothing here hand-asserts a classification.
 */
const ANCHOR = new Date("2027-03-15T09:00:00.000Z");
export const now = ANCHOR;

function offsetDays(days: number): string {
  const d = new Date(ANCHOR);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function match(partial: Partial<FixtureMatch> & Pick<FixtureMatch, "id" | "title" | "teamId" | "teamName">): FixtureMatch {
  return {
    opponent: undefined,
    opponentTeamId: null,
    startsAt: undefined,
    venue: undefined,
    selectionState: "READY",
    selectedPlayerCount: undefined,
    blockerCount: 0,
    decisionRequiredCount: 0,
    postMatchStatus: undefined,
    reportState: { state: "NO_REPORT" },
    availableActions: [],
    matchStatus: "SCHEDULED",
    cancelledReason: null,
    lifecycleStatus: "planning_open",
    teamKitColor: "#1D4ED8",
    lineupState: "PREPARED",
    planningSignals: [],
    ...partial,
  };
}

// Round 6 (ANCHOR-21d): earlier history — pushes Round 7/8 into "recent" and this one into the
// collapsed "earlier rounds" disclosure.
const round6Match = match({
  id: "gate-e-w1-e01-mid-r6-m1",
  title: "Blåveis IF vs Lillestrøm 2",
  teamId: "team-blaveis",
  teamName: "Blåveis IF",
  opponent: "Lillestrøm 2",
  startsAt: offsetDays(-21),
  lifecycleStatus: "done",
  reportState: { state: "COMPLETED", result: { goalsFor: 2, goalsAgainst: 1, outcome: "WON", displayScore: "2–1" } },
});

// Round 7 (ANCHOR-14d): one completed match (FINAL) and one cancelled match — demonstrates
// CANCELLED is excluded from closure computation and never rendered as if it were a result.
const round7MatchDone = match({
  id: "gate-e-w1-e01-mid-r7-m1",
  title: "Blåveis IF vs Askim IF",
  teamId: "team-blaveis",
  teamName: "Blåveis IF",
  opponent: "Askim IF",
  startsAt: offsetDays(-14),
  lifecycleStatus: "done",
  reportState: { state: "COMPLETED", result: { goalsFor: 6, goalsAgainst: 4, outcome: "WON", displayScore: "6–4" } },
});
const round7MatchCancelled = match({
  id: "gate-e-w1-e01-mid-r7-m2",
  title: "Blåveis IF 2 vs Mysen IL",
  teamId: "team-blaveis-2",
  teamName: "Blåveis IF 2",
  opponent: "Mysen IL",
  startsAt: offsetDays(-14),
  matchStatus: "CANCELLED",
  cancelledReason: "Opponent withdrew",
  lifecycleStatus: "cancelled",
});

// Round 8 (ANCHOR-7d): report missing — the most recently played round still needing closure.
const round8Match = match({
  id: "gate-e-w1-e01-mid-r8-m1",
  title: "Blåveis IF vs Nordby IL",
  teamId: "team-blaveis",
  teamName: "Blåveis IF",
  opponent: "Nordby IL",
  startsAt: offsetDays(-7),
  lifecycleStatus: "played",
  reportState: { state: "NO_REPORT" },
});

// Round 9 (ANCHOR+0d): the temporally CURRENT round — carries real attention (one BLOCKED signal,
// one tactics-missing match) without that attention overriding the "Current round" identity.
const round9MatchBlocked = match({
  id: "gate-e-w1-e01-mid-r9-m1",
  title: "Blåveis IF vs Trøgstad/Båstad",
  teamId: "team-blaveis",
  teamName: "Blåveis IF",
  opponent: "Trøgstad/Båstad",
  startsAt: offsetDays(0),
  lineupState: "MISSING",
  planningSignals: [
    {
      idempotencyKey: "gate-e-w1-e01-mid-r9-m1-below-min",
      kind: "BLOCKED",
      ruleCode: "SQUAD_BELOW_MINIMUM",
      title: "Squad below minimum",
      currentState: "Only 9 available players for this match.",
      consequence: "The match cannot be fielded without more available players.",
      primaryActionLabel: "Review availability",
      primaryActionTarget: "/matches/gate-e-w1-e01-mid-r9-m1?tab=selection",
      matchId: "gate-e-w1-e01-mid-r9-m1",
      teamId: "team-blaveis",
    },
  ],
});
const round9MatchTacticsMissing = match({
  id: "gate-e-w1-e01-mid-r9-m2",
  title: "Blåveis IF 2 vs Enebakk IF",
  teamId: "team-blaveis-2",
  teamName: "Blåveis IF 2",
  opponent: "Enebakk IF",
  startsAt: offsetDays(0),
  lineupState: "MISSING",
});

// Round 10 (ANCHOR+7d): FUTURE, not yet generated — the next actionable item after the current
// round, giving the rail an UPCOMING/ATTENTION slot distinct from Round 9's CURRENT slot.
const round10Match = match({
  id: "gate-e-w1-e01-mid-r10-m1",
  title: "Blåveis IF vs Spydeberg IF",
  teamId: "team-blaveis",
  teamName: "Blåveis IF",
  opponent: "Spydeberg IF",
  startsAt: offsetDays(7),
  selectionState: "NOT_GENERATED",
  lineupState: "MISSING",
});

// Round 11 (ANCHOR+21d): FUTURE, already READY — the quiet "all set" far-future state, separated
// from Round 10 by one genuinely empty rail week (ANCHOR+14d has no round).
const round11Match = match({
  id: "gate-e-w1-e01-mid-r11-m1",
  title: "Blåveis IF vs Fjellhamar IL",
  teamId: "team-blaveis",
  teamName: "Blåveis IF",
  opponent: "Fjellhamar IL",
  startsAt: offsetDays(21),
  selectionState: "READY",
  lineupState: "PREPARED",
});

export const springPeriod: FixturePeriod = {
  id: "gate-e-w1-e01-mid-period-spring-2027",
  title: "Spring 2027",
  dateRange: "Feb – Apr 2027",
  startDate: offsetDays(-28),
  endDate: offsetDays(35),
  blockerCount: 1,
  decisionRequiredCount: 0,
  isCurrent: true,
  rounds: [
    {
      id: "gate-e-w1-e01-mid-round-6",
      title: "Round 6",
      dateRange: "22 Feb 2027",
      selectionState: "FINALIZED",
      hasDraftSelections: true,
      hasMatches: true,
      blockerCount: 0,
      decisionRequiredCount: 0,
      availableActions: [],
      matches: [round6Match],
      roundLevelPlanningSignals: [],
    },
    {
      id: "gate-e-w1-e01-mid-round-7",
      title: "Round 7",
      dateRange: "1 Mar 2027",
      selectionState: "FINALIZED",
      hasDraftSelections: true,
      hasMatches: true,
      blockerCount: 0,
      decisionRequiredCount: 0,
      availableActions: [],
      matches: [round7MatchDone, round7MatchCancelled],
      roundLevelPlanningSignals: [],
    },
    {
      id: "gate-e-w1-e01-mid-round-8",
      title: "Round 8",
      dateRange: "8 Mar 2027",
      selectionState: "FINALIZED",
      hasDraftSelections: true,
      hasMatches: true,
      blockerCount: 0,
      decisionRequiredCount: 0,
      availableActions: [],
      matches: [round8Match],
      roundLevelPlanningSignals: [],
    },
    {
      id: "gate-e-w1-e01-mid-round-9",
      title: "Round 9",
      dateRange: "15 Mar 2027",
      selectionState: "DRAFT",
      hasDraftSelections: true,
      hasMatches: true,
      blockerCount: 1,
      decisionRequiredCount: 0,
      availableActions: [],
      matches: [round9MatchBlocked, round9MatchTacticsMissing],
      roundLevelPlanningSignals: [],
    },
    {
      id: "gate-e-w1-e01-mid-round-10",
      title: "Round 10",
      dateRange: "22 Mar 2027",
      selectionState: "NOT_GENERATED",
      hasDraftSelections: false,
      hasMatches: true,
      blockerCount: 0,
      decisionRequiredCount: 0,
      availableActions: ["createDraft"],
      matches: [round10Match],
      roundLevelPlanningSignals: [],
    },
    {
      id: "gate-e-w1-e01-mid-round-11",
      title: "Round 11",
      dateRange: "5 Apr 2027",
      selectionState: "READY",
      hasDraftSelections: true,
      hasMatches: true,
      blockerCount: 0,
      decisionRequiredCount: 0,
      availableActions: [],
      matches: [round11Match],
      roundLevelPlanningSignals: [],
    },
  ],
};

// A fully-completed, non-current second period — switching to it must re-resolve the focused
// round to its own most-recent-needing-closure round (Round 2), never carry over Spring's
// Round 9 selection or its "Current round" label.
const autumnMatchDone = match({
  id: "gate-e-w1-e01-mid-autumn-r1-m1",
  title: "Blåveis IF vs Rakkestad IL",
  teamId: "team-blaveis",
  teamName: "Blåveis IF",
  opponent: "Rakkestad IL",
  startsAt: offsetDays(-190),
  lifecycleStatus: "done",
  reportState: { state: "COMPLETED", result: { goalsFor: 3, goalsAgainst: 0, outcome: "WON", displayScore: "3–0" } },
});
const autumnMatchNeedsClosure = match({
  id: "gate-e-w1-e01-mid-autumn-r2-m1",
  title: "Blåveis IF vs Hobøl IL",
  teamId: "team-blaveis",
  teamName: "Blåveis IF",
  opponent: "Hobøl IL",
  startsAt: offsetDays(-180),
  lifecycleStatus: "played",
  reportState: { state: "NO_REPORT" },
});

export const autumnPeriod: FixturePeriod = {
  id: "gate-e-w1-e01-mid-period-autumn-2026",
  title: "Autumn 2026",
  dateRange: "Aug – Sep 2026",
  startDate: offsetDays(-210),
  endDate: offsetDays(-170),
  blockerCount: 0,
  decisionRequiredCount: 0,
  isCurrent: false,
  rounds: [
    {
      id: "gate-e-w1-e01-mid-autumn-round-1",
      title: "Round 1",
      dateRange: "6 Sep 2026",
      selectionState: "FINALIZED",
      hasDraftSelections: true,
      hasMatches: true,
      blockerCount: 0,
      decisionRequiredCount: 0,
      availableActions: [],
      matches: [autumnMatchDone],
      roundLevelPlanningSignals: [],
    },
    {
      id: "gate-e-w1-e01-mid-autumn-round-2",
      title: "Round 2",
      dateRange: "16 Sep 2026",
      selectionState: "FINALIZED",
      hasDraftSelections: true,
      hasMatches: true,
      blockerCount: 0,
      decisionRequiredCount: 0,
      availableActions: [],
      matches: [autumnMatchNeedsClosure],
      roundLevelPlanningSignals: [],
    },
  ],
};

export const periods: FixturePeriod[] = [springPeriod, autumnPeriod];

export const identity: FixtureIdentity = {
  scenarioId: "GATE-E-W1-E01-MID-SEASON",
  fixtureId: "gate-e-w1-e01-mid-season-current-round",
  fixtureVersion: 2,
  fixtureSha256: "0d081a1e132084ee58cbdc652d17a8e84c2cce4d7f0a1897a052ce39fdc6a137",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: ANCHOR.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-E-W1-E01-MID-SEASON", periods };
