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

export function getEventPeriodConfig(matchDurationMinutes: number | null): PeriodConfig[] {
  const durationMs = matchDurationMinutes != null ? matchDurationMinutes * 60 * 1000 : null;

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