import { db } from "@/lib/db";
import { WarningSeverity } from "@/generated/prisma/client";

type IssueMapping = {
  type: string;
  severity: string;
  title: string;
  summary: string;
  entityType: string;
  entityId: string;
  affectedTeamIds: string[];
  affectedPlayerIds: string[];
  ruleIds: string[];
  recommendedAction: string;
  primaryActionLabel: string;
  primaryActionHref: string;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
};

const WARNING_TO_ISSUE_TYPE: Record<string, string> = {
  player_in_multiple_matches: "BLOCKED_CONDITION_PREVENTS_FINALIZE",
  duplicate_player_in_match: "BLOCKED_CONDITION_PREVENTS_FINALIZE",
  invariant_invalid_non_core_selection: "BLOCKED_CONDITION_PREVENTS_FINALIZE",
  support_requirement_shortfall: "TEAM_NEEDS_SUPPORT",
  squad_repair_shortfall_after_resolution: "TEAM_NEEDS_SUPPORT",
  squad_below_minimum: "TEAM_NEEDS_SUPPORT",
  repair_requires_override: "TEAM_NEEDS_SUPPORT",
  repair_below_minimum: "TEAM_NEEDS_SUPPORT",
  squad_repair_no_path_available: "TEAM_NEEDS_SUPPORT",
  support_shortfall_after_resolution: "TEAM_NEEDS_SUPPORT",
  support_below_target: "TEAM_NEEDS_SUPPORT",
  short_squad: "TEAM_NEEDS_SUPPORT",
  core_player_unselected: "PLAYER_LOW_MATCH_EXPOSURE",
  support_avoid_suitability: "TEAM_NEEDS_SUPPORT",
  support_no_show_history: "UNKNOWN_RSVP_INCLUDED",
  unknown_availability_support: "UNKNOWN_RSVP_INCLUDED",
  tentative_availability: "UNKNOWN_RSVP_INCLUDED",
  position_mismatch: "POSITION_GAP",
  double_load_exceeded_max: "PLAYER_HIGH_MATCH_LOAD",
  double_load_squad_full: "PLAYER_HIGH_MATCH_LOAD",
};

const WARNING_TO_SEVERITY: Record<string, string> = {
  player_in_multiple_matches: "BLOCKED",
  duplicate_player_in_match: "BLOCKED",
  invariant_invalid_non_core_selection: "BLOCKED",
  support_requirement_shortfall: "ACTION_REQUIRED",
  squad_repair_shortfall_after_resolution: "ACTION_REQUIRED",
  squad_below_minimum: "ACTION_REQUIRED",
  repair_requires_override: "ACTION_REQUIRED",
  repair_below_minimum: "ACTION_REQUIRED",
  squad_repair_no_path_available: "ACTION_REQUIRED",
  round_player_conflict_removed: "ACTION_REQUIRED",
};

function mapWarningSeverityToIssueSeverity(severity: WarningSeverity): string {
  if (severity === WarningSeverity.HARD_BLOCK) return "BLOCKED";
  if (severity === WarningSeverity.REQUIRES_OVERRIDE) return "ACTION_REQUIRED";
  return "WATCH";
}

function teamNeedsSupportSummary(teamId: string, warningCount: number, hardBlockers: number): string {
  if (hardBlockers > 0) {
    return `${warningCount} issue${warningCount !== 1 ? "s" : ""} blocking this team, including ${hardBlockers} hard blocker${hardBlockers !== 1 ? "s" : ""}.`;
  }
  return `${warningCount} issue${warningCount !== 1 ? "s" : ""} need${warningCount === 1 ? "s" : ""} coach attention for this team.`;
}

export async function generateRoundIssues(matchRoundId: string): Promise<number> {
  const warnings = await db.warning.findMany({
    where: { matchRoundId },
  });

  if (warnings.length === 0) return 0;

  const existingIssues = await db.assistantIssue.findMany({
    where: {
      status: "OPEN",
    },
  });

  const existingKeys = new Set(
    existingIssues
      .filter((i) => i.entityType === "ROUND" || i.entityId === matchRoundId || (Array.isArray(i.ruleIds) && i.ruleIds.length > 0))
      .map((i) => {
        const ruleIds = Array.isArray(i.ruleIds) ? (i.ruleIds as string[]).slice().sort().join(",") : "";
        return `${i.type}|${i.entityId}|${ruleIds}`;
      }),
  );

  const teamWarnings = new Map<string, typeof warnings>();
  const playerWarnings = new Map<string, typeof warnings>();

  for (const w of warnings) {
    if (w.teamId) {
      const existing = teamWarnings.get(w.teamId) ?? [];
      existing.push(w);
      teamWarnings.set(w.teamId, existing);
    }
    if (w.playerId) {
      const existing = playerWarnings.get(w.playerId) ?? [];
      existing.push(w);
      playerWarnings.set(w.playerId, existing);
    }
  }

  const issues: IssueMapping[] = [];

  const blockedConditionCount = warnings.filter((w) => w.severity === WarningSeverity.HARD_BLOCK).length;

  if (blockedConditionCount > 0) {
    issues.push({
      type: "BLOCKED_CONDITION_PREVENTS_FINALIZE",
      severity: "BLOCKED",
      title: "Blocked conditions prevent finalization",
      summary: `${blockedConditionCount} Blocked ${blockedConditionCount !== 1 ? "conditions" : "condition"} must be resolved or overridden before this round can be finalized.`,
      entityType: "ROUND",
      entityId: matchRoundId,
      affectedTeamIds: [...new Set(warnings.filter((w) => w.teamId).map((w) => w.teamId!))],
      affectedPlayerIds: [...new Set(warnings.filter((w) => w.playerId).map((w) => w.playerId!))],
      ruleIds: warnings.filter((w) => w.severity === WarningSeverity.HARD_BLOCK).map((w) => w.rule),
      recommendedAction: "Review Blocked conditions and provide override reason to finalize.",
      primaryActionLabel: "Review conditions",
      primaryActionHref: `/rounds/${matchRoundId}/review`,
    });
  }

  for (const [teamId, teamWarns] of teamWarnings) {
    const issueType = teamWarns.some((w) => w.rule.startsWith("support") || w.rule.startsWith("squad_repair") || w.rule.startsWith("short_squad"))
      ? "TEAM_NEEDS_SUPPORT"
      : "ROUND_READY_FOR_REVIEW";

    const issueSeverity = mapWarningSeverityToIssueSeverity(
      teamWarns.reduce<WarningSeverity>((worst, w) => {
        const order: Record<WarningSeverity, number> = { HARD_BLOCK: 0, REQUIRES_OVERRIDE: 1, WARNING: 2, SCORING_PREFERENCE: 3 };
        return (order[w.severity] ?? 3) < (order[worst] ?? 3) ? w.severity : worst;
      }, WarningSeverity.SCORING_PREFERENCE),
    );

    const team = await db.team.findUnique({ where: { id: teamId } });
    const teamName = team?.name ?? teamId;

    issues.push({
      type: issueType,
      severity: issueSeverity,
      title: `${teamName} needs ${issueType === "TEAM_NEEDS_SUPPORT" ? "support" : "review"}`,
      summary: teamNeedsSupportSummary(teamId, teamWarns.length, teamWarns.filter((w) => w.severity === WarningSeverity.HARD_BLOCK).length),
      entityType: "TEAM",
      entityId: teamId,
      affectedTeamIds: [teamId],
      affectedPlayerIds: [...new Set(teamWarns.filter((w) => w.playerId).map((w) => w.playerId!))],
      ruleIds: [...new Set(teamWarns.map((w) => w.rule))],
      recommendedAction: issueType === "TEAM_NEEDS_SUPPORT" ? "Review team support needs." : "Review team warnings.",
      primaryActionLabel: "Review team",
      primaryActionHref: `/teams/${teamId}/review`,
    });
  }

  for (const [playerId, playerWarns] of playerWarnings) {
    const defaultIssueType = (WARNING_TO_ISSUE_TYPE[playerWarns[0]!.rule] ?? "PLAYER_LOW_MATCH_EXPOSURE") as string;
    const defaultSeverity = (WARNING_TO_SEVERITY[playerWarns[0]!.rule] ?? mapWarningSeverityToIssueSeverity(playerWarns[0]!.severity)) as string;

    const player = await db.player.findUnique({ where: { id: playerId } });
    const playerName = player ? `${player.firstName}${player.lastName ? ` ${player.lastName}` : ""}` : playerId;

    issues.push({
      type: defaultIssueType,
      severity: defaultSeverity,
      title: `Issue for ${playerName}`,
      summary: `${playerWarns.length} warning${playerWarns.length !== 1 ? "s" : ""} affecting this player: ${playerWarns.map((w) => w.message).join("; ")}`,
      entityType: "PLAYER",
      entityId: playerId,
      affectedTeamIds: [...new Set(playerWarns.filter((w) => w.teamId).map((w) => w.teamId!))],
      affectedPlayerIds: [playerId],
      ruleIds: [...new Set(playerWarns.map((w) => w.rule))],
      recommendedAction: "Review player situation.",
      primaryActionLabel: "Review player",
      primaryActionHref: `/players/${playerId}`,
    });
  }

  const newIssues = issues.filter((issue) => {
    const ruleIds = [...issue.ruleIds].sort().join(",");
    const key = `${issue.type}|${issue.entityId}|${ruleIds}`;
    return !existingKeys.has(key);
  });

  if (newIssues.length === 0) return 0;

  await db.$transaction(
    newIssues.map((issue) =>
      db.assistantIssue.create({
        data: {
          type: issue.type,
          severity: issue.severity,
          status: "OPEN",
          title: issue.title,
          summary: issue.summary,
          entityType: issue.entityType,
          entityId: issue.entityId,
          affectedTeamIds: issue.affectedTeamIds,
          affectedPlayerIds: issue.affectedPlayerIds,
          ruleIds: issue.ruleIds,
          recommendedAction: issue.recommendedAction,
          primaryActionLabel: issue.primaryActionLabel,
          primaryActionHref: issue.primaryActionHref,
          secondaryActionLabel: issue.secondaryActionLabel,
          secondaryActionHref: issue.secondaryActionHref,
        },
      }),
    ),
  );

  return newIssues.length;
}