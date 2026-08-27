export const DEVELOPMENT_FOCUS_CATEGORIES = [
  "POSITIONAL_DISCIPLINE",
  "CONFIDENCE_REBUILD",
  "CHALLENGE_EXPOSURE",
  "TEAM_FIRST_BEHAVIOUR",
  "RESET_AFTER_ERROR",
  "SUPPORT_TEAMMATES",
  "PLAY_THROUGH_TEAM",
  "BALL_CONTROL",
  "DECISION_MAKING",
  "EFFORT_AND_INTENSITY",
  "POSITIONAL_LEARNING",
  "GOALKEEPING",
] as const;

export type DevelopmentFocusCategory = (typeof DEVELOPMENT_FOCUS_CATEGORIES)[number];

export const DEVELOPMENT_FOCUS_CATEGORY_LABELS: Record<DevelopmentFocusCategory, string> = {
  POSITIONAL_DISCIPLINE: "Positional discipline",
  CONFIDENCE_REBUILD: "Confidence rebuild",
  CHALLENGE_EXPOSURE: "Challenge exposure",
  TEAM_FIRST_BEHAVIOUR: "Team-first behaviour",
  RESET_AFTER_ERROR: "Reset after error",
  SUPPORT_TEAMMATES: "Support teammates",
  PLAY_THROUGH_TEAM: "Play through team",
  BALL_CONTROL: "Ball control",
  DECISION_MAKING: "Decision making",
  EFFORT_AND_INTENSITY: "Effort & intensity",
  POSITIONAL_LEARNING: "Positional learning",
  GOALKEEPING: "Goalkeeping",
};