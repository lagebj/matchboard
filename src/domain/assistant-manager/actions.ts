"use server";

import { requireCoachAccess } from "@/lib/auth";
import { getRoundReview } from "@/domain/assistant-manager/service";
import { getTeamReadiness } from "@/domain/assistant-manager/service";
import { getMatchReview } from "@/domain/assistant-manager/service";
import { getSelectionExplanation } from "@/domain/assistant-manager/service";
import { recordDecision } from "@/domain/assistant-manager/service";
import { getPostMatchReport } from "@/domain/assistant-manager/service";
import { completePostMatchReport } from "@/domain/assistant-manager/service";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";

export async function fetchRoundReview(roundId: string) {
  await requireCoachAccess();
  return getRoundReview(roundId);
}

export async function fetchRoundPlanIntegrity(roundId: string) {
  await requireCoachAccess();
  const integrity = await computeRoundPlanIntegrity(roundId);
  return integrity.signals;
}

export async function fetchTeamReadiness(teamId: string, matchId?: string) {
  await requireCoachAccess();
  return getTeamReadiness(teamId, matchId);
}

export async function fetchMatchReview(matchId: string) {
  await requireCoachAccess();
  return getMatchReview(matchId);
}

export async function fetchSelectionExplanation(scopeType: "ROUND" | "TEAM" | "MATCH" | "PLAYER", scopeId: string) {
  await requireCoachAccess();
  return getSelectionExplanation(scopeType, scopeId);
}

export async function createDecision(input: Parameters<typeof recordDecision>[0]) {
  await requireCoachAccess();
  return recordDecision(input);
}

export async function fetchPostMatchReport(matchId: string) {
  await requireCoachAccess();
  return getPostMatchReport(matchId);
}

export async function finalizePostMatchReport(matchId: string, input: Parameters<typeof completePostMatchReport>[1]) {
  await requireCoachAccess();
  return completePostMatchReport(matchId, input);
}