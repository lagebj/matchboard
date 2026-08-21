import { z } from "zod";

export const cuidSchema = z.string().min(1).max(100);

export const overrideReasonCategorySchema = z.enum([
  "squad_too_small",
  "support_missing",
  "development_opportunity",
  "no_planned_match_opportunity",
  "availability_changed",
  "coach_judgement",
  "match_already_played",
  "data_correction",
  "other",
]);

export const overrideReasonDetailSchema = z.string().max(1000).optional();

export const finalizeRoundSchema = z.object({
  matchRoundId: cuidSchema,
  overrideReasonCategory: overrideReasonCategorySchema.optional(),
  overrideReasonDetail: overrideReasonDetailSchema,
});

export const populateAllSchema = z.object({
  leagueSeasonId: cuidSchema,
});

export const generateRoundSchema = z.object({
  roundId: cuidSchema,
});

export const clearDraftSchema = z.discriminatedUnion("level", [
  z.object({
    level: z.literal("all"),
    leagueSeasonId: cuidSchema,
  }),
  z.object({
    level: z.literal("round"),
    matchRoundId: cuidSchema,
  }),
  z.object({
    level: z.literal("match"),
    matchId: cuidSchema,
  }),
]);

export const draftSelectionActionSchema = z.enum(["add", "remove", "changeRole", "replace"]);

export const selectionRoleSchema = z.enum([
  "CORE",
  "SUPPORT",
  "DEVELOPMENT",
  "BACKFILL",
]);

export const draftSelectionAddSchema = z.object({
  action: z.literal("add"),
  matchId: cuidSchema,
  playerId: cuidSchema,
  role: selectionRoleSchema,
  overrideReasonCategory: overrideReasonCategorySchema.optional(),
  overrideReasonDetail: overrideReasonDetailSchema,
});

export const draftSelectionRemoveSchema = z.object({
  action: z.literal("remove"),
  matchId: cuidSchema,
  playerId: cuidSchema,
});

export const draftSelectionChangeRoleSchema = z.object({
  action: z.literal("changeRole"),
  matchId: cuidSchema,
  playerId: cuidSchema,
  role: selectionRoleSchema,
  overrideReasonCategory: overrideReasonCategorySchema.optional(),
  overrideReasonDetail: overrideReasonDetailSchema,
});

export const draftSelectionReplaceSchema = z.object({
  action: z.literal("replace"),
  matchId: cuidSchema,
  playerId: cuidSchema,
  incomingPlayerId: cuidSchema,
  role: selectionRoleSchema,
  overrideReasonCategory: overrideReasonCategorySchema.optional(),
  overrideReasonDetail: overrideReasonDetailSchema,
});

export const draftSelectionSchema = z.discriminatedUnion("action", [
  draftSelectionAddSchema,
  draftSelectionRemoveSchema,
  draftSelectionChangeRoleSchema,
  draftSelectionReplaceSchema,
]);

export const reconcileDomainSchema = z.enum([
  "PLAYER_GOALS_DERIVED_PROJECTION",
  "PLAYER_ASSISTS_DERIVED_PROJECTION",
  "OPPONENT_SNAPSHOT_DERIVED_PROJECTION",
  "ACTIVE_PLAN_INTEGRITY_PROJECTION",
]);

export const reconcileSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  leagueSeasonId: cuidSchema.optional(),
  matchId: cuidSchema.optional(),
  domains: z.array(reconcileDomainSchema).min(1),
});

export const auditQuerySchema = z.object({
  leagueSeasonId: cuidSchema.optional(),
  matchId: cuidSchema.optional(),
});

export const seasonExportSchema = z.object({
  leagueSeasonId: cuidSchema,
  format: z.enum(["csv", "json", "txt", "md"]),
  visibility: z.enum(["coach", "parent"]),
});