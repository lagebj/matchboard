import { WarningSeverity } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { GeneratedRound, SelectionWarning } from "@/lib/selection/types";

const HARD_BLOCK_CODES = new Set([
  "player_in_multiple_matches",
  "duplicate_player_in_match",
]);

const REQUIRES_OVERRIDE_CODES = new Set([
  "support_requirement_shortfall",
  "backfill_shortfall_after_resolution",
  "repair_requires_override",
  "repair_below_minimum",
  "backfill_no_path_available",
  "round_player_conflict_removed",
]);

const WARNING_CODES = new Set([
  "support_shortfall_after_resolution",
  "support_below_target",
  "backfill_below_target",
  "short_squad",
  "core_player_unselected",
  "support_avoid_suitability",
  "support_no_show_history",
  "unknown_availability_support",
  "tentative_availability",
  "position_mismatch",
  "repair_no_replacement_target_shortfall",
  "support_target_not_reached",
]);

const SCORING_PREFERENCE_CODES = new Set([
  "core_player_overflow",
  "development_slot_shortfall",
  "support_backfill_priority",
  "player_locked_in_blocked",
  "round_support_resolution",
  "support_priority_order",
  "core_match_drop_for_support",
  "core_match_drop_routed",
  "core_match_drop_priority",
  "self_backfill",
  "backfill_priority_1_own_support",
  "backfill_priority_2_development",
  "backfill_priority_3_other",
  "registered_match_conflict",
  "registered_minimum_match_spacing",
  "round_player_conflict",
  "round_conflict_demoted",
]);

export function mapWarningSeverity(code: string): WarningSeverity {
  if (HARD_BLOCK_CODES.has(code)) return WarningSeverity.HARD_BLOCK;
  if (REQUIRES_OVERRIDE_CODES.has(code)) return WarningSeverity.REQUIRES_OVERRIDE;
  if (WARNING_CODES.has(code)) return WarningSeverity.WARNING;
  if (SCORING_PREFERENCE_CODES.has(code)) return WarningSeverity.SCORING_PREFERENCE;
  return WarningSeverity.WARNING;
}

export type PersistableWarning = {
  matchRoundId: string;
  matchId: string | null;
  playerId: string | null;
  teamId: string | null;
  severity: WarningSeverity;
  rule: string;
  message: string;
};

function enrichWarning(
  warning: SelectionWarning,
  matchRoundId: string,
  matchIdByTeamName: Map<string, string>,
  teamIdByTeamName: Map<string, string>,
): PersistableWarning {
  return {
    matchRoundId,
    matchId: warning.matchId ?? null,
    playerId: warning.playerId ?? null,
    teamId: warning.teamId ?? null,
    severity: mapWarningSeverity(warning.code),
    rule: warning.code,
    message: warning.message,
  };
}

export function buildPersistableWarnings(
  generatedRound: GeneratedRound,
  matchIdByTeamName: Map<string, string>,
  teamIdByTeamName: Map<string, string>,
): PersistableWarning[] {
  const warnings: PersistableWarning[] = [];

  for (const w of generatedRound.roundWarnings) {
    warnings.push(enrichWarning(w, generatedRound.matchRoundId, matchIdByTeamName, teamIdByTeamName));
  }

  for (const matchResult of generatedRound.matchResults) {
    for (const w of matchResult.warnings) {
      warnings.push(enrichWarning(
        { ...w, matchId: w.matchId ?? matchResult.matchId },
        generatedRound.matchRoundId,
        matchIdByTeamName,
        teamIdByTeamName,
      ));
    }
  }

  return warnings;
}

export async function persistRoundWarnings(warnings: PersistableWarning[]): Promise<void> {
  if (warnings.length === 0) return;

  const matchRoundId = warnings[0]!.matchRoundId;

  await db.$transaction(async (tx) => {
    await tx.warning.deleteMany({
      where: { matchRoundId },
    });

    for (const w of warnings) {
      await tx.warning.create({
        data: {
          matchRoundId: w.matchRoundId,
          matchId: w.matchId,
          playerId: w.playerId,
          teamId: w.teamId,
          severity: w.severity,
          rule: w.rule,
          message: w.message,
        },
      });
    }
  });
}