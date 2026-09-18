/**
 * Small, pure display-label formatters shared across the Match Details + Post-Match Report
 * surfaces. Moved out of the former monolithic `match-detail.tsx` so every new leaf component can
 * reuse the same wording without re-implementing it.
 */

export function formatMatchType(type: string): string {
  const map: Record<string, string> = {
    LEAGUE: "League",
    FRIENDLY: "Friendly",
    CUP: "Cup",
    DEVELOPMENT: "Development",
  };
  return map[type] ?? type;
}

export function formatGameFormat(format: string): string {
  const map: Record<string, string> = {
    THREE_A_SIDE: "3-a-side",
    FIVE_A_SIDE: "5-a-side",
    SEVEN_A_SIDE: "7-a-side",
    NINE_A_SIDE: "9-a-side",
    ELEVEN_A_SIDE: "11-a-side",
  };
  return map[format] ?? format;
}

export function formatVenue(venue: string): string {
  return venue === "HOME" ? "Home" : "Away";
}

export function formatMatchFit(fit: string): string {
  const map: Record<string, string> = {
    UNKNOWN: "Not evaluated",
    TOO_EASY: "Too easy",
    GOOD_FIT: "Good fit",
    TOO_HARD: "Too hard",
    CHAOTIC: "Chaotic",
    SUPPORT_OVERPOWERED: "Support overpowered",
    SUPPORT_TOO_LOW: "Support too low",
  };
  return map[fit] ?? fit;
}

/** `TeamReflection`'s free-text rating columns are constrained by the UI to `STRONG | OK |
 * NEEDS_ATTENTION` (`RATING_OPTIONS` in `team-reflection-section.tsx`) even though the DB column
 * itself is a plain nullable string. */
export function formatReflectionRating(value: string | null): string {
  if (!value) return "Not recorded";
  const map: Record<string, string> = {
    STRONG: "Strong",
    OK: "OK",
    NEEDS_ATTENTION: "Needs attention",
  };
  return map[value] ?? value;
}

export function formatOpponentEnvironment(value: string | null): string | null {
  if (!value || value === "NOT_ASSESSED") return null;
  const map: Record<string, string> = {
    POSITIVE: "Positive",
    ACCEPTABLE: "Acceptable",
    CONCERN: "Concern",
    SERIOUS_CONCERN: "Serious concern",
  };
  return map[value] ?? value;
}

/** Builds the compact `date · kickoff · home/away · type · format[ · round]` meta line used by
 * both Match Details and Post-Match Report headers. */
export function buildMatchMetaLine(input: {
  dateLabel: string | null;
  kickoffTimeLabel: string | null;
  venue: string;
  matchType: string;
  gameFormat: string;
  roundLabel?: string | null;
}): string {
  const parts = [
    input.dateLabel,
    input.kickoffTimeLabel,
    formatVenue(input.venue),
    formatMatchType(input.matchType),
    formatGameFormat(input.gameFormat),
    input.roundLabel ?? null,
  ].filter((part): part is string => Boolean(part));
  return parts.join(" · ");
}
