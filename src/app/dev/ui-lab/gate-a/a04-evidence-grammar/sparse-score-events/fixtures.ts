import type { FixtureIdentity } from "../shared/coverage";

/**
 * A04-S4 `sparse-score-events` fixture: the canonical final result (6–4) and the recorded event
 * log are independent source classes. The event log has exactly one logged `GOAL_FOR`; the final
 * score is never recomputed from it.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A04-S4",
  fixtureId: "gate-a-a04-sparse-score-events",
  fixtureVersion: 1,
  fixtureSha256: "7d9f7b3d98adefd258f32f8a2d7d082be31fe25a326468d75f6fd04d33842ec9",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-09-01T10:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchId = "match-s4-sparse-score-events";
export const homeTeam = "Slemmestad IL";
export const awayTeam = "Åsgård FK";

export const canonicalResult = {
  sourceId: "src-result-s4",
  homeScore: 6,
  awayScore: 4,
  coverage: "COMPLETE" as const,
};

export type GoalEvent = {
  eventId: string;
  type: "GOAL_FOR";
  minute: number;
  sourceId: string;
};

/** Exactly one individually logged goal event — the other nine goals from the 6-4 result are not
 * reconstructed. */
export const eventLog: {
  events: readonly GoalEvent[];
  coverage: "PARTIAL";
} = {
  events: [{ eventId: "evt-goal-34", type: "GOAL_FOR", minute: 34, sourceId: "src-event-goal-34" }],
  coverage: "PARTIAL",
};

export const rawRecordsForHash = { matchId, homeTeam, awayTeam, canonicalResult, eventLog };
