/**
 * Guided post-match debrief — versioned question schema v1 (ADR-0152 §3, bundle
 * `03_POST_MATCH_DEBRIEF.md`). Question definitions live in versioned TypeScript, never in the
 * database (locked decision — no survey builder). This module owns the answers document's
 * shape/validation and the "has every required prompt been reviewed" check; it has no DB import
 * and is safe to unit test in isolation.
 */

import { z } from "zod";

export const DEBRIEF_SCHEMA_VERSION = 1 as const;

export const TEAM_EXECUTION_ROWS = ["effort", "teamCohesion", "positionalShape", "recoveryBehavior"] as const;
export type TeamExecutionRow = (typeof TEAM_EXECUTION_ROWS)[number];

/** Matches the existing `TeamReflection` rating vocabulary exactly (team-reflection-section.tsx's
 * `RATING_OPTIONS`) plus the debrief's own explicit no-evidence answer, which maps to `null` on
 * the canonical model while staying present here (bundle §00 Decision 10). */
export const TEAM_EXECUTION_VALUES = ["STRONG", "OK", "NEEDS_ATTENTION", "NOT_OBSERVED"] as const;
export type TeamExecutionValue = (typeof TEAM_EXECUTION_VALUES)[number];

export const TACTICAL_THEMES = [
  "BUILD_UP",
  "PROGRESSION",
  "CHANCE_CREATION",
  "PRESSING",
  "DEFENSIVE_SHAPE",
  "DEFENSIVE_TRANSITION",
  "ATTACKING_TRANSITION",
  "SET_PLAYS",
] as const;
export type TacticalTheme = (typeof TACTICAL_THEMES)[number];

export const WORKED_NEEDS_ATTENTION_OPTIONS = [...TACTICAL_THEMES, "NOTHING_TO_ADD"] as const;
export type WorkedNeedsAttentionOption = (typeof WORKED_NEEDS_ATTENTION_OPTIONS)[number];

export const MAX_THEME_SELECTIONS = 3;

export const MATCH_CHANGE_OPTIONS = ["NO_MEANINGFUL_CHANGE", "WE_CHANGED", "OPPONENT_CHANGED", "BOTH_CHANGED", "UNSURE"] as const;
export type MatchChangeOption = (typeof MATCH_CHANGE_OPTIONS)[number];

const MATCH_CHANGE_OPTIONS_REQUIRING_TEXT: readonly MatchChangeOption[] = ["WE_CHANGED", "OPPONENT_CHANGED", "BOTH_CHANGED"];

export const MAX_PLAYER_OBSERVATIONS = 5;
const LONG_TEXT_MAX = 2000;
const OBSERVATION_NOTE_MAX = 500;

const teamExecutionAnswerSchema = z
  .object({
    value: z.enum(TEAM_EXECUTION_VALUES),
  })
  .strict();

const teamExecutionSectionSchema = z
  .object({
    effort: teamExecutionAnswerSchema.optional(),
    teamCohesion: teamExecutionAnswerSchema.optional(),
    positionalShape: teamExecutionAnswerSchema.optional(),
    recoveryBehavior: teamExecutionAnswerSchema.optional(),
    note: z.string().max(LONG_TEXT_MAX).optional(),
  })
  .strict();

/** Shared shape for "What worked" and "What needs attention" — same options, same selection
 * rules (bundle §03.3/§03.4: up to 3 themes, NOTHING_TO_ADD mutually exclusive with any other
 * selection). */
const themeSelectionSchema = z
  .object({
    selected: z.array(z.enum(WORKED_NEEDS_ATTENTION_OPTIONS)).max(MAX_THEME_SELECTIONS),
    comment: z.string().max(LONG_TEXT_MAX).optional(),
  })
  .strict()
  .refine((v) => !(v.selected.includes("NOTHING_TO_ADD") && v.selected.length > 1), {
    message: "NOTHING_TO_ADD is mutually exclusive with any other theme.",
    path: ["selected"],
  });

const matchChangeSchema = z
  .object({
    option: z.enum(MATCH_CHANGE_OPTIONS),
    description: z.string().max(LONG_TEXT_MAX).optional(),
    /** A period label the coach picked from that match's own configured periods, plus
     * "Multiple periods" / "Not sure" — deliberately a free string, not a hardcoded enum, since
     * period config varies by match format (bundle §03.5: "Do not hard-code only two halves"). */
    period: z.string().max(60).optional(),
  })
  .strict()
  .refine((v) => !MATCH_CHANGE_OPTIONS_REQUIRING_TEXT.includes(v.option) || !!v.description?.trim(), {
    message: "Describe the adjustment or pattern you noticed.",
    path: ["description"],
  });

const opponentMemorySchema = z
  .object({
    note: z.string().max(LONG_TEXT_MAX).optional(),
  })
  .strict();

/** `observationCode` is validated against `ALL_OBSERVATION_CODES` at submit time
 * (`map-to-canonical.ts`), not here — keeping this module free of the evidence-vocabulary
 * import lets it stay a pure, dependency-free schema file. */
const playerObservationSchema = z
  .object({
    playerId: z.string().min(1),
    observationCode: z.string().min(1),
    direction: z.enum(["POSITIVE", "NEGATIVE"]),
    note: z.string().max(OBSERVATION_NOTE_MAX).optional(),
  })
  .strict();

const anythingElseSchema = z
  .object({
    note: z.string().max(LONG_TEXT_MAX).optional(),
  })
  .strict();

export const debriefAnswersSchema = z
  .object({
    version: z.literal(DEBRIEF_SCHEMA_VERSION),
    answers: z
      .object({
        team_execution: teamExecutionSectionSchema.default({}),
        worked: themeSelectionSchema.default({ selected: [] }),
        needs_attention: themeSelectionSchema.default({ selected: [] }),
        match_changes: matchChangeSchema.optional(),
        opponent_memory: opponentMemorySchema.default({}),
        player_observations: z.array(playerObservationSchema).max(MAX_PLAYER_OBSERVATIONS).default([]),
        anything_else: anythingElseSchema.default({}),
      })
      .strict(),
  })
  .strict();

export type DebriefAnswers = z.infer<typeof debriefAnswersSchema>;
export type DebriefAnswersSection = DebriefAnswers["answers"];

export const EMPTY_DEBRIEF_ANSWERS: DebriefAnswers = {
  version: DEBRIEF_SCHEMA_VERSION,
  answers: {
    team_execution: {},
    worked: { selected: [] },
    needs_attention: { selected: [] },
    opponent_memory: {},
    player_observations: [],
    anything_else: {},
  },
};

/** Parses and validates a persisted `PostMatchDebrief.answers` JSON blob. Rejects an unsupported
 * version or an unknown question id (bundle §00 Decision 11) — `.strict()` on every object in
 * the schema above is what actually enforces "unknown question id" rejection. */
export function parseDebriefAnswers(raw: unknown): DebriefAnswers {
  return debriefAnswersSchema.parse(raw);
}

export function safeParseDebriefAnswers(raw: unknown) {
  return debriefAnswersSchema.safeParse(raw);
}

export type DebriefReviewGap =
  | "team_execution"
  | "worked"
  | "needs_attention"
  | "match_changes";

/**
 * Bundle §03.6 — the required core review: all four team-execution rows, "What worked", "What
 * needs attention", and "What changed" must each be explicitly reviewed before submission. A
 * no-evidence choice (NOT_OBSERVED / NOTHING_TO_ADD / UNSURE) counts as reviewed — this checks
 * only that *something* was chosen, never what was chosen. Opponent memory, player observations,
 * and "anything else" stay optional.
 */
export function findDebriefReviewGaps(answers: DebriefAnswersSection): DebriefReviewGap[] {
  const gaps: DebriefReviewGap[] = [];

  const allTeamExecutionRowsAnswered = TEAM_EXECUTION_ROWS.every((row) => answers.team_execution[row] !== undefined);
  if (!allTeamExecutionRowsAnswered) gaps.push("team_execution");

  if (answers.worked.selected.length === 0) gaps.push("worked");
  if (answers.needs_attention.selected.length === 0) gaps.push("needs_attention");
  if (!answers.match_changes) gaps.push("match_changes");

  return gaps;
}

export function isDebriefReadyToSubmit(answers: DebriefAnswersSection): boolean {
  return findDebriefReviewGaps(answers).length === 0;
}
