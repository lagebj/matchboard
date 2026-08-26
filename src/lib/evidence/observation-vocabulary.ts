export type FootballObservationCode =
  | "SECURE_ON_BALL"
  | "FIRST_TOUCH_EFFECTIVE"
  | "PASSING_EFFECTIVE"
  | "PLAYS_THROUGH_PRESSURE"
  | "ONE_V_ONE_ATTACKING_EFFECTIVE"
  | "POSITIONING_EFFECTIVE"
  | "ONE_V_ONE_DEFENDING_EFFECTIVE"
  | "DECISION_MAKING_EFFECTIVE"
  | "WORK_RATE_EFFECTIVE"
  | "TEAM_COMBINATION_EFFECTIVE"
  | "CONCENTRATION_EFFECTIVE"
  | "PACE_EFFECTIVE"
  | "PHYSICAL_DUELS_EFFECTIVE"
  | "GOALKEEPING_EFFECTIVE";

export type ObservationPolarity = "POSITIVE" | "NEGATIVE";

export type EvidenceClass = "DIRECT" | "SUPPORTING" | "CONTEXT";

export interface ObservationDefinition {
  code: FootballObservationCode;
  positiveLabel: string;
  negativeLabel: string;
}

export const OBSERVATION_DEFINITIONS: Record<
  FootballObservationCode,
  ObservationDefinition
> = {
  SECURE_ON_BALL: {
    code: "SECURE_ON_BALL",
    positiveLabel: "Secure on the ball",
    negativeLabel: "Struggled to keep control",
  },
  FIRST_TOUCH_EFFECTIVE: {
    code: "FIRST_TOUCH_EFFECTIVE",
    positiveLabel: "Good first touch",
    negativeLabel: "First touch caused problems",
  },
  PASSING_EFFECTIVE: {
    code: "PASSING_EFFECTIVE",
    positiveLabel: "Moved the ball well",
    negativeLabel: "Passing needs attention",
  },
  PLAYS_THROUGH_PRESSURE: {
    code: "PLAYS_THROUGH_PRESSURE",
    positiveLabel: "Played through pressure",
    negativeLabel: "Struggled under pressure",
  },
  ONE_V_ONE_ATTACKING_EFFECTIVE: {
    code: "ONE_V_ONE_ATTACKING_EFFECTIVE",
    positiveLabel: "Effective 1v1",
    negativeLabel: "1v1 attacking needs attention",
  },
  POSITIONING_EFFECTIVE: {
    code: "POSITIONING_EFFECTIVE",
    positiveLabel: "Good positioning",
    negativeLabel: "Positioning needs attention",
  },
  ONE_V_ONE_DEFENDING_EFFECTIVE: {
    code: "ONE_V_ONE_DEFENDING_EFFECTIVE",
    positiveLabel: "Defended 1v1 well",
    negativeLabel: "1v1 defending needs attention",
  },
  DECISION_MAKING_EFFECTIVE: {
    code: "DECISION_MAKING_EFFECTIVE",
    positiveLabel: "Made good choices",
    negativeLabel: "Choices need attention",
  },
  WORK_RATE_EFFECTIVE: {
    code: "WORK_RATE_EFFECTIVE",
    positiveLabel: "Worked hard for the team",
    negativeLabel: "Work rate needs attention",
  },
  TEAM_COMBINATION_EFFECTIVE: {
    code: "TEAM_COMBINATION_EFFECTIVE",
    positiveLabel: "Combined well",
    negativeLabel: "Combination play needs attention",
  },
  CONCENTRATION_EFFECTIVE: {
    code: "CONCENTRATION_EFFECTIVE",
    positiveLabel: "Stayed switched on",
    negativeLabel: "Lost concentration",
  },
  PACE_EFFECTIVE: {
    code: "PACE_EFFECTIVE",
    positiveLabel: "Used pace well",
    negativeLabel: "Pace limited the situation",
  },
  PHYSICAL_DUELS_EFFECTIVE: {
    code: "PHYSICAL_DUELS_EFFECTIVE",
    positiveLabel: "Strong in duels",
    negativeLabel: "Physical duels need attention",
  },
  GOALKEEPING_EFFECTIVE: {
    code: "GOALKEEPING_EFFECTIVE",
    positiveLabel: "Effective goalkeeping",
    negativeLabel: "Goalkeeping needs attention",
  },
};

export const ALL_OBSERVATION_CODES = Object.keys(
  OBSERVATION_DEFINITIONS,
) as FootballObservationCode[];

export function getObservationDefinition(
  code: FootballObservationCode,
): ObservationDefinition {
  return OBSERVATION_DEFINITIONS[code];
}

export function getObservationLabel(
  code: FootballObservationCode,
  polarity: ObservationPolarity,
): string {
  const def = OBSERVATION_DEFINITIONS[code];
  return polarity === "POSITIVE" ? def.positiveLabel : def.negativeLabel;
}

export function isValidObservationCode(
  code: string,
): code is FootballObservationCode {
  return code in OBSERVATION_DEFINITIONS;
}