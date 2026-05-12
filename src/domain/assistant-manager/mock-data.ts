import type {
  AssistantIssue,
  AssistantIssueSeverity,
  AssistantIssueStatus,
  CrossTeamImpact,
  ImpactLevel,
  MatchReview,
  PostMatchReport,
  ReadinessState,
  Recommendation,
  RecommendationConfidence,
  RoundReview,
  RuleImpact,
  RuleImpactSeverity,
  TeamReadiness,
} from "./types";

const SEVERITY_ORDER: Record<AssistantIssueSeverity, number> = {
  CRITICAL: 0,
  BLOCKED: 1,
  ACTION_REQUIRED: 2,
  WATCH: 3,
  INFO: 4,
};

const STATUS_ORDER: Record<AssistantIssueStatus, number> = {
  OPEN: 0,
  STALE: 1,
  RESOLVED: 2,
  DISMISSED: 3,
};

const MOCK_RULES: RuleImpact[] = [
  {
    ruleId: "support-priority",
    ruleName: "Support priority",
    effect: "Rød has highest support priority",
    severity: "WARNING" as RuleImpactSeverity,
    affectedPlayerIds: ["h07", "h09"],
    affectedTeamIds: ["ROD", "HVIT"],
    blockerType: "NONE",
    explanation: "Rød is configured as the highest-priority team for support from Hvit.",
  },
  {
    ruleId: "floating-gap",
    ruleName: "Floating gap",
    effect: "h04 cannot float up to Blå due to no active rotation path",
    severity: "HARD_BLOCKER" as RuleImpactSeverity,
    affectedPlayerIds: ["h04"],
    affectedTeamIds: ["BLA", "HVIT"],
    blockerType: "HARD",
    explanation: "No active DEVELOPMENT or BACKFILL rotation path from Hvit to Blå exists for h04.",
  },
  {
    ruleId: "squad-size-cap",
    ruleName: "Squad size cap",
    effect: "Blå has reached maximum squad size",
    severity: "INFO" as RuleImpactSeverity,
    affectedPlayerIds: [],
    affectedTeamIds: ["BLA"],
    blockerType: "NONE",
    explanation: "Blå squad is at 14 players, matching the maximum squad size.",
  },
  {
    ruleId: "own-core-preference",
    ruleName: "Own core first",
    effect: "Core selections are made before support allocation",
    severity: "INFO" as RuleImpactSeverity,
    affectedPlayerIds: [],
    affectedTeamIds: ["BLA", "HVIT", "ROD"],
    blockerType: "NONE",
    explanation: "Players are assigned to their own core team before any cross-team movement.",
  },
  {
    ruleId: "match-load-fairness",
    ruleName: "Match load fairness",
    effect: "Load balance is acceptable across planning period",
    severity: "INFO" as RuleImpactSeverity,
    affectedPlayerIds: [],
    affectedTeamIds: ["BLA", "HVIT", "ROD"],
    blockerType: "NONE",
    explanation: "No player exceeds the match load threshold for the current planning period.",
  },
];

const MOCK_CROSS_TEAM_IMPACT: CrossTeamImpact = {
  sourceTeamId: "HVIT",
  targetTeamId: "ROD",
  playerId: "h07",
  positiveEffects: ["Rød reaches target squad size", "Rød midfield gap is covered"],
  negativeEffects: ["Hvit has reduced midfield depth"],
  ruleConflicts: [],
  fairnessImpact: "Acceptable",
  loadImpact: "Low",
  summary: "Sending h07 from Hvit to Rød covers the midfield gap while keeping Hvit above minimum.",
  impactLevel: "MEDIUM" as ImpactLevel,
};

const MOCK_RECOMMENDATION: Recommendation = {
  id: "rec-rod-support-w21",
  summary: "Use h07 and h09 as support for Rød. This covers midfield and defender gaps while keeping Hvit playable.",
  confidence: "MEDIUM" as RecommendationConfidence,
  suggestedActions: ["Select h07 as SUPPORT for Rød", "Select h09 as SUPPORT for Rød"],
  rulesApplied: MOCK_RULES,
  warnings: ["h09 has unknown RSVP status"],
  blockers: ["h04 blocked from Blå float-up"],
  crossTeamImpacts: [MOCK_CROSS_TEAM_IMPACT],
};

export const MOCK_ISSUES: AssistantIssue[] = [
  {
    id: "issue-w21-ready",
    type: "ROUND_READY_FOR_REVIEW",
    severity: "ACTION_REQUIRED",
    status: "OPEN",
    title: "W21 squads ready for review",
    summary: "Round W21 has draft squads generated. Blå is ready, Hvit has watch items, and Rød needs support.",
    entityType: "ROUND",
    entityId: "W21",
    affectedTeamIds: ["BLA", "HVIT", "ROD"],
    affectedPlayerIds: [],
    ruleIds: ["support-priority", "squad-size-cap", "own-core-preference"],
    recommendedAction: "Review Rød support needs, resolve h04 blocker, then finalize.",
    primaryActionLabel: "Review round",
    primaryActionHref: "/rounds/W21/review",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "issue-rod-support",
    type: "TEAM_NEEDS_SUPPORT",
    severity: "ACTION_REQUIRED",
    status: "OPEN",
    title: "Rød needs 2 support players",
    summary: "Rød is 2 players below target squad size. Hvit has eligible candidates h07 and h09.",
    entityType: "TEAM",
    entityId: "ROD",
    affectedTeamIds: ["ROD", "HVIT"],
    affectedPlayerIds: ["h07", "h09"],
    ruleIds: ["support-priority", "own-core-preference", "match-load-fairness"],
    recommendedAction: "Assign h07 and h09 as support for Rød.",
    primaryActionLabel: "Review team",
    primaryActionHref: "/teams/ROD/review",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "issue-unknown-rsvp",
    type: "UNKNOWN_RSVP_INCLUDED",
    severity: "WATCH",
    status: "OPEN",
    title: "5 players have unknown RSVP",
    summary: "Five players across the round have not confirmed availability. Drafts include them by default.",
    entityType: "ROUND",
    entityId: "W21",
    affectedTeamIds: ["BLA", "HVIT", "ROD"],
    affectedPlayerIds: ["h09"],
    ruleIds: ["own-core-preference"],
    recommendedAction: "Confirm availability before finalizing.",
    primaryActionLabel: "Review round",
    primaryActionHref: "/rounds/W21/review",
    createdAt: new Date(Date.now() - 5400000).toISOString(),
  },
  {
    id: "issue-h04-blocked",
    type: "PLAYER_BLOCKED_FLOATING_GAP",
    severity: "BLOCKED",
    status: "OPEN",
    title: "h04 blocked from Blå float-up",
    summary: "h04 cannot float up to Blå because no active rotation path exists from Hvit to Blå for DEVELOPMENT or BACKFILL.",
    entityType: "PLAYER",
    entityId: "h04",
    affectedTeamIds: ["BLA", "HVIT"],
    affectedPlayerIds: ["h04"],
    ruleIds: ["floating-gap"],
    recommendedAction: "Add a rotation path from Hvit to Blå, or override with reason.",
    primaryActionLabel: "Review player",
    primaryActionHref: "/players/h04?issue=player-blocked-floating-gap-h04",
    secondaryActionLabel: "Review rules",
    secondaryActionHref: "/rules",
    createdAt: new Date(Date.now() - 9000000).toISOString(),
  },
  {
    id: "issue-b08-low-exposure",
    type: "PLAYER_LOW_MATCH_EXPOSURE",
    severity: "WATCH",
    status: "OPEN",
    title: "b08 has low match exposure",
    summary: "b08 has only 2 finalized selections across 5 rounds, both as core. No development or support assignments recorded.",
    entityType: "PLAYER",
    entityId: "b08",
    affectedTeamIds: ["BLA"],
    affectedPlayerIds: ["b08"],
    ruleIds: ["match-load-fairness"],
    recommendedAction: "Consider development or support assignments for b08 in upcoming rounds.",
    primaryActionLabel: "Review player",
    primaryActionHref: "/players/b08?issue=player-low-match-exposure-b08",
    createdAt: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    id: "issue-post-match-hvit-w20",
    type: "POST_MATCH_REPORT_MISSING",
    severity: "ACTION_REQUIRED",
    status: "OPEN",
    title: "Post-match report missing for Hvit W20",
    summary: "The finalized match for Hvit in round W20 has no post-match attendance data. Actual attendance and no-show data is needed for fair rotation.",
    entityType: "POST_MATCH",
    entityId: "match-HVIT-W20",
    affectedTeamIds: ["HVIT"],
    affectedPlayerIds: [],
    ruleIds: [],
    recommendedAction: "Complete the post-match report for Hvit W20.",
    primaryActionLabel: "Complete report",
    primaryActionHref: "/matches/match-HVIT-W20/post-match",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const MOCK_TEAM_READINESS: Record<string, TeamReadiness> = {
  BLA: {
    teamId: "BLA",
    teamName: "Blå",
    readinessState: "READY" as ReadinessState,
    confirmedPlayers: 11,
    unknownRsvp: 0,
    unavailablePlayers: 0,
    blockedPlayers: 0,
    targetSquadSize: 11,
    maxSquadSize: 14,
    supportNeeded: 0,
    positionGaps: [],
    rotationPressure: "LOW",
    warnings: [],
    ruleImpacts: [MOCK_RULES[2], MOCK_RULES[3]],
  },
  HVIT: {
    teamId: "HVIT",
    teamName: "Hvit",
    readinessState: "WATCH" as ReadinessState,
    confirmedPlayers: 10,
    unknownRsvp: 1,
    unavailablePlayers: 1,
    blockedPlayers: 0,
    targetSquadSize: 11,
    maxSquadSize: 14,
    supportNeeded: 0,
    positionGaps: ["midfield"],
    rotationPressure: "MEDIUM",
    warnings: ["1 player has unknown RSVP"],
    ruleImpacts: [MOCK_RULES[0], MOCK_RULES[4]],
  },
  ROD: {
    teamId: "ROD",
    teamName: "Rød",
    readinessState: "AT_RISK" as ReadinessState,
    confirmedPlayers: 9,
    unknownRsvp: 2,
    unavailablePlayers: 1,
    blockedPlayers: 1,
    targetSquadSize: 11,
    maxSquadSize: 14,
    supportNeeded: 2,
    positionGaps: ["midfield", "defender"],
    rotationPressure: "HIGH",
    warnings: ["2 players below target", "1 blocked player", "2 unknown RSVP"],
    ruleImpacts: [MOCK_RULES[0], MOCK_RULES[1], MOCK_RULES[4]],
    recommendation: MOCK_RECOMMENDATION,
  },
};

export const MOCK_ROUND_REVIEW: RoundReview = {
  roundId: "W21",
  title: "Round W21",
  readinessState: "AT_RISK",
  teamReadiness: [MOCK_TEAM_READINESS.BLA, MOCK_TEAM_READINESS.HVIT, MOCK_TEAM_READINESS.ROD],
  matchReviews: [],
  openIssueIds: MOCK_ISSUES.filter((i) => i.status === "OPEN").map((i) => i.id),
  hardBlockerCount: 1,
  publishable: false,
};

export const MOCK_MATCH_REVIEW: MatchReview = {
  matchId: "match-ROD-W21",
  teamId: "ROD",
  roundId: "W21",
  readinessState: "AT_RISK",
  selectedPlayerIds: ["r01", "r02", "r03", "r04", "r05", "r06", "r07", "r08", "r09", "h07", "h09"],
  unavailablePlayerIds: ["r11"],
  unknownRsvpPlayerIds: ["h09"],
  eligibleNotSelectedPlayerIds: ["r10", "r12"],
  blockedPlayerIds: ["h04"],
  positionGaps: ["midfield", "defender"],
  ruleImpacts: [MOCK_RULES[0], MOCK_RULES[1]],
  recommendations: [MOCK_RECOMMENDATION],
  crossTeamImpacts: [MOCK_CROSS_TEAM_IMPACT],
  approved: false,
  published: false,
};

export const MOCK_POST_MATCH_REPORT: PostMatchReport = {
  matchId: "match-HVIT-W20",
  status: "NOT_STARTED",
  playerActuals: [],
};

export function getSeverityBadgeClasses(severity: AssistantIssueSeverity): string {
  switch (severity) {
    case "CRITICAL":
      return "border-red-700/50 bg-red-900/25 text-red-300";
    case "BLOCKED":
      return "border-red-700/40 bg-red-900/20 text-red-300";
    case "ACTION_REQUIRED":
      return "border-amber-700/40 bg-amber-900/20 text-amber-300";
    case "WATCH":
      return "border-blue-700/40 bg-blue-900/20 text-blue-300";
    case "INFO":
      return "border-zinc-600/40 bg-zinc-800/30 text-zinc-400";
    default:
      return "border-zinc-600/40 bg-zinc-800/30 text-zinc-400";
  }
}

export function getReadinessClasses(state: ReadinessState): string {
  switch (state) {
    case "READY":
      return "border-emerald-700/40 bg-emerald-900/20 text-emerald-300";
    case "WATCH":
      return "border-blue-700/40 bg-blue-900/20 text-blue-300";
    case "AT_RISK":
      return "border-amber-700/40 bg-amber-900/20 text-amber-300";
    case "NOT_PLAYABLE":
      return "border-red-700/40 bg-red-900/20 text-red-300";
    default:
      return "border-zinc-600/40 bg-zinc-800/30 text-zinc-400";
  }
}

export function getStatusBadgeClasses(status: AssistantIssueStatus): string {
  switch (status) {
    case "OPEN":
      return "border-zinc-600/40 bg-zinc-800/30 text-zinc-300";
    case "RESOLVED":
      return "border-emerald-700/40 bg-emerald-900/20 text-emerald-300";
    case "DISMISSED":
      return "border-zinc-700/40 bg-zinc-800/20 text-zinc-500";
    case "STALE":
      return "border-zinc-700/40 bg-zinc-800/20 text-zinc-500 line-through";
    default:
      return "border-zinc-600/40 bg-zinc-800/30 text-zinc-400";
  }
}

export type IssueGroup = "needs_action" | "watch" | "recently_resolved" | "upcoming";

export function groupIssues(issues: AssistantIssue[]): Record<IssueGroup, AssistantIssue[]> {
  const groups: Record<IssueGroup, AssistantIssue[]> = {
    needs_action: [],
    watch: [],
    recently_resolved: [],
    upcoming: [],
  };
  for (const issue of issues) {
    if (issue.status === "RESOLVED" || issue.status === "DISMISSED") {
      groups.recently_resolved.push(issue);
    } else if (issue.severity === "ACTION_REQUIRED" || issue.severity === "BLOCKED" || issue.severity === "CRITICAL") {
      groups.needs_action.push(issue);
    } else if (issue.severity === "WATCH" || issue.severity === "INFO") {
      if (issue.status === "STALE") {
        groups.upcoming.push(issue);
      } else {
        groups.watch.push(issue);
      }
    } else {
      groups.watch.push(issue);
    }
  }
  return groups;
}

export function sortIssuesBySeverity(issues: AssistantIssue[]): AssistantIssue[] {
  return [...issues].sort((a, b) => {
    const sevDiff = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
    if (sevDiff !== 0) return sevDiff;
    return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
  });
}