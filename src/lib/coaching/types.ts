export const COACHING_INTENT_CATEGORIES = [
  "TEAM_FIRST",
  "RESET_AFTER_ERROR",
  "SUPPORT_TEAMMATES",
  "POSITIONAL_DISCIPLINE",
  "PLAY_THROUGH_TEAM",
  "DEFENSIVE_RECOVERY",
  "CONFIDENCE_REBUILD",
  "CHALLENGE_EXPOSURE",
  "STABILIZE_WEAKER_TEAM",
  "PROTECT_MATCH_FUNCTION",
] as const;

export type CoachingIntentCategory = (typeof COACHING_INTENT_CATEGORIES)[number];

export const COACHING_INTENT_SCOPE_TYPES = [
  "PLANNING_PERIOD",
  "MATCH_ROUND",
  "MATCH",
  "TEAM",
  "SELECTION",
] as const;

export type CoachingIntentScopeType = (typeof COACHING_INTENT_SCOPE_TYPES)[number];

export const COACHING_INTENT_LABELS: Record<CoachingIntentCategory, string> = {
  TEAM_FIRST: "Team first",
  RESET_AFTER_ERROR: "Reset after error",
  SUPPORT_TEAMMATES: "Support teammates",
  POSITIONAL_DISCIPLINE: "Positional discipline",
  PLAY_THROUGH_TEAM: "Play through team",
  DEFENSIVE_RECOVERY: "Defensive recovery",
  CONFIDENCE_REBUILD: "Confidence rebuild",
  CHALLENGE_EXPOSURE: "Challenge exposure",
  STABILIZE_WEAKER_TEAM: "Stabilize weaker team",
  PROTECT_MATCH_FUNCTION: "Protect match function",
};

export const MATCHDAY_RESPONSIBILITIES = [
  "STABILIZER",
  "CONNECTOR",
  "RECOVERY_LEADER",
  "WIDTH_HOLDER",
  "CHALLENGE_PLAYER",
  "CONFIDENCE_REBUILD_PLAYER",
] as const;

export type MatchdayResponsibilityType = (typeof MATCHDAY_RESPONSIBILITIES)[number];

export const MATCHDAY_RESPONSIBILITY_LABELS: Record<MatchdayResponsibilityType, string> = {
  STABILIZER: "Stabilizer",
  CONNECTOR: "Connector",
  RECOVERY_LEADER: "Recovery leader",
  WIDTH_HOLDER: "Width holder",
  CHALLENGE_PLAYER: "Challenge player",
  CONFIDENCE_REBUILD_PLAYER: "Confidence rebuild player",
};

export const MATCHDAY_RESPONSIBILITY_DESCRIPTIONS: Record<MatchdayResponsibilityType, string> = {
  STABILIZER: "Helps the team stay calm, connected, and organized",
  CONNECTOR: "Looks for simple team actions and helps involve teammates",
  RECOVERY_LEADER: "Reacts quickly after ball loss and models reset behavior",
  WIDTH_HOLDER: "Protects team shape and avoids unnecessary central crowding",
  CHALLENGE_PLAYER: "Receives a harder match context because effort and readiness support it",
  CONFIDENCE_REBUILD_PLAYER: "Receives a safer or clearer context with specific success criteria",
};

export const READINESS_SIGNAL_TYPES = [
  "EFFORT_TREND",
  "ATTENDANCE_RELIABILITY",
  "LEARNING_BEHAVIOR",
  "TEAM_FIRST_BEHAVIOR",
  "RESET_AFTER_ERROR_RELIABILITY",
  "COACH_TRUST",
] as const;

export type ReadinessSignalType = (typeof READINESS_SIGNAL_TYPES)[number];

export const READINESS_SIGNAL_VALUES = [
  "RISING",
  "STABLE",
  "FALLING",
  "HIGH",
  "MEDIUM",
  "LOW",
  "STRONG",
  "OK",
  "NEEDS_ATTENTION",
] as const;

export type ReadinessSignalValue = (typeof READINESS_SIGNAL_VALUES)[number];

export const READINESS_SIGNAL_VALID_VALUES: Record<ReadinessSignalType, ReadinessSignalValue[]> = {
  EFFORT_TREND: ["RISING", "STABLE", "FALLING"],
  ATTENDANCE_RELIABILITY: ["HIGH", "MEDIUM", "LOW"],
  LEARNING_BEHAVIOR: ["STRONG", "OK", "NEEDS_ATTENTION"],
  TEAM_FIRST_BEHAVIOR: ["STRONG", "OK", "NEEDS_ATTENTION"],
  RESET_AFTER_ERROR_RELIABILITY: ["STRONG", "OK", "NEEDS_ATTENTION"],
  COACH_TRUST: ["HIGH", "MEDIUM", "LOW"],
};

export const READINESS_SIGNAL_LABELS: Record<ReadinessSignalType, string> = {
  EFFORT_TREND: "Effort trend",
  ATTENDANCE_RELIABILITY: "Attendance reliability",
  LEARNING_BEHAVIOR: "Learning behavior",
  TEAM_FIRST_BEHAVIOR: "Team-first behavior",
  RESET_AFTER_ERROR_RELIABILITY: "Reset-after-error reliability",
  COACH_TRUST: "Coach trust",
};

export const READINESS_VALUE_LABELS: Record<ReadinessSignalValue, string> = {
  RISING: "rising",
  STABLE: "stable",
  FALLING: "falling",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  STRONG: "strong",
  OK: "ok",
  NEEDS_ATTENTION: "needs attention",
};

export const FEEDBACK_VALUES = [
  "POSITIVE",
  "NEUTRAL",
  "NEEDS_ATTENTION",
] as const;

export type FeedbackValue = (typeof FEEDBACK_VALUES)[number];

export const FEEDBACK_VALUE_LABELS: Record<FeedbackValue, string> = {
  POSITIVE: "Positive",
  NEUTRAL: "Neutral",
  NEEDS_ATTENTION: "Needs attention",
};

export const FEEDBACK_CATEGORIES = [
  "EFFORT",
  "TEAM_HELP",
  "RESET_AFTER_MISTAKE",
  "POSITIONAL_DISCIPLINE",
  "TEAMMATE_INVOLVEMENT",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  EFFORT: "Effort",
  TEAM_HELP: "Team help",
  RESET_AFTER_MISTAKE: "Reset after mistake",
  POSITIONAL_DISCIPLINE: "Positional discipline",
  TEAMMATE_INVOLVEMENT: "Teammate involvement",
};

export const FEEDBACK_NEXT_ACTIONS = [
  "NO_ACTION",
  "MONITOR",
  "ADJUST_PLANNING",
  "COACH_CONVERSATION",
] as const;

export type FeedbackNextAction = (typeof FEEDBACK_NEXT_ACTIONS)[number];

export const NEXT_ACTION_LABELS: Record<FeedbackNextAction, string> = {
  NO_ACTION: "No action",
  MONITOR: "Monitor",
  ADJUST_PLANNING: "Adjust planning",
  COACH_CONVERSATION: "Coach conversation",
};

export const DISALLOWED_FEEDBACK_TERMS = [
  "lazy",
  "selfish",
  "bad attitude",
  "weak player",
  "not good enough",
  "useless",
  "problem player",
] as const;

export type DisallowedFeedbackTerm = (typeof DISALLOWED_FEEDBACK_TERMS)[number];

export const FEEDBACK_TO_READINESS: Record<FeedbackCategory, { signalType: ReadinessSignalType; suggestedValue: ReadinessSignalValue } | null> = {
  EFFORT: { signalType: "EFFORT_TREND", suggestedValue: "FALLING" },
  TEAM_HELP: { signalType: "TEAM_FIRST_BEHAVIOR", suggestedValue: "NEEDS_ATTENTION" },
  RESET_AFTER_MISTAKE: { signalType: "RESET_AFTER_ERROR_RELIABILITY", suggestedValue: "NEEDS_ATTENTION" },
  POSITIONAL_DISCIPLINE: { signalType: "LEARNING_BEHAVIOR", suggestedValue: "NEEDS_ATTENTION" },
  TEAMMATE_INVOLVEMENT: { signalType: "TEAM_FIRST_BEHAVIOR", suggestedValue: "NEEDS_ATTENTION" },
};

export type ReadinessSuggestion = {
  signalType: ReadinessSignalType;
  suggestedValue: ReadinessSignalValue;
  signalLabel: string;
  valueLabel: string;
};

export function getReadinessSuggestionForFeedback(
  category: string,
  value: string,
): ReadinessSuggestion | null {
  if (value !== "NEEDS_ATTENTION") return null;
  const mapping = (FEEDBACK_TO_READINESS as Record<string, { signalType: ReadinessSignalType; suggestedValue: ReadinessSignalValue } | null>)[category];
  if (!mapping) return null;
  return {
    signalType: mapping.signalType,
    suggestedValue: mapping.suggestedValue,
    signalLabel: READINESS_SIGNAL_LABELS[mapping.signalType],
    valueLabel: READINESS_VALUE_LABELS[mapping.suggestedValue],
  };
}

export const PARENT_SAFE_INTENT_MAP: Record<CoachingIntentCategory, string> = {
  TEAM_FIRST: "team balance",
  RESET_AFTER_ERROR: "development opportunity",
  SUPPORT_TEAMMATES: "team balance",
  POSITIONAL_DISCIPLINE: "positional development",
  PLAY_THROUGH_TEAM: "team experience",
  DEFENSIVE_RECOVERY: "suitable challenge",
  CONFIDENCE_REBUILD: "development opportunity",
  CHALLENGE_EXPOSURE: "suitable challenge",
  STABILIZE_WEAKER_TEAM: "squad adjustment",
  PROTECT_MATCH_FUNCTION: "match experience",
};

export const PARENT_SAFE_RESPONSIBILITY_MAP: Record<MatchdayResponsibilityType, string> = {
  STABILIZER: "team role",
  CONNECTOR: "team role",
  RECOVERY_LEADER: "team role",
  WIDTH_HOLDER: "team role",
  CHALLENGE_PLAYER: "suitable challenge",
  CONFIDENCE_REBUILD_PLAYER: "development opportunity",
};