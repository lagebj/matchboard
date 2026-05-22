import { MatchFit } from "@/generated/prisma/client";

type AdvisoryOrdinal = -1 | 0 | 1 | null;

const MATCH_FIT_ADVISORY_ORDINAL: Record<MatchFit, AdvisoryOrdinal> = {
  UNKNOWN: null,
  TOO_EASY: -1,
  GOOD_FIT: 0,
  TOO_HARD: 1,
  CHAOTIC: null,
  SUPPORT_OVERPOWERED: null,
  SUPPORT_TOO_LOW: null,
};

export function getMatchFitAdvisoryOrdinal(matchFit: MatchFit): AdvisoryOrdinal {
  return MATCH_FIT_ADVISORY_ORDINAL[matchFit];
}

export const MATCH_FIT_LABELS: Record<MatchFit, string> = {
  UNKNOWN: "Not assessed",
  TOO_EASY: "Too little challenge for this squad",
  GOOD_FIT: "Suitable challenge for this squad",
  TOO_HARD: "Too much challenge for this squad",
  CHAOTIC: "Difficult to assess due to match conditions",
  SUPPORT_OVERPOWERED: "Our support level made the match less suitable",
  SUPPORT_TOO_LOW: "Our support level did not meet the match need",
};