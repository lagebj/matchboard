import type { FixtureIdentity } from "../shared/coverage";
import type { ExactPositionAppearance } from "../../shared/profile-position-model";

/**
 * A04-S5 `central-profile-projection` fixture: one match, two non-overlapping actual closed
 * intervals — LCM 0-20 (20 minutes) and RCM 20-30 (10 minutes). Reuses the approved W1
 * `collapseTacticalToProfile`/`aggregateExactAppearancesByProfile` (`shared/profile-position-
 * model.ts`) for display only — the projection must yield one CM contribution, 30 recorded
 * minutes, one distinct match, while the source drilldown still shows both exact positions.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A04-S5",
  fixtureId: "gate-a-a04-central-profile-projection",
  fixtureVersion: 1,
  fixtureSha256: "64baf40dd80819b1a0da307769b8bdbf6a6e69d60108d137b443a130bc475b7f",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-09-01T10:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchId = "match-s5-central-profile";
export const matchLabel = "Match 31";

export type ExactIntervalRecord = {
  tacticalPosition: ExactPositionAppearance["tacticalPosition"];
  startMinute: number;
  endMinute: number;
  sourceId: string;
};

/** LCM 0-20 (20 minutes), RCM 20-30 (10 minutes) — non-overlapping, same match. */
export const exactIntervals: readonly ExactIntervalRecord[] = [
  { tacticalPosition: "LCM", startMinute: 0, endMinute: 20, sourceId: "src-interval-lcm" },
  { tacticalPosition: "RCM", startMinute: 20, endMinute: 30, sourceId: "src-interval-rcm" },
];

/** A deliberately overlapping variant for the negative overlap test — never rendered on the page. */
export const overlappingIntervalsForNegativeTest: readonly ExactIntervalRecord[] = [
  { tacticalPosition: "LCM", startMinute: 0, endMinute: 25, sourceId: "src-interval-lcm-overlap" },
  { tacticalPosition: "RCM", startMinute: 20, endMinute: 30, sourceId: "src-interval-rcm-overlap" },
];

export function toExactAppearances(intervals: readonly ExactIntervalRecord[]): ExactPositionAppearance[] {
  return intervals.map((i) => ({
    matchId,
    tacticalPosition: i.tacticalPosition,
    minutes: i.endMinute - i.startMinute,
  }));
}

export const rawRecordsForHash = { matchId, matchLabel, exactIntervals };
