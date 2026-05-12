import type {
  AssistantIssue,
  AssistantIssueEntityType,
  DecisionAction,
  DecisionRecord,
  DecisionType,
  MatchReview,
  PostMatchReport,
  PostMatchPlayerActual,
  RoundReview,
  SelectionExplanation,
  TeamReadiness,
} from "./types";

import {
  MOCK_ISSUES,
  MOCK_MATCH_REVIEW,
  MOCK_POST_MATCH_REPORT,
  MOCK_ROUND_REVIEW,
  MOCK_TEAM_READINESS,
} from "./mock-data";

let mockDecisionCounter = 0;
const mockDecisions: DecisionRecord[] = [];

const mockPostMatchReports: Record<string, PostMatchReport> = {
  "match-HVIT-W20": { ...MOCK_POST_MATCH_REPORT },
};

export async function getAssistantIssues(): Promise<AssistantIssue[]> {
  return Promise.resolve([...MOCK_ISSUES]);
}

export async function getRoundReview(roundId: string): Promise<RoundReview> {
  if (roundId === "W21") {
    return Promise.resolve(MOCK_ROUND_REVIEW);
  }
  return Promise.resolve({
    ...MOCK_ROUND_REVIEW,
    roundId,
    title: `Round ${roundId}`,
    openIssueIds: [],
    hardBlockerCount: 0,
    publishable: true,
  });
}

export async function getTeamReadiness(teamId: string, _matchId?: string): Promise<TeamReadiness> {
  const mock = MOCK_TEAM_READINESS[teamId];
  if (mock) return Promise.resolve(mock);
  return Promise.resolve({
    teamId,
    teamName: teamId,
    readinessState: "READY",
    confirmedPlayers: 0,
    unknownRsvp: 0,
    unavailablePlayers: 0,
    blockedPlayers: 0,
    targetSquadSize: 11,
    maxSquadSize: 14,
    supportNeeded: 0,
    positionGaps: [],
    rotationPressure: "LOW",
    warnings: [],
    ruleImpacts: [],
  });
}

export async function getMatchReview(matchId: string): Promise<MatchReview> {
  if (matchId === "match-ROD-W21") {
    return Promise.resolve(MOCK_MATCH_REVIEW);
  }
  return Promise.resolve({
    ...MOCK_MATCH_REVIEW,
    matchId,
    readinessState: "READY",
    selectedPlayerIds: [],
    unavailablePlayerIds: [],
    unknownRsvpPlayerIds: [],
    eligibleNotSelectedPlayerIds: [],
    blockedPlayerIds: [],
    positionGaps: [],
    ruleImpacts: [],
    recommendations: [],
    crossTeamImpacts: [],
    approved: false,
    published: false,
  });
}

export async function getSelectionExplanation(
  scopeType: "ROUND" | "TEAM" | "MATCH" | "PLAYER",
  scopeId: string,
): Promise<SelectionExplanation | null> {
  return Promise.resolve({
    id: `expl-${scopeType}-${scopeId}`,
    scopeType,
    scopeId,
    summary: `Explanation for ${scopeType.toLowerCase()} ${scopeId}`,
    rulesApplied: [],
    blockers: [],
    warnings: [],
    recommendations: [],
    crossTeamImpacts: [],
    createdAt: new Date().toISOString(),
  });
}

export async function recordDecision(input: {
  decisionType: DecisionType;
  entityType: AssistantIssueEntityType;
  entityId: string;
  recommendationId?: string;
  action: DecisionAction;
  reason?: string;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
}): Promise<DecisionRecord> {
  const decision: DecisionRecord = {
    id: `decision-${++mockDecisionCounter}`,
    decisionType: input.decisionType,
    entityType: input.entityType,
    entityId: input.entityId,
    recommendationId: input.recommendationId,
    action: input.action,
    reason: input.reason,
    createdBy: "coach",
    createdAt: new Date().toISOString(),
    beforeSnapshot: input.beforeSnapshot,
    afterSnapshot: input.afterSnapshot,
  };
  mockDecisions.push(decision);
  return Promise.resolve(decision);
}

export async function getPostMatchReport(matchId: string): Promise<PostMatchReport> {
  const existing = mockPostMatchReports[matchId];
  if (existing) return Promise.resolve({ ...existing });
  return Promise.resolve({
    matchId,
    status: "NOT_STARTED",
    playerActuals: [],
  });
}

export async function completePostMatchReport(
  matchId: string,
  input: {
    teamNote?: string;
    playerActuals: PostMatchPlayerActual[];
  },
): Promise<PostMatchReport> {
  const report: PostMatchReport = {
    matchId,
    status: "COMPLETED",
    teamNote: input.teamNote,
    playerActuals: input.playerActuals,
    completedBy: "coach",
    completedAt: new Date().toISOString(),
  };
  mockPostMatchReports[matchId] = report;
  return Promise.resolve(report);
}