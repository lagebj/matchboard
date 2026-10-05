import type { MatchSegment, MatchStateInterval } from "@/lib/evidence/match-state-timeline";
import { computeCoPresencePairs } from "./co-presence";
import { gameStateForInterval } from "./game-state";
import { computeInputRevision } from "./version";
import type { EvidenceRef, MeasurementQuality, MetricKey } from "./types";

/**
 * Pure metric-shaping logic for the match derivation service (ADR-0155 step B2). Deliberately
 * NOT `server-only` — `context-pack.ts` carries that guard and the DB fetching; this module
 * takes already-fetched data and never imports `@/lib/db`, so it can be unit-tested directly
 * without a database (mirrors `actual-timeline.ts`'s own precedent: pure logic lives apart from
 * its `server-only` orchestrator so importing it for a test never pulls `db`/`pg` along).
 */

export interface MeasurementDraft {
  metricKey: MetricKey;
  metricVersion: number;
  scopeType: "MATCH";
  scopeKey: string;
  playerId: string;
  dimensions: Record<string, string>;
  value: number;
  unit: string;
  numerator?: number;
  denominator?: number;
  denominatorUnit?: string;
  presentationScale?: number;
  quality: MeasurementQuality;
  sourceRefs: EvidenceRef[];
  inputRevision: string;
}

/**
 * Event types a coach can attribute to one player and that this layer treats as a discrete
 * "development-context event" — deliberately excludes structural/lifecycle types (MATCH_START,
 * PERIOD_START, PERIOD_END, MATCH_END, ROTATION_OUT, ROTATION_IN, POSITIONS_CHANGED,
 * CLOCK_ADJUSTMENT, EVENT_CORRECTED, EVENT_REVERSED) and the goal-attribution-correction types
 * (SCORER_SET, ASSIST_SET), which `combination-goal-attribution.ts` already owns for
 * score-chronology purposes.
 */
export const ELIGIBLE_EVENT_TYPES = ["GOAL_FOR", "GOAL_AGAINST", "FAIR_PLAY_POSITIVE", "FAIR_PLAY_CONCERN", "MOMENT_MARKED"] as const;

const EVENT_RATE_PRESENTATION_SCALE_SECONDS = 600; // 10 minutes, matching the bundle's own worked example.

export type EligibleEventRow = {
  id: string;
  eventType: string;
  playerId: string | null;
  matchSeconds: number | null;
  payload: unknown;
};

function completeQuality(exposureSeconds?: number): MeasurementQuality {
  return { coverage: "COMPLETE", missingInputs: [], warnings: [], exposureSeconds, eligible: true };
}

function unknownQuality(missingInputs: string[], warnings: string[] = []): MeasurementQuality {
  return { coverage: "UNKNOWN", missingInputs, warnings, eligible: false };
}

/**
 * The one seam a future coordinate-capture feature would populate — no event producer writes
 * `x`/`y` into `payload` today (ADR-0155's disclosed limitation), so this returns `null` for
 * every real payload shape in production. Kept isolated so that seam is a one-function change.
 */
export function coordinatesFromPayload(payload: unknown): { x: number; y: number } | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const x = record.x;
  const y = record.y;
  return typeof x === "number" && typeof y === "number" ? { x, y } : null;
}

function matchEventRef(event: EligibleEventRow): EvidenceRef {
  return { kind: "MATCH_EVENT", id: event.id };
}

function actualPositionTimelineRef(scopeKey: string): EvidenceRef {
  return { kind: "ACTUAL_POSITION_INTERVAL", id: scopeKey, label: "Actual-position timeline" };
}

export function toMatchSegments(intervals: readonly MatchStateInterval[]): MatchSegment[] {
  return intervals.map((interval) => ({
    startMs: interval.startMs,
    endMs: interval.endMs,
    playersOnPitch: new Map(
      interval.players.map((p) => [p.playerId, { position: p.position, line: p.line, lane: p.lane }]),
    ),
  }));
}

/** role_seconds: sum of valid raw-interval durations per (playerId, position). Start inclusive, end exclusive. */
export function buildRoleSecondsDrafts(
  scopeKey: string,
  intervals: readonly { playerId: string; position: string; startedAtMs: number; endedAtMs: number | null }[],
  matchEndMs: number | null,
): { drafts: MeasurementDraft[]; totalExposureSecondsByPlayer: Map<string, number> } {
  const metricKey: MetricKey = "role_seconds";
  const metricVersion = 1;
  const durationsMs = new Map<string, number>(); // key: playerId\u0000position
  const contributingIntervals = new Map<string, string[]>();

  for (const interval of intervals) {
    if (interval.position === "BENCH" || interval.position === "unknown") continue;
    const resolvedEnd = interval.endedAtMs ?? matchEndMs;
    if (resolvedEnd == null) continue; // never fill unresolved role time from a guess.

    const durationMs = Math.max(0, resolvedEnd - interval.startedAtMs);
    const key = `${interval.playerId}\u0000${interval.position}`;
    durationsMs.set(key, (durationsMs.get(key) ?? 0) + durationMs);

    const encoded = `${interval.startedAtMs}:${resolvedEnd}`;
    const list = contributingIntervals.get(key) ?? [];
    list.push(encoded);
    contributingIntervals.set(key, list);
  }

  const drafts: MeasurementDraft[] = [];
  const totalExposureSecondsByPlayer = new Map<string, number>();

  for (const [key, ms] of durationsMs.entries()) {
    const [playerId, position] = key.split("\u0000") as [string, string];
    const seconds = ms / 1000;
    totalExposureSecondsByPlayer.set(playerId, (totalExposureSecondsByPlayer.get(playerId) ?? 0) + seconds);

    drafts.push({
      metricKey,
      metricVersion,
      scopeType: "MATCH",
      scopeKey,
      playerId,
      dimensions: { position },
      value: seconds,
      unit: "seconds",
      numerator: seconds,
      quality: completeQuality(seconds),
      sourceRefs: [actualPositionTimelineRef(scopeKey)],
      inputRevision: computeInputRevision({
        metricKey,
        metricVersion,
        scopeKey,
        playerId,
        position,
        intervals: contributingIntervals.get(key) ?? [],
      }),
    });
  }

  return { drafts, totalExposureSecondsByPlayer };
}

/** game_state_role_seconds: role exposure split by game state. Unknown time is never redistributed. */
export function buildGameStateRoleSecondsDrafts(scopeKey: string, intervals: readonly MatchStateInterval[]): MeasurementDraft[] {
  const metricKey: MetricKey = "game_state_role_seconds";
  const metricVersion = 1;
  const durationsMs = new Map<string, number>(); // key: playerId\u0000position\u0000gameState

  for (const interval of intervals) {
    const gameState = gameStateForInterval(interval);
    const durationMs = interval.endMs - interval.startMs;
    for (const player of interval.players) {
      const key = `${player.playerId}\u0000${player.position}\u0000${gameState}`;
      durationsMs.set(key, (durationsMs.get(key) ?? 0) + durationMs);
    }
  }

  const drafts: MeasurementDraft[] = [];
  for (const [key, ms] of durationsMs.entries()) {
    const [playerId, position, gameState] = key.split("\u0000") as [string, string, string];
    const seconds = ms / 1000;
    drafts.push({
      metricKey,
      metricVersion,
      scopeType: "MATCH",
      scopeKey,
      playerId,
      dimensions: { position, gameState },
      value: seconds,
      unit: "seconds",
      numerator: seconds,
      quality: completeQuality(seconds),
      sourceRefs: [actualPositionTimelineRef(scopeKey), { kind: "MATCH_EVENT", id: scopeKey, label: "Goal chronology" }],
      inputRevision: computeInputRevision({ metricKey, metricVersion, scopeKey, playerId, position, gameState }),
    });
  }
  return drafts;
}

/** teammate_copresence_seconds: all-pairs shared on-pitch seconds, emitted from both players' perspectives. */
export function buildCoPresenceDrafts(scopeKey: string, intervals: readonly MatchStateInterval[]): MeasurementDraft[] {
  const metricKey: MetricKey = "teammate_copresence_seconds";
  const metricVersion = 1;
  const pairs = computeCoPresencePairs(toMatchSegments(intervals));

  const drafts: MeasurementDraft[] = [];
  for (const pair of pairs) {
    for (const [playerId, teammateId] of [
      [pair.playerAId, pair.playerBId],
      [pair.playerBId, pair.playerAId],
    ] as const) {
      drafts.push({
        metricKey,
        metricVersion,
        scopeType: "MATCH",
        scopeKey,
        playerId,
        dimensions: { teammateId },
        value: pair.sharedSeconds,
        unit: "seconds",
        numerator: pair.sharedSeconds,
        quality: completeQuality(pair.sharedSeconds),
        sourceRefs: [actualPositionTimelineRef(scopeKey)],
        inputRevision: computeInputRevision({ metricKey, metricVersion, scopeKey, playerId, teammateId }),
      });
    }
  }
  return drafts;
}

/** event_count and event_rate, dimensioned by eventType. Rate is skipped when exposure is absent (never 0/0). */
export function buildEventDrafts(
  scopeKey: string,
  events: readonly EligibleEventRow[],
  totalExposureSecondsByPlayer: ReadonlyMap<string, number>,
): MeasurementDraft[] {
  const countMetricKey: MetricKey = "event_count";
  const rateMetricKey: MetricKey = "event_rate";
  const byPlayerAndType = new Map<string, EligibleEventRow[]>();

  for (const event of events) {
    if (!event.playerId) continue;
    const key = `${event.playerId}\u0000${event.eventType}`;
    const list = byPlayerAndType.get(key) ?? [];
    list.push(event);
    byPlayerAndType.set(key, list);
  }

  const drafts: MeasurementDraft[] = [];
  for (const [key, group] of byPlayerAndType.entries()) {
    const [playerId, eventType] = key.split("\u0000") as [string, string];
    const refs = group.map(matchEventRef);
    const eventIds = group.map((e) => e.id).sort();

    drafts.push({
      metricKey: countMetricKey,
      metricVersion: 1,
      scopeType: "MATCH",
      scopeKey,
      playerId,
      dimensions: { eventType },
      value: group.length,
      unit: "count",
      numerator: group.length,
      quality: completeQuality(),
      sourceRefs: refs,
      inputRevision: computeInputRevision({ metricKey: countMetricKey, metricVersion: 1, scopeKey, playerId, eventType, eventIds }),
    });

    const exposureSeconds = totalExposureSecondsByPlayer.get(playerId);
    if (exposureSeconds != null && exposureSeconds > 0) {
      drafts.push({
        metricKey: rateMetricKey,
        metricVersion: 1,
        scopeType: "MATCH",
        scopeKey,
        playerId,
        dimensions: { eventType },
        value: group.length / exposureSeconds,
        unit: "count_per_exposure",
        numerator: group.length,
        denominator: exposureSeconds,
        denominatorUnit: "seconds",
        presentationScale: EVENT_RATE_PRESENTATION_SCALE_SECONDS,
        quality: completeQuality(exposureSeconds),
        sourceRefs: [...refs, actualPositionTimelineRef(scopeKey)],
        inputRevision: computeInputRevision({
          metricKey: rateMetricKey,
          metricVersion: 1,
          scopeKey,
          playerId,
          eventType,
          eventIds,
          exposureSeconds,
        }),
      });
    }
  }
  return drafts;
}

/**
 * zone_event_share: disclosed-inert per ADR-0155 §3. No event carries a coordinate today, so
 * every eligible player gets exactly one UNKNOWN-coverage row recording "N eligible events, 0
 * with coordinates" rather than silently nothing — the plumbing is real and inspectable even
 * though no zone attribution exists yet. zone_event_count is never emitted while
 * validCoordinateCount is 0 for everyone (there is no zone to attribute a count to).
 */
export function buildZoneShareDrafts(scopeKey: string, events: readonly EligibleEventRow[]): MeasurementDraft[] {
  const metricKey: MetricKey = "zone_event_share";
  const metricVersion = 1;
  const byPlayer = new Map<string, EligibleEventRow[]>();
  for (const event of events) {
    if (!event.playerId) continue;
    const list = byPlayer.get(event.playerId) ?? [];
    list.push(event);
    byPlayer.set(event.playerId, list);
  }

  const drafts: MeasurementDraft[] = [];
  for (const [playerId, group] of byPlayer.entries()) {
    const validCoordinateCount = group.filter((e) => coordinatesFromPayload(e.payload) !== null).length;
    if (validCoordinateCount > 0) {
      // A future coordinate-capture feature would group by zoneForCoordinate(x, y) here instead
      // of falling through to the UNKNOWN-coverage row below.
      continue;
    }

    const eventIds = group.map((e) => e.id).sort();
    drafts.push({
      metricKey,
      metricVersion,
      scopeType: "MATCH",
      scopeKey,
      playerId,
      dimensions: {},
      value: 0,
      unit: "ratio",
      numerator: 0,
      denominator: group.length,
      quality: unknownQuality(["eventCoordinates"], ["No recorded event coordinates for this match."]),
      sourceRefs: group.map(matchEventRef),
      inputRevision: computeInputRevision({ metricKey, metricVersion, scopeKey, playerId, eventIds }),
    });
  }
  return drafts;
}
