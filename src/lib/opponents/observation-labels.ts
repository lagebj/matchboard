import { MatchEnvironmentObservation, OpponentConcernCategory, OpponentObservationFollowUp } from "@/generated/prisma/client";

export const ENVIRONMENT_OBSERVATION_LABELS: Record<MatchEnvironmentObservation, string> = {
  NOT_ASSESSED: "Not assessed",
  POSITIVE: "Positive experience",
  ACCEPTABLE: "Acceptable experience",
  CONCERN: "Concern observed",
  SERIOUS_CONCERN: "Serious concern observed",
};

export const CONCERN_CATEGORY_LABELS: Record<OpponentConcernCategory, string> = {
  PRESSURE_ON_REFEREE_DECISIONS: "Pressure directed at referee decisions",
  DISRESPECTFUL_LANGUAGE_OR_SHOUTING: "Disrespectful language or shouting",
  UNSPORTING_MATCH_CONDUCT: "Unsporting match conduct",
  PHYSICAL_PLAY_OR_SAFETY_CONCERN: "Physical play or situation causing safety concern",
  THREATS_OR_INTIMIDATION: "Threatening or intimidating conduct",
  DISCRIMINATORY_OR_DEGRADING_LANGUAGE: "Discriminatory or degrading language",
  SIDELINE_ATMOSPHERE_CONCERN: "Sideline atmosphere concern",
  SAFE_MATCH_FRAME_NOT_SUPPORTED: "Safe match framework was not supported",
  OTHER_OBSERVABLE_CONCERN: "Other observable concern",
};

export const FOLLOW_UP_LABELS: Record<OpponentObservationFollowUp, string> = {
  NONE: "No follow-up recorded",
  DISCUSSED_AFTER_MATCH: "Discussed after match",
  INFORMED_OWN_CLUB_FAIR_PLAY_CONTACT: "Informed own club Fair Play contact",
  FORMAL_FOLLOW_UP_OUTSIDE_MATCHBOARD: "Formal follow-up handled outside Matchboard",
  NO_FURTHER_ACTION_REQUIRED: "No further action required",
};

export const OBSERVATION_AREA_LABELS = {
  opponentPlayersContext: "Opponent players",
  opponentStaffContext: "Opponent coaching/staff environment",
  spectatorSidelineContext: "Spectator/sideline environment",
} as const;

export const SERIOUS_CONCERN_CALLOUT =
  "Matchboard records encounter context only. Serious concerns should be followed up through the club's Fair Play routine outside this app. Do not include names or identifying details here.";

export const FACTUAL_SUMMARY_HELPER =
  "Describe what affected the match environment. Do not include names, shirt numbers or identifying details.";

export const PREVIOUS_ENCOUNTERS_DISCLAIMER =
  "Previous encounter context only. Matchboard does not automatically change squad selection based on opponent history.";