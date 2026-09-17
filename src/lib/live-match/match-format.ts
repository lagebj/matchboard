/**
 * Shared match-format domain (ADR-0146). One `MatchFormatDefinition` shape and one set of
 * validation bounds for both League and Event matches, generalized from Event's pre-existing
 * `numberOfHalves`/`matchDurationMinutes`/`breakDurationMinutes` model
 * (`src/lib/events/event-types.ts`) rather than duplicated for League.
 *
 * `numberOfPeriods` is validated to `{1, 2}`, not the full range a general "match format" domain
 * might otherwise allow — see ADR-0146's "Adaptation: numberOfPeriods range" section. Matchboard's
 * live clock is built on the fixed `MatchPeriod` enum (`BEFORE`/`FIRST_HALF`/`HALF_TIME`/
 * `SECOND_HALF`/`EXTRA_*`/`FULL_TIME`), shared by the Prisma schema, `match-clock.ts`'s
 * `advancePeriod`, and the Cloudflare Durable Object worker's own protocol; only 1 or 2 regular
 * playing periods are representable without redesigning that shared model, which is out of scope
 * here.
 */

export interface MatchFormatDefinition {
  numberOfPeriods: number;
  periodDurationMinutes: number;
  breakDurationMinutes: number;
}

export const MATCH_FORMAT_NUMBER_OF_PERIODS_OPTIONS = [1, 2] as const;
export const MATCH_FORMAT_PERIOD_DURATION_MIN_MINUTES = 1;
export const MATCH_FORMAT_PERIOD_DURATION_MAX_MINUTES = 120;
export const MATCH_FORMAT_BREAK_DURATION_MIN_MINUTES = 0;
export const MATCH_FORMAT_BREAK_DURATION_MAX_MINUTES = 60;

export type MatchFormatValidationError =
  | "NUMBER_OF_PERIODS_INVALID"
  | "PERIOD_DURATION_OUT_OF_RANGE"
  | "BREAK_DURATION_OUT_OF_RANGE";

/**
 * Validates a candidate format against the domain bounds (ADR-0146 §1, generalizing bundle
 * §02.10). Does not validate "completeness" (all-three-or-none) — that is a caller concern
 * specific to where the override lives (season default vs. team/match override).
 */
export function validateMatchFormatDefinition(format: MatchFormatDefinition): MatchFormatValidationError[] {
  const errors: MatchFormatValidationError[] = [];

  if (!MATCH_FORMAT_NUMBER_OF_PERIODS_OPTIONS.includes(format.numberOfPeriods as 1 | 2)) {
    errors.push("NUMBER_OF_PERIODS_INVALID");
  }

  if (
    !Number.isFinite(format.periodDurationMinutes) ||
    format.periodDurationMinutes < MATCH_FORMAT_PERIOD_DURATION_MIN_MINUTES ||
    format.periodDurationMinutes > MATCH_FORMAT_PERIOD_DURATION_MAX_MINUTES
  ) {
    errors.push("PERIOD_DURATION_OUT_OF_RANGE");
  }

  if (
    !Number.isFinite(format.breakDurationMinutes) ||
    format.breakDurationMinutes < MATCH_FORMAT_BREAK_DURATION_MIN_MINUTES ||
    format.breakDurationMinutes > MATCH_FORMAT_BREAK_DURATION_MAX_MINUTES
  ) {
    errors.push("BREAK_DURATION_OUT_OF_RANGE");
  }

  return errors;
}

export function isValidMatchFormatDefinition(format: MatchFormatDefinition): boolean {
  return validateMatchFormatDefinition(format).length === 0;
}

/** A row's three override fields, all-or-nothing (ADR-0146 §1 — "complete definition, never a
 * field-by-field merge"). `LeagueSeason`'s default fields use the same shape/helper. */
export interface MatchFormatOverrideFields {
  numberOfPeriodsOverride: number | null;
  periodDurationMinutesOverride: number | null;
  breakDurationMinutesOverride: number | null;
}

export interface LeagueSeasonDefaultFormatFields {
  defaultNumberOfPeriods: number | null;
  defaultPeriodDurationMinutes: number | null;
  defaultBreakDurationMinutes: number | null;
}

/**
 * Reads a complete override from a row's three nullable fields, or `null` if any of the three is
 * unset. A row with exactly one or two of the three fields set is treated as "no override" here
 * (the write path — see the League actions in this same programme's UI slice — is responsible for
 * rejecting a partial write before it ever reaches storage; this resolver never partially trusts
 * one).
 */
function readCompleteOverride(fields: {
  numberOfPeriods: number | null;
  periodDurationMinutes: number | null;
  breakDurationMinutes: number | null;
}): MatchFormatDefinition | null {
  if (
    fields.numberOfPeriods == null ||
    fields.periodDurationMinutes == null ||
    fields.breakDurationMinutes == null
  ) {
    return null;
  }
  return {
    numberOfPeriods: fields.numberOfPeriods,
    periodDurationMinutes: fields.periodDurationMinutes,
    breakDurationMinutes: fields.breakDurationMinutes,
  };
}

/**
 * League match-format precedence (ADR-0146 §1, bundle §02.2): Match override > Team override >
 * LeagueSeason default > unconfigured (`null`). The closest configured scope wins as a *complete*
 * format — never a field-by-field merge across scopes.
 */
export function resolveLeagueMatchFormat(params: {
  season: LeagueSeasonDefaultFormatFields | null;
  team: MatchFormatOverrideFields | null;
  match: MatchFormatOverrideFields | null;
}): MatchFormatDefinition | null {
  const matchOverride = params.match
    ? readCompleteOverride({
        numberOfPeriods: params.match.numberOfPeriodsOverride,
        periodDurationMinutes: params.match.periodDurationMinutesOverride,
        breakDurationMinutes: params.match.breakDurationMinutesOverride,
      })
    : null;
  if (matchOverride) return matchOverride;

  const teamOverride = params.team
    ? readCompleteOverride({
        numberOfPeriods: params.team.numberOfPeriodsOverride,
        periodDurationMinutes: params.team.periodDurationMinutesOverride,
        breakDurationMinutes: params.team.breakDurationMinutesOverride,
      })
    : null;
  if (teamOverride) return teamOverride;

  const seasonDefault = params.season
    ? readCompleteOverride({
        numberOfPeriods: params.season.defaultNumberOfPeriods,
        periodDurationMinutes: params.season.defaultPeriodDurationMinutes,
        breakDurationMinutes: params.season.defaultBreakDurationMinutes,
      })
    : null;
  if (seasonDefault) return seasonDefault;

  return null;
}

/**
 * Adapts Event's existing effective-format resolution (`getEffectiveEventSquadMatchTiming`,
 * `src/lib/events/event-types.ts`) into the shared `MatchFormatDefinition` shape. Event's own
 * override fields/resolvers are unchanged by this — this is an adapter, not a replacement, per
 * ADR-0146 §1 ("retain all current Event-specific configuration behavior outside these three
 * timing values"). Returns `null` only when Event's own duration is unset (mirrors
 * `matchDurationMinutes: number | null` — `numberOfHalves` always has a default, so Event is
 * "unconfigured" only when duration was never set).
 */
export function eventSquadMatchTimingToFormat(timing: {
  numberOfHalves: number;
  matchDurationMinutes: number | null;
  breakDurationMinutes: number | null;
}): MatchFormatDefinition | null {
  if (timing.matchDurationMinutes == null) return null;
  return {
    numberOfPeriods: timing.numberOfHalves,
    periodDurationMinutes: timing.matchDurationMinutes,
    breakDurationMinutes: timing.breakDurationMinutes ?? 0,
  };
}

/** Source of a frozen match-format snapshot (diagnostic metadata only — see ADR-0146 §1). */
export type MatchFormatSnapshotSource = "SEASON" | "TEAM" | "MATCH" | "EVENT";

/**
 * Which scope a resolved League format actually came from, for snapshot diagnostics
 * (`LiveMatchSession.formatSource`). Mirrors `resolveLeagueMatchFormat`'s own precedence walk so
 * the two can never disagree.
 */
export function resolveLeagueMatchFormatSource(params: {
  season: LeagueSeasonDefaultFormatFields | null;
  team: MatchFormatOverrideFields | null;
  match: MatchFormatOverrideFields | null;
}): MatchFormatSnapshotSource | null {
  if (
    params.match &&
    readCompleteOverride({
      numberOfPeriods: params.match.numberOfPeriodsOverride,
      periodDurationMinutes: params.match.periodDurationMinutesOverride,
      breakDurationMinutes: params.match.breakDurationMinutesOverride,
    })
  ) {
    return "MATCH";
  }
  if (
    params.team &&
    readCompleteOverride({
      numberOfPeriods: params.team.numberOfPeriodsOverride,
      periodDurationMinutes: params.team.periodDurationMinutesOverride,
      breakDurationMinutes: params.team.breakDurationMinutesOverride,
    })
  ) {
    return "TEAM";
  }
  if (
    params.season &&
    readCompleteOverride({
      numberOfPeriods: params.season.defaultNumberOfPeriods,
      periodDurationMinutes: params.season.defaultPeriodDurationMinutes,
      breakDurationMinutes: params.season.defaultBreakDurationMinutes,
    })
  ) {
    return "SEASON";
  }
  return null;
}

/**
 * Expected total wall-clock duration for a format, for warning calculations only (ADR-0146 §3,
 * bundle §02.11). Never used to automatically end a match or a period.
 */
export function getExpectedWallClockDurationMinutes(format: MatchFormatDefinition): number {
  const playing = format.numberOfPeriods * format.periodDurationMinutes;
  const breaks = Math.max(format.numberOfPeriods - 1, 0) * format.breakDurationMinutes;
  return playing + breaks;
}
