import { MatchEnvironmentObservation, OpponentConcernCategory, OpponentObservationFollowUp } from "@/generated/prisma/client";

export type ObservationFormData = {
  overallEnvironment: MatchEnvironmentObservation;
  opponentPlayersContext: MatchEnvironmentObservation;
  opponentStaffContext: MatchEnvironmentObservation;
  spectatorSidelineContext: MatchEnvironmentObservation;
  concernCategories: OpponentConcernCategory[];
  factualSummary: string | null;
  followUp: OpponentObservationFollowUp;
};

const ENVIRONMENT_SEVERITY: Record<MatchEnvironmentObservation, number> = {
  NOT_ASSESSED: 0,
  POSITIVE: 1,
  ACCEPTABLE: 2,
  CONCERN: 3,
  SERIOUS_CONCERN: 4,
};

const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /(\+?\d[\d\s\-.]{6,}\d)|(\+\d{1,3}\s?\(?\d{1,4}\)?[\s\-]?\d{1,4}[\s\-]?\d{1,4})/;
const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+\.[a-zA-Z]{2,}/;

const MAX_FACTUAL_SUMMARY_LENGTH = 500;

const CONCERN_LEVELS = new Set<MatchEnvironmentObservation>(["CONCERN", "SERIOUS_CONCERN"]);

export function validateObservation(data: ObservationFormData): { valid: true } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  const overallSeverity = ENVIRONMENT_SEVERITY[data.overallEnvironment];

  if (data.opponentPlayersContext === "SERIOUS_CONCERN" && data.overallEnvironment !== "SERIOUS_CONCERN") {
    errors.push("Overall match environment must be marked as a serious concern when a serious concern is recorded in an observed area.");
  }

  if (data.opponentStaffContext === "SERIOUS_CONCERN" && data.overallEnvironment !== "SERIOUS_CONCERN") {
    errors.push("Overall match environment must be marked as a serious concern when a serious concern is recorded in an observed area.");
  }

  if (data.spectatorSidelineContext === "SERIOUS_CONCERN" && data.overallEnvironment !== "SERIOUS_CONCERN") {
    errors.push("Overall match environment must be marked as a serious concern when a serious concern is recorded in an observed area.");
  }

  const anyAreaIsConcern =
    data.opponentPlayersContext === "CONCERN" ||
    data.opponentStaffContext === "CONCERN" ||
    data.spectatorSidelineContext === "CONCERN";

  const anyAreaIsSerious =
    data.opponentPlayersContext === "SERIOUS_CONCERN" ||
    data.opponentStaffContext === "SERIOUS_CONCERN" ||
    data.spectatorSidelineContext === "SERIOUS_CONCERN";

  if (anyAreaIsConcern && overallSeverity < ENVIRONMENT_SEVERITY["CONCERN"]) {
    errors.push("Overall match environment must be marked as a concern when a concern is recorded in an observed area.");
  }

  const needsConcernCategory =
    CONCERN_LEVELS.has(data.overallEnvironment) || anyAreaIsConcern || anyAreaIsSerious;

  if (needsConcernCategory && data.concernCategories.length === 0) {
    errors.push("Select at least one observable concern category when a concern is recorded.");
  }

  if (data.overallEnvironment === "SERIOUS_CONCERN" && (!data.factualSummary || data.factualSummary.trim().length === 0)) {
    errors.push("Add a brief factual summary for a serious concern. Do not include names or identifying details.");
  }

  if (data.factualSummary) {
    const trimmed = data.factualSummary.trim();
    if (trimmed.length > MAX_FACTUAL_SUMMARY_LENGTH) {
      errors.push(`The factual summary must be ${MAX_FACTUAL_SUMMARY_LENGTH} characters or fewer.`);
    }
    if (EMAIL_PATTERN.test(trimmed)) {
      errors.push("Do not include contact details or links in the factual summary.");
    }
    if (PHONE_PATTERN.test(trimmed)) {
      errors.push("Do not include contact details or links in the factual summary.");
    }
    if (URL_PATTERN.test(trimmed)) {
      errors.push("Do not include contact details or links in the factual summary.");
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

export function deduplicateCategories(categories: OpponentConcernCategory[]): OpponentConcernCategory[] {
  return [...new Set(categories)];
}

export function cleanFactualSummary(summary: string | null | undefined): string | null {
  if (!summary) return null;
  const trimmed = summary.trim();
  return trimmed.length === 0 ? null : trimmed;
}