import type { FixtureIdentity } from "../shared/coverage";
import type { ExactPositionAppearance } from "../../shared/profile-position-model";

/**
 * A04-S6 `declared-only-versus-evidenced` fixture: a coach declaration is not the same source
 * class as actual recorded match evidence. Case A has a declared primary CM with no actual match
 * intervals. Case B has the same declaration plus the real S5-shaped LCM 20m + RCM 10m match
 * evidence (one match, 30 recorded minutes) — shown separately, never merged or auto-promoted.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A04-S6",
  fixtureId: "gate-a-a04-declared-only-versus-evidenced",
  fixtureVersion: 1,
  fixtureSha256: "9883f8617546967683f8c1997b7ee8331e3c3306a19d2c0b8f02199efda728c4",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-09-01T10:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const declaredPrimary = "CM" as const;
export const declarationSourceId = "src-declaration-s6";

export const caseAPlayerId = "player-s6-case-a-declared-only";
export const caseBPlayerId = "player-s6-case-b-declared-and-evidenced";
export const caseBMatchId = "match-s6-case-b";
export const caseBMatchLabel = "Match 41";

/** Case B's actual closed intervals — same shape as A04-S5 (LCM 20m + RCM 10m, same match),
 * recreated here as an independent record so S6 never silently depends on another scenario's
 * fixture identity. */
export const caseBExactIntervals: readonly { tacticalPosition: ExactPositionAppearance["tacticalPosition"]; startMinute: number; endMinute: number; sourceId: string }[] = [
  { tacticalPosition: "LCM", startMinute: 0, endMinute: 20, sourceId: "src-s6-interval-lcm" },
  { tacticalPosition: "RCM", startMinute: 20, endMinute: 30, sourceId: "src-s6-interval-rcm" },
];

export function caseBExactAppearances(): ExactPositionAppearance[] {
  return caseBExactIntervals.map((i) => ({
    matchId: caseBMatchId,
    tacticalPosition: i.tacticalPosition,
    minutes: i.endMinute - i.startMinute,
  }));
}

export const rawRecordsForHash = {
  declaredPrimary,
  caseAPlayerId,
  caseBPlayerId,
  caseBMatchId,
  caseBMatchLabel,
  caseBExactIntervals,
};
