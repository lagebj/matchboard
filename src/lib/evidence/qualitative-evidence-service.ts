import "server-only";

import { db } from "@/lib/db";
import { computeSourceFingerprint, type JsonValue } from "@/lib/ai/fingerprints";
import type {
  PrismaClient,
  QualitativeEvidenceSourceType,
  QualitativeEvidenceScope,
  QualitativeEvidencePhase,
  QualitativeEvidencePolarity,
  QualitativeEvidenceExplicitness,
  MatchPeriod,
} from "@/generated/prisma/client";

/**
 * Reusable coach-reported qualitative evidence (ADR-0152 §4, bundle `04_QUALITATIVE_EVIDENCE_MODEL.md`).
 * Every observation this module writes carries `origin = COACH_REPORTED` implicitly — AI
 * extraction (a later slice) is a parsing mechanism over coach text, never inference; inference
 * stays in `AiAdvisorInsight`. This module owns only the DETERMINISTIC derivation path (bundle
 * §9/§14) — sources that already supply structure (a selected tactical theme + comment). The
 * AI_STRUCTURED path (queued, provider-backed) is a later slice.
 */

export type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export type NewQualitativeObservationInput = {
  scope: QualitativeEvidenceScope;
  phase: QualitativeEvidencePhase;
  polarity: QualitativeEvidencePolarity;
  statement: string;
  period?: MatchPeriod | null;
  playerId?: string | null;
  secondaryPlayerId?: string | null;
  explicitness?: QualitativeEvidenceExplicitness;
};

/**
 * League-only for now — `teamId` has no resolution path for an Event match (no `Team` relation
 * anywhere in Event's own model tree, and this app supports multi-team organisations, so there
 * is no safe default). See https://github.com/lagebj/matchboard/issues/691.
 */
export type QualitativeEvidenceMatchSubject = { matchId: string };

export type RecordDeterministicExtractionInput = {
  organisationId: string;
  teamId: string;
  sourceType: QualitativeEvidenceSourceType;
  sourceId: string;
  /** Already-normalized fingerprint payload (bundle §10) — trimmed/CRLF-normalized text plus
   * every structured field that changes the derived claims; nothing else (a debrief field this
   * source type doesn't read must never be part of its fingerprint). */
  fingerprintPayload: JsonValue;
  subject: QualitativeEvidenceMatchSubject;
  observations: NewQualitativeObservationInput[];
};

export type RecordDeterministicExtractionResult =
  | { status: "UNCHANGED"; runId: string }
  | { status: "RECORDED"; runId: string; observationCount: number };

/**
 * Bundle §9/§11/§14 — deterministic derivation: fingerprint-keyed idempotency (the exact same
 * normalized source never re-derives — the unique index on
 * `(organisationId, sourceType, sourceId, sourceFingerprint)` is what actually enforces this),
 * and superseding whatever prior successful run existed for the same `(sourceType, sourceId)`
 * lineage when the fingerprint changes. Safe to call with zero observations (e.g. a coach
 * retracted a claim on resubmit) — that still supersedes stale prior evidence; it just leaves
 * nothing active to replace it with (bundle §11: "never replace good evidence with a failed
 * run" — inapplicable here since deterministic derivation cannot fail, but the same "retracted
 * claims must stop being active" principle applies to an empty result).
 */
export async function recordDeterministicExtraction(
  input: RecordDeterministicExtractionInput,
  client?: TransactionClient,
): Promise<RecordDeterministicExtractionResult> {
  const prisma = client ?? db;
  const sourceFingerprint = computeSourceFingerprint(input.fingerprintPayload);

  const existing = await prisma.qualitativeEvidenceExtractionRun.findFirst({
    where: { organisationId: input.organisationId, sourceType: input.sourceType, sourceId: input.sourceId, sourceFingerprint },
    select: { id: true },
  });
  if (existing) return { status: "UNCHANGED", runId: existing.id };

  async function write(tx: TransactionClient): Promise<string> {
    await tx.qualitativeEvidenceExtractionRun.updateMany({
      where: { organisationId: input.organisationId, sourceType: input.sourceType, sourceId: input.sourceId, status: "SUCCEEDED", supersededAt: null },
      data: { supersededAt: new Date() },
    });

    const inputChars = JSON.stringify(input.fingerprintPayload).length;
    const run = await tx.qualitativeEvidenceExtractionRun.create({
      data: {
        organisationId: input.organisationId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceFingerprint,
        derivationMethod: "DETERMINISTIC",
        status: "SUCCEEDED",
        inputChars,
        outputChars: input.observations.reduce((n, o) => n + o.statement.length, 0),
      },
    });

    if (input.observations.length > 0) {
      await tx.qualitativeEvidenceObservation.createMany({
        data: input.observations.map((o) => ({
          organisationId: input.organisationId,
          extractionRunId: run.id,
          teamId: input.teamId,
          matchId: input.subject.matchId,
          playerId: o.playerId ?? undefined,
          secondaryPlayerId: o.secondaryPlayerId ?? undefined,
          scope: o.scope,
          phase: o.phase,
          polarity: o.polarity,
          explicitness: o.explicitness ?? "EXPLICIT",
          period: o.period ?? undefined,
          statement: o.statement,
        })),
      });
    }

    return run.id;
  }

  const runId = client ? await write(client) : await db.$transaction((tx) => write(tx));
  return { status: "RECORDED", runId, observationCount: input.observations.length };
}

type ObservationRow = {
  id: string;
  scope: QualitativeEvidenceScope;
  phase: QualitativeEvidencePhase;
  polarity: QualitativeEvidencePolarity;
  explicitness: QualitativeEvidenceExplicitness;
  period: MatchPeriod | null;
  statement: string;
  playerId: string | null;
  secondaryPlayerId: string | null;
  matchId: string | null;
  eventMatchId: string | null;
  createdAt: Date;
};

const ACTIVE_OBSERVATION_SELECT = {
  id: true,
  scope: true,
  phase: true,
  polarity: true,
  explicitness: true,
  period: true,
  statement: true,
  playerId: true,
  secondaryPlayerId: true,
  matchId: true,
  eventMatchId: true,
  createdAt: true,
} as const;

/** Every read helper below returns only SUCCEEDED, non-superseded runs' observations (bundle
 * §16: "return only successful non-superseded runs") — guest-derived evidence is never persisted
 * here at all (writePlayerObservations excludes guests upstream), so there is nothing further to
 * filter for that. */
const ACTIVE_RUN_FILTER = { extractionRun: { status: "SUCCEEDED" as const, supersededAt: null } };

export async function getQualitativeEvidenceForMatch(
  ref: { matchId: string } | { eventMatchId: string },
  organisationId: string,
): Promise<ObservationRow[]> {
  return db.qualitativeEvidenceObservation.findMany({
    where: { organisationId, ...("matchId" in ref ? { matchId: ref.matchId } : { eventMatchId: ref.eventMatchId }), ...ACTIVE_RUN_FILTER },
    select: ACTIVE_OBSERVATION_SELECT,
    orderBy: { createdAt: "asc" },
  });
}

export async function getQualitativeEvidenceForTeamWindow(
  teamId: string,
  from: Date,
  to: Date,
  organisationId: string,
  limit = 200,
): Promise<ObservationRow[]> {
  return db.qualitativeEvidenceObservation.findMany({
    where: { organisationId, teamId, createdAt: { gte: from, lte: to }, ...ACTIVE_RUN_FILTER },
    select: ACTIVE_OBSERVATION_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** ADR-0152 §6 "Recent team patterns" (bundle `05_ASSISTANT_COACH_LEARNING_PIPELINE.md`) — evidence
 * for a caller-selected bounded set of prior matches (e.g. "the last 8 completed matches in the
 * last 42 days"), rather than a raw date window alone. Distinct from
 * `getQualitativeEvidenceForTeamWindow`: that one caps by count within a window; this one takes
 * the exact match set the caller already decided is in scope. */
export async function getQualitativeEvidenceForMatches(matchIds: string[], organisationId: string): Promise<ObservationRow[]> {
  if (matchIds.length === 0) return [];
  return db.qualitativeEvidenceObservation.findMany({
    where: { organisationId, matchId: { in: matchIds }, ...ACTIVE_RUN_FILTER },
    select: ACTIVE_OBSERVATION_SELECT,
    orderBy: { createdAt: "desc" },
  });
}

export async function getQualitativeEvidenceForOpponent(
  teamId: string,
  opponentTeamId: string,
  organisationId: string,
  limitMatches = 10,
): Promise<ObservationRow[]> {
  const recentMatchIds = await db.match.findMany({
    where: { organisationId, teamId, opponentTeamId },
    select: { id: true },
    orderBy: { startsAt: "desc" },
    take: limitMatches,
  });
  const matchIds = recentMatchIds.map((m) => m.id);
  if (matchIds.length === 0) return [];

  return db.qualitativeEvidenceObservation.findMany({
    where: { organisationId, teamId, scope: "OPPONENT", matchId: { in: matchIds }, ...ACTIVE_RUN_FILTER },
    select: ACTIVE_OBSERVATION_SELECT,
    orderBy: { createdAt: "desc" },
  });
}

export async function getQualitativeEvidenceForPlayer(
  playerId: string,
  from: Date,
  to: Date,
  organisationId: string,
  limit = 50,
): Promise<ObservationRow[]> {
  return db.qualitativeEvidenceObservation.findMany({
    where: {
      organisationId,
      createdAt: { gte: from, lte: to },
      OR: [{ playerId }, { secondaryPlayerId: playerId }],
      ...ACTIVE_RUN_FILTER,
    },
    select: ACTIVE_OBSERVATION_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
