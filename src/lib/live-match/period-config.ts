import type { MatchPeriod, MatchType } from "@/generated/prisma/client";

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

// matchDurationMinutes is always the length of ONE half. For the default numberOfHalves=1 that
// is trivially the whole match (single continuous "Match" period, unchanged from before halves
// support existed). numberOfHalves=2 mirrors League's regulation-time period model exactly
// (First half/Half time/Second half) -- same MatchPeriod keys, so LiveMatchClient needs no
// changes to consume either shape.
export function getEventPeriodConfig(
  matchDurationMinutes: number | null,
  numberOfHalves: number = 1,
  breakDurationMinutes: number | null = null,
): PeriodConfig[] {
  const durationMs = matchDurationMinutes != null ? matchDurationMinutes * 60 * 1000 : null;

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