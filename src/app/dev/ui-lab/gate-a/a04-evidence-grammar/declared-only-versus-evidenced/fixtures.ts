import type { FixtureIdentity } from "../shared/coverage";
import type { ExactPositionAppearance } from "../../shared/profile-position-model";

/**
 * A04-S6 `declared-only-versus-evidenced` fixture: a coach declaration is not the same source
 * class as actual recorded match evidence. Case A has a declared primary CM with no actual match
 * intervals. Case B has the same declaration plus the real S5-shaped LCM 20m + RCM 10m match
 * evidence (one match, 30 recorded minutes) — shown separately, never merged or auto-promoted.
 *
 * Independent review round 1 (PR #778, finding R2): the declaration itself is a fully recorded
 * fact (`COMPLETE`) — only the *actual match exposure* is `NOT_RECORDED`/absent. The original
 * fixture gave the whole Case A panel a single `NOT_APPLICABLE` badge, which obscured that
 * distinction, and had no separate inspectable source proving the exposure absence was actually
 * checked (vs. merely inferred from omission). Each claim now has its own source ID and its own
 * coverage state.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A04-S6",
  fixtureId: "gate-a-a04-declared-only-versus-evidenced",
  fixtureVersion: 2,
  fixtureSha256: "555a556a881a7feb9aba9404e366e91873cadb28d7f987697298c96ad428ff6f",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-09-01T10:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const declaredPrimary = "CM" as const;

export const caseAPlayerId = "player-s6-case-a-declared-only";
export const caseADeclarationSourceId = "src-declaration-s6-case-a";
/** Proves the actual-exposure absence was a checked recording scope, not an inferred omission. */
export const caseAExposureCheckSourceId = "src-exposure-check-s6-case-a";
export const caseAExposureCheckExplanation =
  "This player's full match history was checked for any actual closed playing interval — none exists. Absence is recorded, not inferred from a missing field.";

export const caseBPlayerId = "player-s6-case-b-declared-and-evidenced";
export const caseBDeclarationSourceId = "src-declaration-s6-case-b";
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
  caseAExposureCheckExplanation,
  caseBPlayerId,
  caseBMatchId,
  caseBMatchLabel,
  caseBExactIntervals,
};
