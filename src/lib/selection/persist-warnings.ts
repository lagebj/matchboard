import { WarningSeverity } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { GeneratedRound, SelectionWarning } from "@/lib/selection/types";
import {
  type SignalCategory,
  type WarningSeverityValue,
  mapWarningSeverity,
  mapToSignalCategory,
  signalCategoryFromSeverity,
  signalCategoryLabel,
} from "./signal-category";

export type { SignalCategory, WarningSeverityValue };
export { mapWarningSeverity, mapToSignalCategory, signalCategoryFromSeverity, signalCategoryLabel };

const severityToDBSeverity = new Map<WarningSeverityValue, WarningSeverity>([
  ["HARD_BLOCK", WarningSeverity.HARD_BLOCK],
  ["REQUIRES_OVERRIDE", WarningSeverity.REQUIRES_OVERRIDE],
  ["WARNING", WarningSeverity.WARNING],
  ["SCORING_PREFERENCE", WarningSeverity.SCORING_PREFERENCE],
]);

function mapWarningSeverityToDB(code: string): WarningSeverity {
  return severityToDBSeverity.get(mapWarningSeverity(code)) ?? WarningSeverity.WARNING;
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
  _matchIdByTeamName: Map<string, string>,
  _teamIdByTeamName: Map<string, string>,
): PersistableWarning {
  return {
    matchRoundId,
    matchId: warning.matchId ?? null,
    playerId: warning.playerId ?? null,
    teamId: warning.teamId ?? null,
    severity: mapWarningSeverityToDB(warning.code),
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
  const matchRoundId = warnings.length > 0 ? warnings[0]!.matchRoundId : "";

  await db.$transaction(async (tx) => {
    await tx.warning.deleteMany({
      where: { matchRoundId: matchRoundId || undefined },
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
          resolved: false,
        },
      });
    }
  });
}