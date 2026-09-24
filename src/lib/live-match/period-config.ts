import type { MatchPeriod, MatchType } from "@/generated/prisma/client";
import type { MatchFormatDefinition } from "./match-format";

export interface PeriodConfig {
  key: MatchPeriod;
  label: string;
  type: "playing" | "break";
  durationMs: number | null;
}

// Extra time is only a plausible outcome for a knockout-stage CUP match — ordinary LEAGUE,
// FRIENDLY, and DEVELOPMENT fixtures never go to ET. Kept as its own config (rather than only
// exposing getLeaguePeriodConfig) since it doubles as the ET-inclusive list for CUP matches.
export const LEAGUE_PERIOD_CONFIG: PeriodConfig[] = [
  { key: "BEFORE", label: "Before match", type: "break", durationMs: null },
  { key: "FIRST_HALF", label: "First half", type: "playing", durationMs: 25 * 60 * 1000 },
  { key: "HALF_TIME", label: "Half time", type: "break", durationMs: null },
  { key: "SECOND_HALF", label: "Second half", type: "playing", durationMs: 25 * 60 * 1000 },
  { key: "EXTRA_FIRST_HALF", label: "ET — 1st half", type: "playing", durationMs: 10 * 60 * 1000 },
  { key: "EXTRA_HALF_TIME", label: "ET — half time", type: "break", durationMs: null },
  { key: "EXTRA_SECOND_HALF", label: "ET — 2nd half", type: "playing", durationMs: 10 * 60 * 1000 },
  { key: "FULL_TIME", label: "Full time", type: "break", durationMs: null },
];

// Regulation time only — ending the second half ends the match outright, matching what a coach
// expects for a normal league/friendly/development fixture.
export const REGULATION_ONLY_PERIOD_CONFIG: PeriodConfig[] = [
  { key: "BEFORE", label: "Before match", type: "break", durationMs: null },
  { key: "FIRST_HALF", label: "First half", type: "playing", durationMs: 25 * 60 * 1000 },
  { key: "HALF_TIME", label: "Half time", type: "break", durationMs: null },
  { key: "SECOND_HALF", label: "Second half", type: "playing", durationMs: 25 * 60 * 1000 },
  { key: "FULL_TIME", label: "Full time", type: "break", durationMs: null },
];

export function getLeaguePeriodConfig(matchType: MatchType): PeriodConfig[] {
  return matchType === "CUP" ? LEAGUE_PERIOD_CONFIG : REGULATION_ONLY_PERIOD_CONFIG;
}

/**
 * League's period config once a match format is configured/resolved (ADR-0146) -- the frozen
 * snapshot's periods/duration/break drive the live clock instead of the hardcoded 25-minute
 * halves, while CUP extra time (a knockout mechanic outside the match-format domain's three
 * timing values) is preserved exactly as `getLeaguePeriodConfig` already provides it: the same
 * fixed 10-minute EXTRA_FIRST_HALF/EXTRA_HALF_TIME/EXTRA_SECOND_HALF periods, inserted before
 * FULL_TIME. `format: null` (unconfigured legacy season/team/match) returns
 * `getLeaguePeriodConfig(matchType)` unchanged -- byte-identical to pre-ADR-0146 behavior.
 */
export function getLeagueMatchPeriodConfig(matchType: MatchType, format: MatchFormatDefinition | null): PeriodConfig[] {
  if (!format) return getLeaguePeriodConfig(matchType);

  const base = buildPeriodConfigFromFormat(format);
  if (matchType !== "CUP") return base;

  const extraTime = LEAGUE_PERIOD_CONFIG.filter((p) => p.key.startsWith("EXTRA_"));
  return [...base.slice(0, -1), ...extraTime, base[base.length - 1]!];
}

/**
 * Builds a `PeriodConfig[]` from a resolved `MatchFormatDefinition` (ADR-0146) -- the one shared
 * builder both League and Event use once a format is configured/resolved. `numberOfPeriods` is
 * `1` (single continuous "Match" period) or `2` (First half/Half time/Second half); see
 * `match-format.ts`'s module doc comment for why the domain validates only those two values.
 * League's live clock falls back to the hardcoded `LEAGUE_PERIOD_CONFIG`/
 * `REGULATION_ONLY_PERIOD_CONFIG` below when no format is configured/resolved -- this builder is
 * never called with a null/absent format.
 */
export function buildPeriodConfigFromFormat(format: MatchFormatDefinition): PeriodConfig[] {
  const durationMs = format.periodDurationMinutes * 60 * 1000;

  if (format.numberOfPeriods === 2) {
    const breakMs = format.breakDurationMinutes * 60 * 1000;
    return [
      { key: "BEFORE", label: "Before match", type: "break", durationMs: null },
      { key: "FIRST_HALF", label: "First half", type: "playing", durationMs },
      { key: "HALF_TIME", label: "Half time", type: "break", durationMs: breakMs },
      { key: "SECOND_HALF", label: "Second half", type: "playing", durationMs },
      { key: "FULL_TIME", label: "Full time", type: "break", durationMs: null },
    ];
  }

  return [
    { key: "BEFORE", label: "Before match", type: "break", durationMs: null },
    { key: "FIRST_HALF", label: "Match", type: "playing", durationMs },
    { key: "FULL_TIME", label: "Full time", type: "break", durationMs: null },
  ];
}

// matchDurationMinutes is always the length of ONE half. For the default numberOfHalves=1 that
// is trivially the whole match (single continuous "Match" period, unchanged from before halves
// support existed). numberOfHalves=2 mirrors League's regulation-time period model exactly
// (First half/Half time/Second half) -- same MatchPeriod keys, so LiveMatchClient needs no
// changes to consume either shape.
//
// Thin wrapper over buildPeriodConfigFromFormat() (ADR-0146) -- generalized so League can share
// the same builder instead of a second implementation. Kept for every existing Event call site;
// behavior is unchanged (a null matchDurationMinutes still produces a config with durationMs:
// null entries, which buildPeriodConfigFromFormat cannot express directly since it requires a
// resolved format, so this wrapper still builds the null-tolerant shape itself rather than
// delegating when duration is unset).
export function getEventPeriodConfig(
  matchDurationMinutes: number | null,
  numberOfHalves: number = 1,
  breakDurationMinutes: number | null = null,
): PeriodConfig[] {
  if (matchDurationMinutes != null) {
    return buildPeriodConfigFromFormat({
      numberOfPeriods: numberOfHalves,
      periodDurationMinutes: matchDurationMinutes,
      breakDurationMinutes: breakDurationMinutes ?? 0,
    });
  }

  const durationMs = null;

  if (numberOfHalves === 2) {
    const breakMs = breakDurationMinutes != null ? breakDurationMinutes * 60 * 1000 : null;
    return [
      { key: "BEFORE", label: "Before match", type: "break", durationMs: null },
      { key: "FIRST_HALF", label: "First half", type: "playing", durationMs },
      { key: "HALF_TIME", label: "Half time", type: "break", durationMs: breakMs },
      { key: "SECOND_HALF", label: "Second half", type: "playing", durationMs },
      { key: "FULL_TIME", label: "Full time", type: "break", durationMs: null },
    ];
  }

  return [
    { key: "BEFORE", label: "Before match", type: "break", durationMs: null },
    { key: "FIRST_HALF", label: "Match", type: "playing", durationMs },
    { key: "FULL_TIME", label: "Full time", type: "break", durationMs: null },
  ];
}

export function getPeriodOrder(config: PeriodConfig[]): MatchPeriod[] {
  return config.map((p) => p.key);
}

export function getPeriodDurations(config: PeriodConfig[]): Record<MatchPeriod, number | null> {
  const result: Record<string, number | null> = {};
  for (const p of config) {
    result[p.key] = p.durationMs;
  }
  return result as Record<MatchPeriod, number | null>;
}

export function getPeriodLabels(config: PeriodConfig[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const p of config) {
    result[p.key] = p.label;
  }
  return result;
}

/**
 * Cumulative match-clock offset (ms since kickoff) at the START of each period, derived from a
 * period config's own durations. `matchSeconds`-style live event/rotation/position-change
 * timestamps are recorded relative to the CURRENT period only (each period's clock restarts at
 * 0 — see match-clock.ts's `advancePeriod`), so a raw timestamp from SECOND_HALF cannot be
 * compared directly against one from FIRST_HALF without adding this offset first. A period with
 * no entry in the config (e.g. an EXTRA_* key when the config has no extra-time periods) has no
 * defined offset — callers should treat that as "unknown, use 0" via `toAbsoluteMatchMs`, never
 * throw, since a stray/legacy value must not break canonical timeline reconstruction.
 */
export function getCumulativePeriodOffsetsMs(config: PeriodConfig[]): Partial<Record<MatchPeriod, number>> {
  const offsets: Partial<Record<MatchPeriod, number>> = {};
  let cumulativeMs = 0;
  for (const period of config) {
    offsets[period.key] = cumulativeMs;
    cumulativeMs += period.durationMs ?? 0;
  }
  return offsets;
}

/**
 * Converts a period-relative timestamp (as recorded on `MatchRotation`/`LiveMatchEvent`/
 * `EventLiveMatchEvent`) into one continuous absolute match-clock value in ms since kickoff.
 * Unknown period (null/undefined, or a period absent from `offsets`) falls back to offset 0 —
 * this keeps every existing single-period match (the overwhelming common case) byte-identical to
 * its pre-existing behaviour, since FIRST_HALF's own offset is always 0.
 */
export function toAbsoluteMatchMs(
  period: MatchPeriod | null | undefined,
  periodRelativeMs: number,
  offsets: Partial<Record<MatchPeriod, number>>,
): number {
  const offset = period ? (offsets[period] ?? 0) : 0;
  return offset + periodRelativeMs;
}

/**
 * Cumulative offset (ms since kickoff) at the START of each period, counting only *playing*
 * periods' durations — deliberately excluding break periods (`HALF_TIME`, `EXTRA_HALF_TIME`),
 * unlike `getCumulativePeriodOffsetsMs` above. This is the standard football convention for
 * naming a match minute ("the 67th minute", "45+2") — nobody's mental model of "minute 40"
 * counts the real wall-clock duration of the half-time break that already happened, only playing
 * time. `getCumulativePeriodOffsetsMs` is deliberately NOT reused for this: it answers a
 * different question ("what was the real elapsed wall-clock time", used by `actual-timeline.ts`
 * to order/reconstruct actual events against each other, where the true break duration matters)
 * — conflating the two would silently redefine that existing, already-shipped semantic. See
 * `computeAbsoluteMatchSecondsForPlan`'s own doc comment for why this one exists.
 */
export function getCumulativePlayingTimeOffsetsMs(config: PeriodConfig[]): Partial<Record<MatchPeriod, number>> {
  const offsets: Partial<Record<MatchPeriod, number>> = {};
  let cumulativeMs = 0;
  for (const period of config) {
    offsets[period.key] = cumulativeMs;
    if (period.type === "playing") cumulativeMs += period.durationMs ?? 0;
  }
  return offsets;
}

/**
 * ARR-0053: `PlannedRotationChange.actualMatchSeconds` is written once, at the moment a coach
 * applies a planned change live, and must be directly comparable to `approximateMatchSeconds`
 * (a flat "match minute" value the coach entered while planning — see `planned-rotation.ts`'s
 * own module doc; the form's own placeholder, "e.g. 25", has no period concept at all).
 * `estimateCurrentMatchOffsetMs()` (the only source `applyPlannedChangeAction` has for "what
 * time is it right now") returns milliseconds relative to the *current period* (ADR-0133 H3),
 * which resets to 0 at the start of `SECOND_HALF` and beyond — directly persisting that
 * period-relative value as `actualMatchSeconds` (the schema's own doc comment previously
 * asserted this was already "like-for-like," which was not checked against
 * `approximateMatchSeconds`'s actual semantics) produces a nonsensical deviation note for any
 * change applied in the second half or later: a "minute 40" plan applied on time 10 minutes into
 * the second half would read as `600 - 2400 = -1800` seconds, "applied 30 min earlier than
 * planned," when it was on time.
 *
 * Uses `getCumulativePlayingTimeOffsetsMs` (playing time only, excluding the half-time break),
 * not `getCumulativePeriodOffsetsMs` (real wall-clock, including the break) — the standard
 * football convention for a match minute, and the only reading consistent with a coach typing
 * "minute 40" into a field with zero period awareness or break-duration visibility. Using the
 * break-inclusive offset instead would still leave a deviation note off by exactly the
 * half-time break's length for any second-half-or-later comparison — a smaller bug than the
 * original, but not a fix.
 *
 * `PlannedRotationChange` has no persisted `period` column of its own (confirmed: neither
 * `approximateMatchSeconds` nor `actualMatchSeconds` has a sibling period field) — so the
 * conversion cannot happen later, at read time in `rotation-vs-actual.ts`; there is no period to
 * convert *from* once only the raw number has been stored. It must happen here, at write time,
 * while `estimateCurrentMatchOffsetMs()`'s own `period` result is still available — converting
 * to one absolute value before persisting means every later reader (including the existing
 * `rotation-vs-actual.ts` subtraction, unchanged) compares like with like.
 */
export function computeAbsoluteMatchSecondsForPlan(
  matchOffsetMs: number,
  period: MatchPeriod | null | undefined,
  periodConfig: PeriodConfig[],
): number {
  const offsets = getCumulativePlayingTimeOffsetsMs(periodConfig);
  const absoluteMs = toAbsoluteMatchMs(period, matchOffsetMs, offsets);
  return Math.max(0, Math.round(absoluteMs / 1000));
}

/**
 * Total elapsed match-clock duration (ms) implied by a period config, including any tracked
 * inter-period break (e.g. half-time) — the correct value to cap the final open-ended actual
 * position interval at, in place of a single half's duration alone. Returns null when no
 * period in the config carries a known duration (e.g. duration was never configured).
 */
export function getTotalPeriodDurationMs(config: PeriodConfig[]): number | null {
  const total = config.reduce((sum, period) => sum + (period.durationMs ?? 0), 0);
  return total > 0 ? total : null;
}

/**
 * Which playing period an absolute match-clock ms value (see `toAbsoluteMatchMs`) falls inside,
 * given a period config's known durations. Falls back to the last playing period for a value at
 * or beyond every known duration (e.g. exactly full time, or an open-ended final interval in a
 * period with no configured duration) rather than returning null — the match was still in some
 * period, and reporting "unknown" there would be less honest than naming the period it actually
 * ended in. Returns null only when the config has no playing period at all.
 */
export function resolvePeriodForAbsoluteMs(
  absoluteMs: number,
  config: PeriodConfig[],
  offsets: Partial<Record<MatchPeriod, number>> = getCumulativePeriodOffsetsMs(config),
): MatchPeriod | null {
  for (const period of config) {
    if (period.type !== "playing" || period.durationMs == null) continue;
    const start = offsets[period.key] ?? 0;
    const end = start + period.durationMs;
    if (absoluteMs >= start && absoluteMs < end) return period.key;
  }

  const playingPeriods = config.filter((p) => p.type === "playing");
  return playingPeriods.length > 0 ? playingPeriods[playingPeriods.length - 1]!.key : null;
}