import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { OPPONENT_ENGINE_VERSION } from "./opponent-engine";
import { FORMULA_VERSION } from "@/lib/opponents/sporting-level-calculation";

export type OpponentAssessmentSource = "AUTOMATIC" | "MANUAL_EDIT" | "MIGRATION" | "HISTORICAL_REPLAY";

export type OpponentConfidence = "unknown" | "low" | "medium" | "high";

export interface RecordOpponentAssessmentChangeInput {
  opponentTeamId: string;
  beforeLevel: number | null;
  afterLevel: number | null;
  source: OpponentAssessmentSource;
  reason: string | null;
  evidenceMatchId: string | null;
  confidence: OpponentConfidence | null;
  dataQuality: string | null;
}

export async function recordOpponentAssessmentChange(
  input: RecordOpponentAssessmentChangeInput,
): Promise<{ id: string }> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const change = await db.opponentAssessmentChange.create({
    data: {
      organisationId: ctx.organisationId,
      opponentTeamId: input.opponentTeamId,
      beforeLevel: input.beforeLevel,
      afterLevel: input.afterLevel,
      source: input.source,
      reason: input.reason,
      evidenceMatchId: input.evidenceMatchId,
      engineVersion: OPPONENT_ENGINE_VERSION,
      formulaVersion: FORMULA_VERSION,
      confidence: input.confidence,
      dataQuality: input.dataQuality,
    },
  });

  return { id: change.id };
}

export async function getOpponentAssessmentHistory(
  opponentTeamId: string,
  orgFilter: { type: "org"; organisationId: string; filter: object },
): Promise<Array<{
  id: string;
  beforeLevel: number | null;
  afterLevel: number | null;
  source: string;
  reason: string | null;
  evidenceMatchId: string | null;
  engineVersion: string;
  formulaVersion: string;
  confidence: string | null;
  dataQuality: string | null;
  createdAt: Date;
}>> {
  if (orgFilter.type !== "org") return [];

  const rows = await db.opponentAssessmentChange.findMany({
    where: {
      opponentTeamId,
      ...orgFilter.filter,
    },
    select: {
      id: true,
      beforeLevel: true,
      afterLevel: true,
      source: true,
      reason: true,
      evidenceMatchId: true,
      engineVersion: true,
      formulaVersion: true,
      confidence: true,
      dataQuality: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    ...row,
    beforeLevel: row.beforeLevel ? Number(row.beforeLevel) : null,
    afterLevel: row.afterLevel ? Number(row.afterLevel) : null,
  }));
}

export async function getLatestOpponentAssessment(
  opponentTeamId: string,
  orgFilter: { type: "org"; organisationId: string; filter: object },
): Promise<{ afterLevel: number; confidence: string; dataQuality: string } | null> {
  if (orgFilter.type !== "org") return null;

  const latest = await db.opponentAssessmentChange.findFirst({
    where: {
      opponentTeamId,
      ...orgFilter.filter,
      afterLevel: { not: null },
    },
    select: {
      afterLevel: true,
      confidence: true,
      dataQuality: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!latest || !latest.afterLevel) return null;

  return {
    afterLevel: Number(latest.afterLevel),
    confidence: latest.confidence ?? "unknown",
    dataQuality: latest.dataQuality ?? "B",
  };
}