import { ActualIntervalSource } from "@/generated/prisma/client";
import type { MatchPeriod } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  computePositionIntervals,
  type StarterAssignment,
} from "@/lib/evidence/lineup-state";
import { ROLE_TYPE_TO_LINE, laneFromGridX, type FormationSlotRoleType } from "@/lib/formations/types";
import type { FootballMatchRef } from "@/lib/evidence/football-match-ref";
import { MATCH_PERIOD_ORDER } from "@/lib/live-match/live-match-types";
import {
  getCumulativePeriodOffsetsMs,
  getEventPeriodConfig,
  getLeagueMatchPeriodConfig,
  getPeriodDurations,
  getTotalPeriodDurationMs,
  toAbsoluteMatchMs,
  buildPeriodConfigFromFormat,
  type PeriodConfig,
} from "@/lib/live-match/period-config";
// Deliberately from the pure `match-format.ts`, not the `"server-only"`-guarded
// `resolve-live-period-config.ts` — this file also exports pure, DB-free utilities (e.g.
// `sanitizePeriodOffsetMs` below) that non-server test/utility code imports on their own; pulling
// in a server-only module merely to reach one pure mapping function would break every one of
// those callers outside a server context.
import { snapshotToFormat } from "@/lib/live-match/match-format";
import { getEffectiveEventSquadMatchTiming } from "@/lib/events/event-types";
import { getLeagueReversedEventIds, getEventReversedEventIds } from "@/lib/live-match/reversal-resolution";

/**
 * ADR-0146 §4 — the bounded end-of-match cap, replacing the single static
 * `Match.matchDurationMinutes` value (unset by any UI today, so `matchEndMs` was `null` — no cap
 * at all — in practice for every match; this is the direct cause of the "four hours of player
 * minutes from a forgotten clock" failure mode this ADR closes). Only applies when Live Reporting
 * was actually used (a session exists): a match reported through some other means keeps today's
 * exact `matchDurationMinutes`-or-null behavior — out of this ADR's scope, not a regression.
 *
 * `lastKnownPeriod` is the session's own persisted `clockPeriod` — however far the match actually
 * got. A still-`ACTIVE` session (finish never ran, or the reconciliation hasn't reached it yet)
 * is capped exactly like a finished one; nothing here is finish-specific, so a projection
 * requested mid-match is bounded too. `FULL_TIME` means every intended period played out, so the
 * cap is the full intended total (adjusted for any period that was resolved differently — in
 * practice, slice 3 only ever writes a resolution row for the one period active at finish, so
 * this mostly matters for `lastKnownPeriod !== "FULL_TIME"`, the abandoned-mid-period case).
 *
 * Deliberately does NOT recompute `periodConfig`'s cumulative offsets from resolved durations —
 * only the *final* reached period's own contribution is corrected. An earlier period that
 * legitimately ran long via an explicit `End Period` (D7) without needing recovery still uses its
 * *intended* offset for any later period's own relative-timestamp conversion — a pre-existing,
 * separate limitation this ADR does not commit to fixing (out of scope; the abandoned-period
 * scenario this ADR targets structurally only ever affects the last period before finish, since
 * an earlier period cannot be "still active" once a later one has started).
 */
function computeResolvedMatchEndMs(params: {
  periodConfig: PeriodConfig[];
  lastKnownPeriod: MatchPeriod;
  resolutions: readonly { period: MatchPeriod; resolvedDurationMs: number }[];
}): number | null {
  const durations = getPeriodDurations(params.periodConfig);
  const resolvedByPeriod = new Map(params.resolutions.map((r) => [r.period, r.resolvedDurationMs]));

  if (params.lastKnownPeriod === "FULL_TIME") {
    const total = getTotalPeriodDurationMs(params.periodConfig);
    if (total == null) return null;
    let adjusted = total;
    for (const [period, resolvedDurationMs] of resolvedByPeriod) {
      adjusted = adjusted - (durations[period] ?? 0) + resolvedDurationMs;
    }
    return adjusted;
  }

  const offsets = getCumulativePeriodOffsetsMs(params.periodConfig);
  const offset = offsets[params.lastKnownPeriod];
  if (offset == null) return null;
  const lastPeriodDurationMs = resolvedByPeriod.get(params.lastKnownPeriod) ?? durations[params.lastKnownPeriod] ?? 0;
  return offset + lastPeriodDurationMs;
}

/**
 * `LiveMatchEvent.matchSeconds` / `MatchRotation.matchSeconds` hold MILLISECONDS since period
 * start (legacy name — ADR-0133 H3). A corrupt live-reporting session can persist a wildly
 * out-of-range value (the 2026-09-09 incident produced `period=0` events after an F5 reset, and
 * a stale ms/s confusion elsewhere can inflate a value ~1000×). Clamp such values to a plausible
 * band before they feed the absolute-clock arithmetic, so one bad event can't push an interval
 * decades into the match. 4 hours comfortably exceeds any real youth-football period offset.
 */
const MAX_PLAUSIBLE_PERIOD_OFFSET_MS = 4 * 60 * 60 * 1000;

export function sanitizePeriodOffsetMs(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(raw) || raw < 0) return 0;
  return Math.min(raw, MAX_PLAUSIBLE_PERIOD_OFFSET_MS);
}

type RotationInput = {
  outPlayerId: string;
  inPlayerId: string;
  outPosition: string | null;
  inPosition: string | null;
  positionOnly: boolean;
  matchSeconds: number;
};

type PositionChangeInput = {
  playerId: string;
  fromPosition: string;
  toPosition: string;
  matchSeconds: number;
};

export type ActualIntervalRow = {
  playerId: string;
  position: string;
  line: string | null;
  lane: string | null;
  startedAtMs: number;
  endedAtMs: number | null;
  source: ActualIntervalSource;
  approximateTiming: boolean;
};

export async function rebuildActualTimeline(matchId: string): Promise<{
  intervalsCreated: number;
}> {
  const match = await db.match.findFirst({
    where: { id: matchId },
    select: {
      id: true,
      organisationId: true,
      matchDurationMinutes: true,
      matchType: true,
    },
  });

  if (!match) {
    throw new Error("Match not found.");
  }

  // ADR-0146 §1/§4: the session's own frozen format snapshot is authoritative once Live
  // Reporting has started (same read the live clock itself uses,
  // `resolve-live-period-config.ts`'s `resolveLeagueMatchPeriodConfig`) -- falls back to the
  // legacy hardcoded config, byte-identical to pre-ADR-0146 behavior, when no session/snapshot
  // exists yet. One query, not the DB-touching wrapper -- see this file's `snapshotToFormat`
  // import comment for why.
  const session = await db.liveMatchSession.findUnique({
    where: { matchId },
    select: {
      clockPeriod: true,
      formatNumberOfPeriods: true,
      formatPeriodDurationMinutes: true,
      formatBreakDurationMinutes: true,
    },
  });
  const periodConfig = getLeagueMatchPeriodConfig(match.matchType, snapshotToFormat(session));

  let matchEndMs: number | null;
  if (session) {
    const resolutions = await db.matchPeriodTimingResolution.findMany({
      where: { matchId, organisationId: match.organisationId },
      select: { period: true, resolvedDurationMs: true },
    });
    matchEndMs = computeResolvedMatchEndMs({ periodConfig, lastKnownPeriod: session.clockPeriod, resolutions });
    // Defensive fallback only -- computeResolvedMatchEndMs returns null only when the resolved
    // period config itself has no known total (an edge case a real frozen/legacy config never
    // hits); never regress a configured match to "no cap at all".
    matchEndMs ??= match.matchDurationMinutes ? match.matchDurationMinutes * 60 * 1000 : null;
  } else {
    // No Live Reporting session ever existed for this match (e.g. reported entirely post-match)
    // -- unchanged legacy behavior, out of this ADR's scope.
    matchEndMs = match.matchDurationMinutes ? match.matchDurationMinutes * 60 * 1000 : null;
  }

  // Rotations/position-change events are recorded relative to their OWN period (each period's
  // live clock restarts at 0 -- see period-config.ts's getCumulativePeriodOffsetsMs) and must be
  // converted to one continuous absolute match-clock before ordering across periods.
  const periodOffsets = getCumulativePeriodOffsetsMs(periodConfig);

  const starters = await getStartingLineup(matchId);
  const rotations = await getMatchRotations(matchId, periodOffsets);
  const positionChanges = await getPositionChanges(matchId, match.organisationId, periodOffsets);

  const computedIntervals = computePositionIntervals(
    starters,
    rotations,
    positionChanges,
    matchEndMs,
  );

  const intervalRows: ActualIntervalRow[] = computedIntervals.map((interval) => ({
    playerId: interval.playerId,
    position: interval.position,
    line: interval.line ?? null,
    lane: interval.lane ?? null,
    startedAtMs: interval.startedAtMs,
    endedAtMs: interval.endedAtMs,
    source: inferSource(interval, starters),
    approximateTiming: false,
  }));

  await db.$transaction(async (tx) => {
    await tx.actualPositionInterval.deleteMany({
      where: { matchId },
    });

    if (intervalRows.length > 0) {
      await tx.actualPositionInterval.createMany({
        data: intervalRows.map((row) => ({
          matchId,
          organisationId: match.organisationId,
          playerId: row.playerId,
          position: row.position,
          line: row.line,
          lane: row.lane,
          startedAtMs: row.startedAtMs,
          endedAtMs: row.endedAtMs,
          source: row.source,
          approximateTiming: row.approximateTiming,
        })),
      });
    }

    await populatePlayerActualPositions(tx, matchId, intervalRows);
  });

  return { intervalsCreated: intervalRows.length };
}

/**
 * Dispatches actual-timeline reconstruction to the right source implementation.
 * League matches use `rebuildActualTimeline` (unchanged). Event matches use
 * `rebuildEventActualTimeline` (added when Event evidence adapters land — see ADR-0104).
 */
export async function rebuildActualTimelineForRef(ref: FootballMatchRef): Promise<{ intervalsCreated: number }> {
  if (ref.kind === "LEAGUE_MATCH") {
    return rebuildActualTimeline(ref.matchId);
  }
  return rebuildEventActualTimeline(ref.eventMatchId);
}

/**
 * Event-match equivalent of `rebuildActualTimeline`. No structured `MatchRotation`
 * table exists for Event matches (ADR-0104 §5) — starting state comes from
 * `EventMatchLineupAssignment`, and rotations/position-only changes are reconstructed
 * from raw `EventLiveMatchEvent` rows using the same shared `LiveMatchEventType`
 * vocabulary League's live-match reporting uses. `ROTATION_OUT`/`ROTATION_IN` are
 * recorded as two separate per-player events (not one paired substitution record), so
 * they are paired here by matching `matchSeconds` — an OUT with no matching IN at the
 * same timestamp is skipped rather than guessed (no interval invented for it).
 */
export async function rebuildEventActualTimeline(eventMatchId: string): Promise<{
  intervalsCreated: number;
}> {
  const eventMatch = await db.eventMatch.findFirst({
    where: { id: eventMatchId },
    select: {
      id: true,
      organisationId: true,
      event: {
        select: { numberOfHalves: true, matchDurationMinutes: true, breakDurationMinutes: true },
      },
      eventSquad: {
        select: {
          numberOfHalvesOverride: true,
          matchDurationMinutesOverride: true,
          breakDurationMinutesOverride: true,
        },
      },
    },
  });

  if (!eventMatch) {
    throw new Error("Event match not found.");
  }

  // Effective per-squad timing (ADR: getEffectiveEventSquadMatchTiming is the one centralized
  // resolver -- see AGENTS.md "Mixed game formats inside one Event"), not the Event-level
  // default alone: a squad's own halves/duration/break override must be honoured here exactly
  // as it is for live reporting and lineup formation selection.
  const timing = getEffectiveEventSquadMatchTiming(eventMatch.event, eventMatch.eventSquad);
  // ADR-0146 §1/§4: the session's own frozen format snapshot is authoritative once Live
  // Reporting has started (same read the live clock itself uses,
  // `resolve-live-period-config.ts`'s `resolveEventMatchPeriodConfig`) -- falls back to the
  // pre-live effective squad timing, byte-identical to pre-ADR-0146 behavior, when no
  // session/snapshot exists yet. One query, not the DB-touching wrapper -- see this file's
  // `snapshotToFormat` import comment for why.
  const eventSession = await db.eventLiveMatchSession.findUnique({
    where: { eventMatchId },
    select: {
      clockPeriod: true,
      formatNumberOfPeriods: true,
      formatPeriodDurationMinutes: true,
      formatBreakDurationMinutes: true,
    },
  });
  const eventFormat = snapshotToFormat(eventSession);
  const periodConfig = eventFormat
    ? buildPeriodConfigFromFormat(eventFormat)
    : getEventPeriodConfig(timing.matchDurationMinutes, timing.numberOfHalves, timing.breakDurationMinutes);
  const periodOffsets = getCumulativePeriodOffsetsMs(periodConfig);

  // Total elapsed match-clock duration (both halves + tracked break, when numberOfHalves=2) --
  // previously this only ever used the full intended total regardless of what Live Reporting
  // actually reached, silently over-crediting a period abandoned before the match's later
  // periods ever started (ADR-0146 §4) -- and, before that, only the Event's single per-half
  // `matchDurationMinutes`, silently truncating the timeline at the end of the FIRST half for
  // any two-half Event match. `eventSession` absent (never live-reported) keeps the full-total
  // behavior, out of this ADR's scope.
  let matchEndMs: number | null;
  if (eventSession) {
    const resolutions = await db.matchPeriodTimingResolution.findMany({
      where: { eventMatchId, organisationId: eventMatch.organisationId },
      select: { period: true, resolvedDurationMs: true },
    });
    matchEndMs = computeResolvedMatchEndMs({ periodConfig, lastKnownPeriod: eventSession.clockPeriod, resolutions });
    matchEndMs ??= getTotalPeriodDurationMs(periodConfig);
  } else {
    matchEndMs = getTotalPeriodDurationMs(periodConfig);
  }

  const starters = await getEventStartingLineup(eventMatchId);
  const { rotations, positionChanges } = await getEventRotationsAndPositionChanges(eventMatchId, eventMatch.organisationId, periodOffsets);

  const computedIntervals = computePositionIntervals(starters, rotations, positionChanges, matchEndMs);

  const intervalRows: ActualIntervalRow[] = computedIntervals.map((interval) => ({
    playerId: interval.playerId,
    position: interval.position,
    line: interval.line ?? null,
    lane: interval.lane ?? null,
    startedAtMs: interval.startedAtMs,
    endedAtMs: interval.endedAtMs,
    source: interval.startedAtMs === 0 && starters.some((s) => s.playerId === interval.playerId)
      ? ActualIntervalSource.STARTING_LINEUP
      : ActualIntervalSource.SUBSTITUTION,
    approximateTiming: false,
  }));

  await db.$transaction(async (tx) => {
    await tx.actualPositionInterval.deleteMany({ where: { eventMatchId } });

    if (intervalRows.length > 0) {
      await tx.actualPositionInterval.createMany({
        data: intervalRows.map((row) => ({
          eventMatchId,
          organisationId: eventMatch.organisationId,
          playerId: row.playerId,
          position: row.position,
          line: row.line,
          lane: row.lane,
          startedAtMs: row.startedAtMs,
          endedAtMs: row.endedAtMs,
          source: row.source,
          approximateTiming: row.approximateTiming,
        })),
      });
    }

    await populateEventPlayerActualPositions(tx, eventMatchId, intervalRows);
  });

  return { intervalsCreated: intervalRows.length };
}

async function getEventStartingLineup(eventMatchId: string): Promise<StarterAssignment[]> {
  const lineup = await db.eventMatchLineup.findFirst({
    where: { eventMatchId },
    select: { id: true },
  });

  if (!lineup) return [];

  const assignments = await db.eventMatchLineupAssignment.findMany({
    where: { lineupId: lineup.id, playerId: { not: null } },
    select: { playerId: true, slotId: true, roleType: true },
  });

  if (assignments.length === 0) return [];

  const slotIds = assignments.map((a) => a.slotId).filter((id): id is string => id !== null);
  const slots = slotIds.length > 0
    ? await db.formationSlot.findMany({
        where: { id: { in: slotIds } },
        select: { id: true, roleType: true, label: true, gridX: true },
      })
    : [];
  const slotMap = new Map(slots.map((s) => [s.id, s]));

  return assignments
    .filter((a) => a.playerId !== null)
    .map((a) => {
      const slot = a.slotId ? slotMap.get(a.slotId) : undefined;
      const roleType = (slot?.roleType ?? a.roleType) as FormationSlotRoleType | undefined;
      return {
        playerId: a.playerId!,
        position: slot?.roleType || slot?.label || a.roleType || "unknown",
        line: roleType ? (ROLE_TYPE_TO_LINE[roleType] ?? null) : null,
        // lane needs FormationSlot.gridX (a grid coordinate) -- EventMatchLineupAssignment's
        // own x/y are free-form pitch coordinates in a different space, not interchangeable.
        // Stays unknown (never guessed) when no linked FormationSlot is available.
        lane: slot ? laneFromGridX(slot.gridX) : null,
      };
    });
}

async function getEventRotationsAndPositionChanges(
  eventMatchId: string,
  organisationId: string,
  periodOffsets: Partial<Record<MatchPeriod, number>>,
): Promise<{
  rotations: RotationInput[];
  positionChanges: PositionChangeInput[];
}> {
  const eventRows = await db.eventLiveMatchEvent.findMany({
    where: {
      eventMatchId,
      eventType: { in: ["ROTATION_OUT", "ROTATION_IN", "POSITIONS_CHANGED"] },
      correctionType: null,
    },
    select: { id: true, eventType: true, playerId: true, payload: true, period: true, matchSeconds: true, createdAt: true },
    orderBy: [{ period: "asc" }, { matchSeconds: "asc" }, { createdAt: "asc" }],
  });

  // A reversed ROTATION_OUT/ROTATION_IN/POSITIONS_CHANGED event must not survive into actual-
  // timeline reconstruction — `correctionType: null` above only excludes the reversal *marker*
  // row, not the original row it targets (ARR-0047's own finding, recurring here independently;
  // Event has no League-equivalent `MatchRotation` staging table to have already filtered this
  // upstream, unlike `getMatchRotations()` above). Found during ADR-0138 Bundle 9's
  // evidence-consumer audit, closed with the shared reversal-resolution helper.
  const reversedEventIds = await getEventReversedEventIds(eventMatchId, organisationId);
  const events = eventRows.filter((e) => !reversedEventIds.has(e.id));

  const rotations: RotationInput[] = [];
  const positionChanges: PositionChangeInput[] = [];

  const outsBySeconds = new Map<number, string[]>();
  const insBySeconds = new Map<number, string[]>();

  for (const e of events) {
    if (!e.playerId) continue;
    // Absolute match-clock ms since kickoff -- EventLiveMatchEvent.period is already a
    // MatchPeriod enum value (unlike League's LiveMatchEvent.period int index), so no
    // MATCH_PERIOD_ORDER lookup is needed here.
    const seconds = toAbsoluteMatchMs(e.period, sanitizePeriodOffsetMs(e.matchSeconds), periodOffsets);
    if (e.eventType === "ROTATION_OUT") {
      const list = outsBySeconds.get(seconds) ?? [];
      list.push(e.playerId);
      outsBySeconds.set(seconds, list);
    } else if (e.eventType === "ROTATION_IN") {
      const list = insBySeconds.get(seconds) ?? [];
      list.push(e.playerId);
      insBySeconds.set(seconds, list);
    } else if (e.eventType === "POSITIONS_CHANGED") {
      const payload = e.payload as Record<string, unknown> | null;
      positionChanges.push({
        playerId: e.playerId,
        fromPosition: (payload?.fromPosition as string) ?? "unknown",
        toPosition: (payload?.toPosition as string) ?? "unknown",
        matchSeconds: seconds,
      });
    }
  }

  for (const [seconds, outs] of outsBySeconds) {
    const ins = insBySeconds.get(seconds) ?? [];
    const pairCount = Math.min(outs.length, ins.length);
    for (let i = 0; i < pairCount; i++) {
      rotations.push({
        outPlayerId: outs[i],
        inPlayerId: ins[i],
        outPosition: null,
        inPosition: null,
        positionOnly: false,
        matchSeconds: seconds,
      });
    }
    // An OUT with no matching IN at the same timestamp is skipped -- no interval is
    // invented for a substitution this data cannot actually reconstruct.
  }

  return { rotations, positionChanges };
}

async function populateEventPlayerActualPositions(
  tx: { eventPostMatchPlayer: { findMany: typeof db.eventPostMatchPlayer.findMany; update: typeof db.eventPostMatchPlayer.update } },
  eventMatchId: string,
  intervals: ActualIntervalRow[],
): Promise<void> {
  const report = await db.eventPostMatchReport.findFirst({
    where: { eventMatchId },
    select: { id: true },
  });
  if (!report) return;

  const minutesByPlayer = new Map<string, number>();
  for (const interval of intervals) {
    if (interval.position === "BENCH") continue;
    const durationMs = (interval.endedAtMs ?? interval.startedAtMs) - interval.startedAtMs;
    minutesByPlayer.set(interval.playerId, (minutesByPlayer.get(interval.playerId) ?? 0) + durationMs / 60000);
  }

  const actuals = await tx.eventPostMatchPlayer.findMany({
    where: { reportId: report.id },
    select: { id: true, playerId: true, minutesPlayed: true },
  });

  for (const actual of actuals) {
    // ADR-0106: EventPostMatchPlayer.playerId is now nullable (a GuestPlayer appearance uses
    // guestPlayerId instead). Syncing computed minutes onto a GuestPlayer's own row is a later,
    // separate change (needs guestPlayerId-keyed lookup too) -- skipped here as a no-op today.
    if (!actual.playerId) continue;
    const minutes = minutesByPlayer.get(actual.playerId);
    if (minutes !== undefined && actual.minutesPlayed === null) {
      await tx.eventPostMatchPlayer.update({
        where: { id: actual.id },
        data: { minutesPlayed: Math.round(minutes) },
      });
    }
  }
}

async function getStartingLineup(matchId: string): Promise<StarterAssignment[]> {
  const lineup = await db.matchLineup.findFirst({
    where: { matchId },
    select: { id: true },
  });

  if (!lineup) return [];

  const assignments = await db.matchLineupAssignment.findMany({
    where: { matchLineupId: lineup.id, playerId: { not: null } },
    select: {
      playerId: true,
      slotId: true,
    },
  });

  if (assignments.length === 0) return [];

  const slotIds = assignments.map((a) => a.slotId);
  const slots = await db.formationSlot.findMany({
    where: { id: { in: slotIds } },
    select: { id: true, roleType: true, label: true, gridX: true },
  });

  const slotMap = new Map(slots.map((s) => [s.id, s]));

  return assignments
    .filter((a) => a.playerId !== null)
    .map((a) => {
      const slot = slotMap.get(a.slotId);
      const roleType = slot?.roleType as FormationSlotRoleType | undefined;
      return {
        playerId: a.playerId!,
        position: slot?.roleType || slot?.label || "unknown",
        line: roleType ? (ROLE_TYPE_TO_LINE[roleType] ?? null) : null,
        lane: slot ? laneFromGridX(slot.gridX) : null,
      };
    });
}

async function getMatchRotations(
  matchId: string,
  periodOffsets: Partial<Record<MatchPeriod, number>>,
): Promise<RotationInput[]> {
  const rotations = await db.matchRotation.findMany({
    where: { matchId, outPlayerId: { not: null }, inPlayerId: { not: null } },
    select: {
      outPlayerId: true,
      inPlayerId: true,
      outPosition: true,
      inPosition: true,
      positionOnly: true,
      period: true,
      matchSeconds: true,
    },
    orderBy: [{ period: "asc" }, { matchSeconds: "asc" }],
  });

  // ADR-0106: MatchRotation.outPlayerId/inPlayerId are now nullable (a GuestPlayer rotation side
  // uses outGuestPlayerId/inGuestPlayerId instead). This position/interval computation layer is
  // already participant-agnostic (lineup-state.ts operates on opaque string ids with no Player
  // lookup) -- carrying a guest's rotation through here is a later, separate change (needs a
  // resolved outPlayerId ?? outGuestPlayerId per side); filtered to Player-only rotations here
  // as a no-op today (no write path produces a guest rotation yet).
  return rotations
    .map((r) => ({
      outPlayerId: r.outPlayerId!,
      inPlayerId: r.inPlayerId!,
      outPosition: r.outPosition,
      inPosition: r.inPosition,
      positionOnly: r.positionOnly,
      matchSeconds: toAbsoluteMatchMs(MATCH_PERIOD_ORDER[r.period], sanitizePeriodOffsetMs(r.matchSeconds), periodOffsets),
    }))
    .sort((a, b) => a.matchSeconds - b.matchSeconds);
}

async function getPositionChanges(
  matchId: string,
  organisationId: string,
  periodOffsets: Partial<Record<MatchPeriod, number>>,
): Promise<PositionChangeInput[]> {
  const eventRows = await db.liveMatchEvent.findMany({
    where: {
      matchId,
      eventType: "POSITIONS_CHANGED",
      correctionType: null,
    },
    select: {
      id: true,
      playerId: true,
      payload: true,
      period: true,
      matchSeconds: true,
    },
    orderBy: [{ period: "asc" }, { matchSeconds: "asc" }],
  });

  // A reversed POSITIONS_CHANGED event must not survive into actual-timeline reconstruction —
  // `correctionType: null` above only excludes the reversal *marker* row, not the original row
  // it targets (ARR-0047's own finding, recurring here independently; found during ADR-0138
  // Bundle 9's evidence-consumer audit, closed with the shared reversal-resolution helper).
  const reversedEventIds = await getLeagueReversedEventIds(matchId, organisationId);
  const events = eventRows.filter((e) => !reversedEventIds.has(e.id));

  return events
    .filter((e) => e.playerId && e.payload)
    .map((e) => {
      const payload = e.payload as Record<string, unknown> | null;
      return {
        playerId: e.playerId!,
        fromPosition: (payload?.fromPosition as string) ?? "unknown",
        toPosition: (payload?.toPosition as string) ?? "unknown",
        matchSeconds: toAbsoluteMatchMs(
          e.period != null ? MATCH_PERIOD_ORDER[e.period] : null,
          sanitizePeriodOffsetMs(e.matchSeconds),
          periodOffsets,
        ),
      };
    })
    .sort((a, b) => a.matchSeconds - b.matchSeconds);
}

function inferSource(
  interval: { playerId: string; position: string; startedAtMs: number; endedAtMs: number | null },
  starters: StarterAssignment[],
): ActualIntervalSource {
  const isStarter = starters.some((s) => s.playerId === interval.playerId) && interval.startedAtMs === 0;

  if (isStarter) {
    return ActualIntervalSource.STARTING_LINEUP;
  }

  return ActualIntervalSource.SUBSTITUTION;
}

async function populatePlayerActualPositions(
  tx: { postMatchPlayerActual: { findMany: typeof db.postMatchPlayerActual.findMany; update: typeof db.postMatchPlayerActual.update } },
  matchId: string,
  intervals: ActualIntervalRow[],
): Promise<void> {
  const playerPositionMap = new Map<string, Set<string>>();

  for (const interval of intervals) {
    if (interval.position !== "BENCH" && interval.position !== "unknown") {
      const positions = playerPositionMap.get(interval.playerId) ?? new Set<string>();
      positions.add(interval.position);
      playerPositionMap.set(interval.playerId, positions);
    }
  }

  const actuals = await tx.postMatchPlayerActual.findMany({
    where: { matchId },
    select: { id: true, playerId: true },
  });

  for (const actual of actuals) {
    // ADR-0106: PostMatchPlayerActual.playerId is now nullable (a GuestPlayer appearance uses
    // guestPlayerId instead). Syncing computed positions onto a GuestPlayer's own row is a
    // later, separate change (needs guestPlayerId-keyed lookup too) -- skipped as a no-op today.
    if (!actual.playerId) continue;
    const positions = playerPositionMap.get(actual.playerId);
    if (positions && positions.size > 0) {
      await tx.postMatchPlayerActual.update({
        where: { id: actual.id },
        data: { actualPositions: [...positions] },
      });
    }
  }
}

export async function getActualPositionIntervals(
  matchId: string,
): Promise<ActualIntervalRow[]> {
  const rows = await db.actualPositionInterval.findMany({
    where: { matchId },
    orderBy: [{ startedAtMs: "asc" }],
  });

  // ADR-0106: ActualPositionInterval.playerId is now nullable, with guestPlayerId as the
  // alternative identity (exactly one of the two is always set -- enforced by a CHECK
  // constraint). This position/interval computation layer is already participant-agnostic
  // (lineup-state.ts operates on opaque string ids with no Player lookup), so resolving
  // whichever id is set is a correct, forward-compatible read -- not a placeholder -- rather
  // than a Player-only filter: a future GuestPlayer interval flows through this exact code
  // unchanged once a write path populates guestPlayerId.
  return rows.map((r) => ({
    playerId: (r.playerId ?? r.guestPlayerId)!,
    position: r.position,
    line: r.line,
    lane: r.lane,
    startedAtMs: r.startedAtMs,
    endedAtMs: r.endedAtMs,
    source: r.source as ActualIntervalSource,
    approximateTiming: r.approximateTiming,
  }));
}

export async function getActualPositionIntervalsForRef(ref: FootballMatchRef): Promise<ActualIntervalRow[]> {
  const rows = await db.actualPositionInterval.findMany({
    where: ref.kind === "LEAGUE_MATCH" ? { matchId: ref.matchId } : { eventMatchId: ref.eventMatchId },
    orderBy: [{ startedAtMs: "asc" }],
  });

  // ADR-0106: ActualPositionInterval.playerId is now nullable, with guestPlayerId as the
  // alternative identity (exactly one of the two is always set -- enforced by a CHECK
  // constraint). This position/interval computation layer is already participant-agnostic
  // (lineup-state.ts operates on opaque string ids with no Player lookup), so resolving
  // whichever id is set is a correct, forward-compatible read -- not a placeholder -- rather
  // than a Player-only filter: a future GuestPlayer interval flows through this exact code
  // unchanged once a write path populates guestPlayerId.
  return rows.map((r) => ({
    playerId: (r.playerId ?? r.guestPlayerId)!,
    position: r.position,
    line: r.line,
    lane: r.lane,
    startedAtMs: r.startedAtMs,
    endedAtMs: r.endedAtMs,
    source: r.source as ActualIntervalSource,
    approximateTiming: r.approximateTiming,
  }));
}

export async function getPlayerPositionIntervals(
  matchId: string,
  playerId: string,
): Promise<ActualIntervalRow[]> {
  const rows = await db.actualPositionInterval.findMany({
    where: { matchId, playerId },
    orderBy: [{ startedAtMs: "asc" }],
  });

  // ADR-0106: ActualPositionInterval.playerId is now nullable, with guestPlayerId as the
  // alternative identity (exactly one of the two is always set -- enforced by a CHECK
  // constraint). This position/interval computation layer is already participant-agnostic
  // (lineup-state.ts operates on opaque string ids with no Player lookup), so resolving
  // whichever id is set is a correct, forward-compatible read -- not a placeholder -- rather
  // than a Player-only filter: a future GuestPlayer interval flows through this exact code
  // unchanged once a write path populates guestPlayerId.
  return rows.map((r) => ({
    playerId: (r.playerId ?? r.guestPlayerId)!,
    position: r.position,
    line: r.line,
    lane: r.lane,
    startedAtMs: r.startedAtMs,
    endedAtMs: r.endedAtMs,
    source: r.source as ActualIntervalSource,
    approximateTiming: r.approximateTiming,
  }));
}

export async function getPlayerMatchPositions(
  matchId: string,
  playerId: string,
): Promise<string[]> {
  const intervals = await getPlayerPositionIntervals(matchId, playerId);
  return [...new Set(intervals.filter((i) => i.position !== "BENCH" && i.position !== "unknown").map((i) => i.position))];
}