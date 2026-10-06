import "server-only";
import { db } from "@/lib/db";
import type { AssistantCoachUncertainty } from "@/generated/prisma/client";
import { getOrganisationAiSettings, isAiCapabilityEnabled } from "@/lib/ai/organisation-ai-settings";
import type { EvidenceRef } from "@/lib/development-context/types";

/**
 * Player Detail's Assistant Coach hypotheses (ADR-0155 step B7, surfaced on a page for the first
 * time by ADR-0157 C5 — B8's own hardening note disclosed "no dedicated display component and no
 * automatic domain trigger yet"). Reads the one current run's `ACTIVE` hypotheses only: dismissed
 * and promoted hypotheses are history, not a current hypothesis to act on again
 * (`AssistantCoachHypothesisState` already encodes that — this reader never re-derives it).
 *
 * Returns `[]` whenever Assistant Coach is unavailable for this organisation (master AI switch
 * off, no active provider connection, or the `ASSISTANT_COACH` capability itself disabled) —
 * mirrors `getPlayerDevelopmentCycleInsight()`'s own gating exactly, so Player Detail's Overview
 * and Development tabs stay fully useful with AI disabled (ADR-0157 §5's binding AI-boundary
 * rule).
 */

export type PlayerAssistantCoachHypothesis = {
  id: string;
  statement: string;
  uncertainty: AssistantCoachUncertainty;
  supportingRefs: EvidenceRef[];
  contradictingRefs: EvidenceRef[];
  missingEvidence: string[];
};

export async function getPlayerAssistantCoachHypotheses(
  organisationId: string,
  playerId: string,
): Promise<PlayerAssistantCoachHypothesis[]> {
  const settings = await getOrganisationAiSettings(organisationId);
  if (!settings || !settings.enabled || !settings.activeConnectionId) return [];
  if (!isAiCapabilityEnabled(settings, "ASSISTANT_COACH")) return [];

  const activeConnection = await db.aiProviderConnection.findFirst({
    where: { id: settings.activeConnectionId, organisationId },
    select: { status: true },
  });
  if (!activeConnection || activeConnection.status !== "READY") return [];

  const rows = await db.assistantCoachHypothesis.findMany({
    where: {
      organisationId,
      state: "ACTIVE",
      run: { playerId, organisationId, status: "SUCCEEDED" },
    },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      statement: true,
      uncertainty: true,
      supportingRefs: true,
      contradictingRefs: true,
      missingEvidence: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    statement: row.statement,
    uncertainty: row.uncertainty,
    supportingRefs: row.supportingRefs as unknown as EvidenceRef[],
    contradictingRefs: row.contradictingRefs as unknown as EvidenceRef[],
    missingEvidence: row.missingEvidence as unknown as string[],
  }));
}
