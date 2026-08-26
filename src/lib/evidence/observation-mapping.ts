import type { RatingAttributeKey } from "@/lib/ratings/player-rating";
import type {
  FootballObservationCode,
  EvidenceClass,
} from "./observation-vocabulary";

export type AttributeMappingTarget = {
  attributeKey: RatingAttributeKey;
  evidenceClass: EvidenceClass;
};

export type ObservationMappingEntry = {
  code: FootballObservationCode;
  directTargets: RatingAttributeKey[];
  supportingTargets: RatingAttributeKey[];
};

export const OBSERVATION_ATTRIBUTE_MAPPINGS: Record<
  FootballObservationCode,
  ObservationMappingEntry
> = {
  SECURE_ON_BALL: {
    code: "SECURE_ON_BALL",
    directTargets: ["ballControl"],
    supportingTargets: ["firstTouch", "decisionMaking"],
  },
  FIRST_TOUCH_EFFECTIVE: {
    code: "FIRST_TOUCH_EFFECTIVE",
    directTargets: ["firstTouch"],
    supportingTargets: ["ballControl"],
  },
  PASSING_EFFECTIVE: {
    code: "PASSING_EFFECTIVE",
    directTargets: ["passing"],
    supportingTargets: ["decisionMaking", "teamplay"],
  },
  PLAYS_THROUGH_PRESSURE: {
    code: "PLAYS_THROUGH_PRESSURE",
    directTargets: ["passing", "decisionMaking"],
    supportingTargets: ["firstTouch", "ballControl"],
  },
  ONE_V_ONE_ATTACKING_EFFECTIVE: {
    code: "ONE_V_ONE_ATTACKING_EFFECTIVE",
    directTargets: ["oneVOneAttacking"],
    supportingTargets: ["ballControl", "speed"],
  },
  POSITIONING_EFFECTIVE: {
    code: "POSITIONING_EFFECTIVE",
    directTargets: ["positioning"],
    supportingTargets: ["decisionMaking", "concentration"],
  },
  ONE_V_ONE_DEFENDING_EFFECTIVE: {
    code: "ONE_V_ONE_DEFENDING_EFFECTIVE",
    directTargets: ["oneVOneDefending"],
    supportingTargets: ["positioning", "strength", "speed"],
  },
  DECISION_MAKING_EFFECTIVE: {
    code: "DECISION_MAKING_EFFECTIVE",
    directTargets: ["decisionMaking"],
    supportingTargets: ["positioning", "teamplay"],
  },
  WORK_RATE_EFFECTIVE: {
    code: "WORK_RATE_EFFECTIVE",
    directTargets: ["effort"],
    supportingTargets: ["teamplay"],
  },
  TEAM_COMBINATION_EFFECTIVE: {
    code: "TEAM_COMBINATION_EFFECTIVE",
    directTargets: ["teamplay"],
    supportingTargets: ["passing", "decisionMaking"],
  },
  CONCENTRATION_EFFECTIVE: {
    code: "CONCENTRATION_EFFECTIVE",
    directTargets: ["concentration"],
    supportingTargets: ["positioning"],
  },
  PACE_EFFECTIVE: {
    code: "PACE_EFFECTIVE",
    directTargets: ["speed"],
    supportingTargets: [],
  },
  PHYSICAL_DUELS_EFFECTIVE: {
    code: "PHYSICAL_DUELS_EFFECTIVE",
    directTargets: ["strength"],
    supportingTargets: [],
  },
  GOALKEEPING_EFFECTIVE: {
    code: "GOALKEEPING_EFFECTIVE",
    directTargets: [],
    supportingTargets: [],
  },
};

export const MAPPING_VERSION = "1.0.0";

export function getEvidenceTargets(
  code: FootballObservationCode,
): AttributeMappingTarget[] {
  const mapping = OBSERVATION_ATTRIBUTE_MAPPINGS[code];
  const targets: AttributeMappingTarget[] = [];

  for (const attr of mapping.directTargets) {
    targets.push({ attributeKey: attr, evidenceClass: "DIRECT" });
  }

  for (const attr of mapping.supportingTargets) {
    targets.push({ attributeKey: attr, evidenceClass: "SUPPORTING" });
  }

  return targets;
}

export function getDirectTargets(
  code: FootballObservationCode,
): RatingAttributeKey[] {
  return OBSERVATION_ATTRIBUTE_MAPPINGS[code].directTargets;
}

export function getSupportingTargets(
  code: FootballObservationCode,
): RatingAttributeKey[] {
  return OBSERVATION_ATTRIBUTE_MAPPINGS[code].supportingTargets;
}

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
] as const satisfies readonly RatingAttributeKey[];

export function verifyFullAttributeCoverage(): {
  covered: RatingAttributeKey[];
  uncovered: RatingAttributeKey[];
  passed: boolean;
} {
  const covered = new Set<RatingAttributeKey>();
  const uncovered: RatingAttributeKey[] = [];

  for (const mapping of Object.values(OBSERVATION_ATTRIBUTE_MAPPINGS)) {
    for (const attr of mapping.directTargets) {
      covered.add(attr);
    }
  }

  for (const attr of RATING_ATTRIBUTE_KEYS) {
    if (!covered.has(attr)) {
      uncovered.push(attr);
    }
  }

  return {
    covered: RATING_ATTRIBUTE_KEYS.filter((k) => covered.has(k)),
    uncovered,
    passed: uncovered.length === 0,
  };
}