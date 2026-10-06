import { z } from "zod";
import type { ConfidenceLevel } from "@/lib/evidence/combination-topology";

/**
 * Team Season Profile domain contract (ADR-0156, Slice 0).
 *
 * A versioned, Zod-validated, application-level contract for the derived/rebuildable
 * `(organisationId, teamId, leagueSeasonId)` season pattern snapshot. Validated before every
 * write and after every read (ADR-0156 §2 / `02_TEAM_SEASON_PROFILE_DOMAIN.md` §2) — this file
 * has no I/O and no Prisma import, so it is safe to import from both server and presentation
 * code.
 *
 * `ConfidenceLevel` is intentionally re-exported from `combination-topology.ts` rather than
 * redeclared — it is the same repository-wide evidence-sufficiency vocabulary
 * (`INSUFFICIENT | EMERGING | ESTABLISHED`) match-phase and combination evidence already use
 * (ADR-0156 §4). Do not introduce a second confidence enum.
 */
export type { ConfidenceLevel };

export const TEAM_SEASON_PROFILE_VERSION = 1 as const;

export const TEAM_SEASON_PATTERN_FAMILY_VALUES = ["MATCH_RHYTHM", "TACTICAL_THEME", "PLAYER_CONTRIBUTION", "COMBINATION"] as const;
export type TeamSeasonPatternFamily = (typeof TEAM_SEASON_PATTERN_FAMILY_VALUES)[number];

/**
 * Trajectory is a dimension separate from `ConfidenceLevel` (ADR-0156 §4 /
 * `04_CONFIDENCE_TRAJECTORY_AND_LANGUAGE.md` §2) — a pattern can legitimately be
 * `ESTABLISHED` + `WEAKENING`. Never collapse the two into one scale.
 */
export const TEAM_SEASON_PATTERN_TRAJECTORY_VALUES = ["NEW", "PERSISTENT", "STRENGTHENING", "WEAKENING", "MIXED", "DORMANT"] as const;
export type TeamSeasonPatternTrajectory = (typeof TEAM_SEASON_PATTERN_TRAJECTORY_VALUES)[number];

/** Presentation tone only — never a quality/goodness score. */
export const TEAM_SEASON_PATTERN_TONE_VALUES = ["POSITIVE", "ATTENTION", "NEUTRAL"] as const;
export type TeamSeasonPatternTone = (typeof TEAM_SEASON_PATTERN_TONE_VALUES)[number];

export const TEAM_SEASON_CORRIDOR_VALUES = ["LEFT", "CENTRE", "RIGHT"] as const;
export type TeamSeasonCorridor = (typeof TEAM_SEASON_CORRIDOR_VALUES)[number];

const confidenceLevelSchema = z.enum(["INSUFFICIENT", "EMERGING", "ESTABLISHED"]);
const trajectorySchema = z.enum(TEAM_SEASON_PATTERN_TRAJECTORY_VALUES);
const toneSchema = z.enum(TEAM_SEASON_PATTERN_TONE_VALUES);
const familySchema = z.enum(TEAM_SEASON_PATTERN_FAMILY_VALUES);
const corridorSchema = z.enum(TEAM_SEASON_CORRIDOR_VALUES);

/**
 * Family-specific, deterministic metrics (ADR-0156 §5). Keys/values are produced by the Slice 1
 * pattern builders only — never written directly by UI or AI code.
 */
const metricsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

const patternSampleSchema = z.object({
  matches: z.number().int().nonnegative(),
  exposureMinutes: z.number().nonnegative().optional(),
  eventCount: z.number().int().nonnegative().optional(),
  opponentDiversity: z.number().int().nonnegative().optional(),
  observationCount: z.number().int().nonnegative().optional(),
  recentMatches: z.number().int().nonnegative().optional(),
});
export type TeamSeasonPatternSample = z.infer<typeof patternSampleSchema>;

const patternSubjectsSchema = z.object({
  playerIds: z.array(z.string()).optional(),
  positions: z.array(z.string()).optional(),
  corridor: corridorSchema.optional(),
});
export type TeamSeasonPatternSubjects = z.infer<typeof patternSubjectsSchema>;

/**
 * `key` must be stable across recomputes regardless of source-row ordering, and must never
 * encode a volatile count (ADR-0156 / `02_TEAM_SEASON_PROFILE_DOMAIN.md` §3) — e.g.
 * `rhythm:first-half:opening-10:for`, `combo:corridor:right:<sortedPlayerIds>`. Stability is a
 * Slice 1 builder responsibility; this schema only validates shape.
 */
export const teamSeasonPatternSchema = z.object({
  key: z.string().min(1),
  family: familySchema,
  subtype: z.string().min(1),

  subjects: patternSubjectsSchema,

  evidenceStrength: confidenceLevelSchema,
  trajectory: trajectorySchema,
  tone: toneSchema,

  firstObservedAt: z.string().nullable(),
  lastObservedAt: z.string().nullable(),
  approximateTiming: z.boolean(),

  sample: patternSampleSchema,

  metrics: metricsSchema,
  sourceRefs: z.array(z.string()),
});
export type TeamSeasonPattern = z.infer<typeof teamSeasonPatternSchema>;

export const teamSeasonProfileV1Schema = z.object({
  version: z.literal(TEAM_SEASON_PROFILE_VERSION),
  organisationId: z.string().min(1),
  teamId: z.string().min(1),
  leagueSeasonId: z.string().min(1),
  seasonStart: z.string(),
  seasonEnd: z.string(),
  computedAt: z.string(),
  sourceFingerprint: z.string().min(1),

  sample: z.object({
    completedMatches: z.number().int().nonnegative(),
    matchesWithUsableTiming: z.number().int().nonnegative(),
    totalResolvedMinutes: z.number().nonnegative(),
    qualitativeObservationCount: z.number().int().nonnegative(),
    combinationEvidenceCount: z.number().int().nonnegative(),
  }),

  patterns: z.array(teamSeasonPatternSchema),
  topPatternKeys: z.array(z.string()),
});

export type TeamSeasonProfileV1 = z.infer<typeof teamSeasonProfileV1Schema>;

/**
 * Validates an unknown payload (e.g. a freshly-read `TeamSeasonProfile.payload` JSON column) as
 * a `TeamSeasonProfileV1`. An unrecognised `version` is explicitly rejected rather than silently
 * coerced — the service layer (Slice 2) treats that as "stale/invalid, rebuild", never as a
 * crash (`05_DATA_MODEL_AND_REFRESH.md` / Test plan §G.9).
 */
export function parseTeamSeasonProfileV1(payload: unknown): TeamSeasonProfileV1 {
  return teamSeasonProfileV1Schema.parse(payload);
}

export function safeParseTeamSeasonProfileV1(payload: unknown) {
  return teamSeasonProfileV1Schema.safeParse(payload);
}
