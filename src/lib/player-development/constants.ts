export const RATING_ATTRIBUTE_KEYS = [
  "ballControl",
  "passing",
  "firstTouch",
  "oneVOneAttacking",
  "positioning",
  "oneVOneDefending",
  "decisionMaking",
  "effort",
  "teamplay",
  "concentration",
  "speed",
  "strength",
] as const;

export type DevelopmentAttributeKey = (typeof RATING_ATTRIBUTE_KEYS)[number];