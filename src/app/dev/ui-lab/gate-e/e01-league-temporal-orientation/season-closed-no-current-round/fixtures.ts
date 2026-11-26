import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { FixturePeriod, FixtureMatch } from "@/domain/fixtures/types";

/**
 * Gate E register E01 — the "no current round exists" edge case: every round in the only
 * league season is in the past. XR-T01's own reject case ("fabricated... current round") is
 * specifically about this state — Matchboard must honestly fall back to the most recent round
 * still needing closure, never invent a false `CURRENT_ROUND` label just because the coach is
 * looking at League. All dates are fixed offsets from a frozen anchor, never `Date.now()`.
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
    selectionState: "FINALIZED",
    selectedPlayerCount: undefined,
    blockerCount: 0,
    decisionRequiredCount: 0,
    postMatchStatus: undefined,
    reportState: { state: "NO_REPORT" },
    availableActions: [],
    matchStatus: "SCHEDULED",
    cancelledReason: null,
    lifecycleStatus: "done",
    teamKitColor: "#B91C1C",
    lineupState: "PREPARED",
    planningSignals: [],
    ...partial,
  };
}

const round1Match = match({
  id: "gate-e-w1-e01-closed-r1-m1",
  title: "Enebakk IF vs Blåveis IF",
  teamId: "team-enebakk",
  teamName: "Enebakk IF",
  opponent: "Blåveis IF",
  startsAt: offsetDays(-60),
  lifecycleStatus: "done",
  reportState: { state: "COMPLETED", result: { goalsFor: 1, goalsAgainst: 3, outcome: "LOST", displayScore: "1–3" } },
});

const round2Match = match({
  id: "gate-e-w1-e01-closed-r2-m1",
  title: "Enebakk IF vs Spydeberg IF",
  teamId: "team-enebakk",
  teamName: "Enebakk IF",
  opponent: "Spydeberg IF",
  startsAt: offsetDays(-50),
  lifecycleStatus: "played",
  reportState: { state: "NO_REPORT" },
});

const round3Match = match({
  id: "gate-e-w1-e01-closed-r3-m1",
  title: "Enebakk IF vs Fjellhamar IL",
  teamId: "team-enebakk",
  teamName: "Enebakk IF",
  opponent: "Fjellhamar IL",
  startsAt: offsetDays(-40),
  lifecycleStatus: "done",
  reportState: { state: "COMPLETED", result: { goalsFor: 2, goalsAgainst: 2, outcome: "DRAWN", displayScore: "2–2" } },
});

export const closedPeriod: FixturePeriod = {
  id: "gate-e-w1-e01-closed-period-autumn-2026",
  title: "Autumn 2026",
  dateRange: "Jan – Mar 2027",
  startDate: offsetDays(-70),
  endDate: offsetDays(-30),
  blockerCount: 0,
  decisionRequiredCount: 0,
  isCurrent: false,
  rounds: [
    {
      id: "gate-e-w1-e01-closed-round-1",
      title: "Round 1",
      dateRange: "14 Jan 2027",
      selectionState: "FINALIZED",
      hasDraftSelections: true,
      hasMatches: true,
      blockerCount: 0,
      decisionRequiredCount: 0,
      availableActions: [],
      matches: [round1Match],
      roundLevelPlanningSignals: [],
    },
    {
      id: "gate-e-w1-e01-closed-round-2",
      title: "Round 2",
      dateRange: "24 Jan 2027",
      selectionState: "FINALIZED",
      hasDraftSelections: true,
      hasMatches: true,
      blockerCount: 0,
      decisionRequiredCount: 0,
      availableActions: [],
      matches: [round2Match],
      roundLevelPlanningSignals: [],
    },
    {
      id: "gate-e-w1-e01-closed-round-3",
      title: "Round 3",
      dateRange: "3 Feb 2027",
      selectionState: "FINALIZED",
      hasDraftSelections: true,
      hasMatches: true,
      blockerCount: 0,
      decisionRequiredCount: 0,
      availableActions: [],
      matches: [round3Match],
      roundLevelPlanningSignals: [],
    },
  ],
};

export const periods: FixturePeriod[] = [closedPeriod];

export const identity: FixtureIdentity = {
  scenarioId: "GATE-E-W1-E01-SEASON-CLOSED",
  fixtureId: "gate-e-w1-e01-season-closed-no-current-round",
  fixtureVersion: 1,
  fixtureSha256: "73f8c9c7c6fff6c3840da8fd0bd353d76d2f2c33108047fc2f6d5ddc3174781a",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: ANCHOR.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-E-W1-E01-SEASON-CLOSED", periods };
