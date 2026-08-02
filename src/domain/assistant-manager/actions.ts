"use server";

import { requireCoachAccess } from "@/lib/auth";
import { requireActorContext } from "@/lib/auth/actor-context";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { db } from "@/lib/db";
import { getRoundReview } from "@/domain/assistant-manager/service";
import { getTeamReadiness } from "@/domain/assistant-manager/service";
import { getMatchReview } from "@/domain/assistant-manager/service";
import { getSelectionExplanation } from "@/domain/assistant-manager/service";
import { recordDecision } from "@/domain/assistant-manager/service";
import { getPostMatchReport } from "@/domain/assistant-manager/service";
import { completePostMatchReport } from "@/domain/assistant-manager/service";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";

async function requireRoundOrgAccess(roundId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== "org") return;
  const round = await db.matchRound.findFirst({
    where: { id: roundId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!round) throw new Error("Round not found or access denied.");
}

async function requireTeamOrgAccess(teamId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== "org") return;
  const team = await db.team.findFirst({
    where: { id: teamId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!team) throw new Error("Team not found or access denied.");
}

async function requireMatchOrgAccess(matchId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== "org") return;
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!match) throw new Error("Match not found or access denied.");
}

export async function fetchRoundReview(roundId: string) {
  const ctx = await requireActorContext();
  await requireRoundOrgAccess(roundId, ctx.orgFilter);
  return getRoundReview(roundId);
}

export async function fetchRoundPlanIntegrity(roundId: string) {
  const ctx = await requireActorContext();
  await requireRoundOrgAccess(roundId, ctx.orgFilter);
  const integrity = await computeRoundPlanIntegrity(roundId);
  return integrity.signals;
}

export async function fetchTeamReadiness(teamId: string, matchId?: string) {
  const ctx = await requireActorContext();
  await requireTeamOrgAccess(teamId, ctx.orgFilter);
  if (matchId) {
    await requireMatchOrgAccess(matchId, ctx.orgFilter);
  }
  return getTeamReadiness(teamId, matchId);
}

export async function fetchMatchReview(matchId: string) {
  const ctx = await requireActorContext();
  await requireMatchOrgAccess(matchId, ctx.orgFilter);
  return getMatchReview(matchId);
}

export async function fetchSelectionExplanation(scopeType: "ROUND" | "TEAM" | "MATCH" | "PLAYER", scopeId: string) {
  const ctx = await requireActorContext();
  if (scopeType === "ROUND") {
    await requireRoundOrgAccess(scopeId, ctx.orgFilter);
  } else if (scopeType === "TEAM") {
    await requireTeamOrgAccess(scopeId, ctx.orgFilter);
  } else if (scopeType === "MATCH") {
    await requireMatchOrgAccess(scopeId, ctx.orgFilter);
  }
  return getSelectionExplanation(scopeType, scopeId);
}

export async function createDecision(input: Parameters<typeof recordDecision>[0]) {
  await requireCoachAccess();
  return recordDecision(input);
}

export async function fetchPostMatchReport(matchId: string) {
  const ctx = await requireActorContext();
  await requireMatchOrgAccess(matchId, ctx.orgFilter);
  return getPostMatchReport(matchId);
}

export async function finalizePostMatchReport(matchId: string, input: Parameters<typeof completePostMatchReport>[1]) {
  const ctx = await requireActorContext();
  await requireMatchOrgAccess(matchId, ctx.orgFilter);
  return completePostMatchReport(matchId, input);
}