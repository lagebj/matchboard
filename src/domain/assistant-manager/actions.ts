"use server";

import { getAssistantIssues } from "@/domain/assistant-manager/service";
import { getRoundReview } from "@/domain/assistant-manager/service";
import { getTeamReadiness } from "@/domain/assistant-manager/service";
import { getMatchReview } from "@/domain/assistant-manager/service";
import { getSelectionExplanation } from "@/domain/assistant-manager/service";
import { recordDecision } from "@/domain/assistant-manager/service";
import { getPostMatchReport } from "@/domain/assistant-manager/service";
import { completePostMatchReport } from "@/domain/assistant-manager/service";

export async function fetchAssistantIssues() {
  return getAssistantIssues();
}

export async function fetchRoundReview(roundId: string) {
  return getRoundReview(roundId);
}

export async function fetchTeamReadiness(teamId: string, matchId?: string) {
  return getTeamReadiness(teamId, matchId);
}

export async function fetchMatchReview(matchId: string) {
  return getMatchReview(matchId);
}

export async function fetchSelectionExplanation(scopeType: "ROUND" | "TEAM" | "MATCH" | "PLAYER", scopeId: string) {
  return getSelectionExplanation(scopeType, scopeId);
}

export async function createDecision(input: Parameters<typeof recordDecision>[0]) {
  return recordDecision(input);
}

export async function fetchPostMatchReport(matchId: string) {
  return getPostMatchReport(matchId);
}

export async function finalizePostMatchReport(matchId: string, input: Parameters<typeof completePostMatchReport>[1]) {
  return completePostMatchReport(matchId, input);
}