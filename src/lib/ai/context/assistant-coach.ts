import "server-only";
import { db } from "@/lib/db";
import { AiInsightSubjectType } from "@/generated/prisma/client";
import {
  registerAiCapabilityHandler,
  type AiCapabilityContext,
  type AiCapabilityHandler,
  type AiCapabilityRefTarget,
} from "@/lib/ai/jobs/capability-handler";
import type { JsonValue } from "@/lib/ai/fingerprints";
import { dedupeQualitativeObservationsByStatement } from "@/lib/evidence/qualitative-evidence-service";

/**
 * `ASSISTANT_COACH` context builder (ADR-0155 step B7, source bundle §07). Scope is `PLAYER` --
 * `scopeId` is a bare `Player.id`. Unlike every other capability's `fact:...` string evidence
 * refs, this evidence pack's facts/measurements/trends already carry real, structured
 * `EvidenceRef[]` provenance from `DerivedMeasurement`/`DerivedTrend` (ADR-0155) -- there is
 * nothing to gain from re-encoding that as a second ref convention. `context.evidenceRefs` here
 * is this builder's own `{kind}\u0000{id}` encoding, consumed only by this capability's own
 * runner branch, never `response-validation.ts`'s shared `fact:...` checker.
 *
 * Bundle §06 "Numerical authority": every number in this pack is read directly from
 * DerivedMeasurement/DerivedTrend rows the deterministic layer already computed -- the model is
 * never asked to recalculate role seconds, zone shares, co-presence, game-state splits, or trend
 * direction, only to interpret them.
 */

const MAX_QUALITATIVE_OBSERVATIONS = 40;
const MAX_ACTIVE_THREADS = 10;

/** Shared with runner.ts's Assistant Coach validation branch -- the one encoding both sides must agree on. */
export function evidenceRefKey(kind: string, id: string): string {
  return `${kind}\u0000${id}`;
}

export async function buildAssistantCoachContext(params: {
  organisationId: string;
  scopeId: string;
}): Promise<AiCapabilityContext | null> {
  const player = await db.player.findFirst({
    where: { id: params.scopeId, organisationId: params.organisationId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!player) return null;

  const [measurements, trends, qualitativeObservations, activeThreads] = await Promise.all([
    db.derivedMeasurement.findMany({
      where: { organisationId: params.organisationId, playerId: player.id, eligible: true },
      select: {
        id: true,
        metricKey: true,
        metricVersion: true,
        scopeType: true,
        scopeKey: true,
        value: true,
        unit: true,
        numerator: true,
        denominator: true,
        denominatorUnit: true,
        presentationScale: true,
        coverage: true,
        eligible: true,
        missingInputs: true,
        warnings: true,
        exposureSeconds: true,
        dimensions: true,
        sourceRefs: true,
        inputRevision: true,
      },
      orderBy: { computedAt: "desc" },
    }),
    db.derivedTrend.findMany({
      where: { organisationId: params.organisationId, playerId: player.id },
      select: {
        id: true,
        metricKey: true,
        metricVersion: true,
        dimensions: true,
        previousValue: true,
        latestValue: true,
        delta: true,
        direction: true,
        materialityThreshold: true,
        coverage: true,
        eligible: true,
        missingInputs: true,
        warnings: true,
        sourceRefs: true,
        inputRevision: true,
      },
    }),
    db.qualitativeEvidenceObservation.findMany({
      where: { organisationId: params.organisationId, playerId: player.id, extractionRun: { status: "SUCCEEDED", supersededAt: null } },
      select: { id: true, scope: true, phase: true, polarity: true, statement: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: MAX_QUALITATIVE_OBSERVATIONS * 2, // dedupe below may remove some; over-fetch a bounded amount.
    }),
    db.developmentThread.findMany({
      where: { organisationId: params.organisationId, playerId: player.id, status: "ACTIVE" },
      select: { id: true, focus: true, category: true, startedAt: true },
      orderBy: { startedAt: "desc" },
      take: MAX_ACTIVE_THREADS,
    }),
  ]);

  if (measurements.length === 0 && trends.length === 0 && qualitativeObservations.length === 0 && activeThreads.length === 0) {
    return null;
  }

  const playerRef = "P01";
  const refMap = new Map<string, AiCapabilityRefTarget>();
  refMap.set(playerRef, { subjectType: AiInsightSubjectType.PLAYER, entityId: player.id });

  const evidenceRefs = new Set<string>();
  for (const m of measurements) evidenceRefs.add(evidenceRefKey("DERIVED_MEASUREMENT", m.id));
  for (const t of trends) evidenceRefs.add(evidenceRefKey("DERIVED_TREND", t.id));
  const dedupedObservations = dedupeQualitativeObservationsByStatement(qualitativeObservations)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, MAX_QUALITATIVE_OBSERVATIONS);
  for (const o of dedupedObservations) evidenceRefs.add(evidenceRefKey("QUALITATIVE_OBSERVATION", o.id));
  for (const t of activeThreads) evidenceRefs.add(evidenceRefKey("HUMAN_ASSESSMENT", t.id));

  // Cast at the boundary: Prisma's own JsonValue type (for the embedded dimensions/sourceRefs/
  // missingInputs/warnings columns) is structurally different from this module's JsonValue, even
  // though both only ever hold plain JSON-serializable data at runtime.
  const normalizedContext = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    player: { id: playerRef, displayName: [player.firstName, player.lastName].filter(Boolean).join(" ") },
    scope: { type: "PLAYER", ref: playerRef },
    facts: [
      ...dedupedObservations.map((o) => ({
        evidenceRef: { kind: "QUALITATIVE_OBSERVATION", id: o.id },
        scope: o.scope,
        phase: o.phase,
        polarity: o.polarity,
        statement: o.statement,
        occurredAt: o.createdAt.toISOString(),
      })),
      ...activeThreads.map((t) => ({
        evidenceRef: { kind: "HUMAN_ASSESSMENT", id: t.id },
        kind: "ACTIVE_DEVELOPMENT_THREAD",
        focus: t.focus,
        category: t.category,
        startedAt: t.startedAt.toISOString(),
      })),
    ],
    measurements: measurements.map((m) => ({
      metricKey: m.metricKey,
      metricVersion: m.metricVersion,
      scopeType: m.scopeType,
      scopeKey: m.scopeKey,
      value: m.value,
      unit: m.unit,
      numerator: m.numerator,
      denominator: m.denominator,
      denominatorUnit: m.denominatorUnit,
      presentationScale: m.presentationScale,
      dimensions: m.dimensions,
      quality: {
        coverage: m.coverage,
        missingInputs: m.missingInputs,
        warnings: m.warnings,
        exposureSeconds: m.exposureSeconds,
        eligible: m.eligible,
      },
      sourceRefs: m.sourceRefs,
      inputRevision: m.inputRevision,
      evidenceRef: { kind: "DERIVED_MEASUREMENT", id: m.id },
    })),
    assessments: activeThreads.map((t) => ({
      evidenceRef: { kind: "HUMAN_ASSESSMENT", id: t.id },
      focus: t.focus,
      category: t.category,
    })),
    trends: trends.map((t) => ({
      metricKey: t.metricKey,
      metricVersion: t.metricVersion,
      dimensions: t.dimensions,
      previousValue: t.previousValue,
      latestValue: t.latestValue,
      delta: t.delta,
      direction: t.direction,
      materialityThreshold: t.materialityThreshold,
      quality: { coverage: t.coverage, missingInputs: t.missingInputs, warnings: t.warnings, eligible: t.eligible },
      sourceRefs: t.sourceRefs,
      inputRevision: t.inputRevision,
      evidenceRef: { kind: "DERIVED_TREND", id: t.id },
    })),
  };

  const instructions = [
    "Capability: assistant_coach. Build hypotheses about this one player using only the supplied structured facts, measurements, assessments, and trends -- never invent a number not already present in `measurements`/`trends`.",
    "Preserve the distinction between observation, measurement, and interpretation (bundle §07): a measurement reports what Matchboard computed; a hypothesis is your own interpretation and must be stated as a possibility, never as an established fact about the player's character, confidence, ambition, or permanent ability.",
    "Good: 'Matchboard measured more role-adjusted actions across the latest eligible window. One possible explanation is earlier recognition of the role, but the available evidence does not establish the cause.' Bad as a factual conclusion: 'The player is now more confident.'",
    "Each hypothesis requires: a statement; an uncertainty of LOW, MEDIUM, or HIGH (HIGH means high uncertainty, not high confidence); supportingRefs and contradictingRefs copied verbatim from the `evidenceRef` field of the exact facts/measurements/trends you are citing -- never construct or guess a ref; and missingEvidence naming what would reduce uncertainty.",
    "Produce at most 6 hypotheses. If the supplied facts do not support any hypothesis, return an empty hypotheses array -- never pad with a weak or speculative hypothesis just to produce output.",
    "Never recalculate role seconds, zone shares, co-presence, game-state splits, or trend direction yourself -- cite the supplied value.",
  ].join(" ");

  return { normalizedContext: normalizedContext as unknown as JsonValue, instructions, refMap, evidenceRefs };
}

export const assistantCoachCapabilityHandler: AiCapabilityHandler = {
  capability: "ASSISTANT_COACH",
  buildContext: buildAssistantCoachContext,
};

registerAiCapabilityHandler(assistantCoachCapabilityHandler);
