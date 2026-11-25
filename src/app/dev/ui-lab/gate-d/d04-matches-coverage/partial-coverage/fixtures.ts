import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { PlayerMatchRow } from "@/lib/touchline/presentation/player-matches-view-model";

/**
 * Gate D register D04, partial-coverage state: one match has full recorded data, one has no
 * recorded minutes at all, and one has minutes but no recorded actual position — three distinct
 * "not-recorded" shapes, each rendered truthfully rather than backfilled from a planned lineup
 * (`PlayerMatchTimeline`'s own contract rule).
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D04-PARTIAL",
  fixtureId: "gate-d-w1-d04-partial-coverage",
  fixtureVersion: 1,
  fixtureSha256: "7f3ad6c7b8edf21cf7f4b7531b3125bf0a1df08b3aab5ac58be5af5cac595ee9",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-23T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matches: PlayerMatchRow[] = [
  {
    matchId: "gate-d-w1-d04-partial-match-1",
    source: "LEAGUE",
    date: "Sat 14 Nov",
    opponentOrEventName: "Askim IF",
    competitionLabel: "League, Round 11",
    minutes: 90,
    actualPositions: ["CB"],
    context: "CORE",
    goals: 0,
    assists: 0,
    href: "/dev/ui-lab/gate-d/d04-matches-coverage/partial-coverage",
  },
  {
    matchId: "gate-d-w1-d04-partial-match-2",
    source: "LEAGUE",
    date: "Sat 7 Nov",
    opponentOrEventName: "Mysen IL",
    competitionLabel: "League, Round 10",
    minutes: null,
    actualPositions: [],
    context: "SUPPORT",
    goals: 0,
    assists: 0,
    href: "/dev/ui-lab/gate-d/d04-matches-coverage/partial-coverage",
  },
  {
    matchId: "gate-d-w1-d04-partial-match-3",
    source: "LEAGUE",
    date: "Sat 31 Oct",
    opponentOrEventName: "Trøgstad/Båstad",
    competitionLabel: "League, Round 9",
    minutes: 23,
    actualPositions: [],
    context: "CORE",
    goals: 0,
    assists: 0,
    href: "/dev/ui-lab/gate-d/d04-matches-coverage/partial-coverage",
  },
];

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W1-D04-PARTIAL", matches };
