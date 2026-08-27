import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { addPlayerToDraftMatch, removePlayerFromDraftMatch } from "@/lib/selection/manual-draft-edit";
import { computeRoundPlanIntegrity, type RoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";

export type ManualEditPreview = {
  currentIntegrity: RoundPlanIntegrity | null;
  proposedIntegrity: RoundPlanIntegrity | null;
  blockedChanges: string[];
  decisionRequiredChanges: string[];
  newSignals: string[];
  resolvedSignals: string[];
};

export async function previewManualAddImpact(
  matchId: string,
  playerId: string,
  role: string,
  orgFilter: OrgFilterMode,
): Promise<ManualEditPreview> {
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { matchRoundId: true },
  });

  if (!match) {
    return {
      currentIntegrity: null,
      proposedIntegrity: null,
      blockedChanges: ["Match not found"],
      decisionRequiredChanges: [],
      newSignals: [],
      resolvedSignals: [],
    };
  }

  let currentIntegrity: RoundPlanIntegrity | null = null;
  try {
    currentIntegrity = await computeRoundPlanIntegrity(match.matchRoundId);
  } catch {
    // May not have generated selections yet
  }

  const currentSignalCodes = new Set((currentIntegrity?.signals ?? []).map((s) => s.ruleCode));

  const editResult = await addPlayerToDraftMatch(matchId, playerId, role as "CORE" | "SUPPORT" | "DEVELOPMENT" | "BACKFILL");

  if (!editResult.success) {
    return {
      currentIntegrity,
      proposedIntegrity: currentIntegrity,
      blockedChanges: [editResult.errors.length > 0 ? editResult.errors[0] : "Edit would violate a rule"],
      decisionRequiredChanges: [],
      newSignals: [],
      resolvedSignals: [],
    };
  }

  let proposedIntegrity: RoundPlanIntegrity | null = null;
  try {
    proposedIntegrity = await computeRoundPlanIntegrity(match.matchRoundId);
  } catch {
    // ignore
  }

  const proposedSignalCodes = new Set((proposedIntegrity?.signals ?? []).map((s) => s.ruleCode));

  const newSignals = [...proposedSignalCodes].filter((c) => !currentSignalCodes.has(c));
  const resolvedSignals = [...currentSignalCodes].filter((c) => !proposedSignalCodes.has(c));

  const blockedChanges = (proposedIntegrity?.signals ?? [])
    .filter((s) => s.kind === "BLOCKED")
    .map((s) => s.title);

  const decisionRequiredChanges = (proposedIntegrity?.signals ?? [])
    .filter((s) => s.kind === "DECISION_REQUIRED")
    .map((s) => s.title);

  await removePlayerFromDraftMatch(matchId, playerId);

  return {
    currentIntegrity,
    proposedIntegrity,
    blockedChanges,
    decisionRequiredChanges,
    newSignals,
    resolvedSignals,
  };
}

export async function previewManualRemoveImpact(
  matchId: string,
  playerId: string,
  orgFilter: OrgFilterMode,
): Promise<ManualEditPreview> {
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { matchRoundId: true },
  });

  if (!match) {
    return {
      currentIntegrity: null,
      proposedIntegrity: null,
      blockedChanges: ["Match not found"],
      decisionRequiredChanges: [],
      newSignals: [],
      resolvedSignals: [],
    };
  }

  let currentIntegrity: RoundPlanIntegrity | null = null;
  try {
    currentIntegrity = await computeRoundPlanIntegrity(match.matchRoundId);
  } catch {
    // ignore
  }

  const currentSignalCodes = new Set((currentIntegrity?.signals ?? []).map((s) => s.ruleCode));

  const removeResult = await removePlayerFromDraftMatch(matchId, playerId);

  if (!removeResult.success) {
    return {
      currentIntegrity,
      proposedIntegrity: currentIntegrity,
      blockedChanges: [removeResult.errors.length > 0 ? removeResult.errors[0] : "Could not remove player"],
      decisionRequiredChanges: [],
      newSignals: [],
      resolvedSignals: [],
    };
  }

  const existingSelection = await db.selection.findFirst({
    where: { matchId, playerId, status: "DRAFT" },
    select: { role: true },
  });

  let proposedIntegrity: RoundPlanIntegrity | null = null;
  try {
    proposedIntegrity = await computeRoundPlanIntegrity(match.matchRoundId);
  } catch {
    // ignore
  }

  const proposedSignalCodes = new Set((proposedIntegrity?.signals ?? []).map((s) => s.ruleCode));
  const newSignals = [...proposedSignalCodes].filter((c) => !currentSignalCodes.has(c));
  const resolvedSignals = [...currentSignalCodes].filter((c) => !proposedSignalCodes.has(c));

  const blockedChanges = (proposedIntegrity?.signals ?? [])
    .filter((s) => s.kind === "BLOCKED")
    .map((s) => s.title);

  const decisionRequiredChanges = (proposedIntegrity?.signals ?? [])
    .filter((s) => s.kind === "DECISION_REQUIRED")
    .map((s) => s.title);

  if (existingSelection) {
    await addPlayerToDraftMatch(matchId, playerId, existingSelection.role as "CORE" | "SUPPORT" | "DEVELOPMENT" | "BACKFILL");
  }

  return {
    currentIntegrity,
    proposedIntegrity,
    blockedChanges,
    decisionRequiredChanges,
    newSignals,
    resolvedSignals,
  };
}