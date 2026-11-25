import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { PlayerMatchRow } from "@/lib/touchline/presentation/player-matches-view-model";

/**
 * Gate D register D04 ("Player Detail / Matches — recorded matches vs. not-recorded minutes").
 * Full-coverage state: every match has recorded minutes and at least one recorded actual
 * position.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D04-FULL",
  fixtureId: "gate-d-w1-d04-full-coverage",
  fixtureVersion: 1,
  fixtureSha256: "e55523f1c2e6eb040877634c4862b5d1baa6dd2b92313d6e669e85064ccfb19f",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-23T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matches: PlayerMatchRow[] = [
  {
    matchId: "gate-d-w1-d04-match-1",
    source: "LEAGUE",
    date: "Sat 14 Nov",
    opponentOrEventName: "Askim IF",
    competitionLabel: "League, Round 11",
    minutes: 90,
    actualPositions: ["CB"],
    context: "CORE",
    goals: 0,
    assists: 1,
    href: "/dev/ui-lab/gate-d/d04-matches-coverage/full-coverage",
  },
  {
    matchId: "gate-d-w1-d04-match-2",
    source: "LEAGUE",
    date: "Sat 7 Nov",
    opponentOrEventName: "Mysen IL",
    competitionLabel: "League, Round 10",
    minutes: 90,
    actualPositions: ["RCB", "CB"],
    context: "CORE",
    goals: 1,
    assists: 0,
    href: "/dev/ui-lab/gate-d/d04-matches-coverage/full-coverage",
  },
  {
    matchId: "gate-d-w1-d04-match-3",
    source: "EVENT",
    date: "Wed 4 Nov",
    opponentOrEventName: "Internal training match",
    competitionLabel: "Development event",
    minutes: 45,
    actualPositions: ["CDM"],
    context: "DEVELOPMENT",
    goals: 0,
    assists: 0,
    href: "/dev/ui-lab/gate-d/d04-matches-coverage/full-coverage",
  },
];

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W1-D04-FULL", matches };
