import "server-only";

import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { FootballMatchRef } from "@/lib/evidence/football-match-ref";
import { buildMatchContextPack } from "./context-pack";

/**
 * Persistence for the match derivation service (ADR-0155 step B3). "Replace current derived
 * materialization" (source bundle §05) -- never hand-patches a `DerivedMeasurement` row.
 * Recompute deletes every current row for the match's scope and inserts the freshly computed
 * set inside one transaction, the same pattern `rebuildActualTimeline` itself already uses for
 * `ActualPositionInterval`. Idempotent: identical inputs at an unchanged algorithm version
 * produce rows with the same `inputRevision` every time.
 */

async function resolveOrganisationId(ref: FootballMatchRef): Promise<string | null> {
  if (ref.kind === "LEAGUE_MATCH") {
    const match = await db.match.findUnique({ where: { id: ref.matchId }, select: { organisationId: true } });
    return match?.organisationId ?? null;
  }
  const eventMatch = await db.eventMatch.findUnique({ where: { id: ref.eventMatchId }, select: { organisationId: true } });
  return eventMatch?.organisationId ?? null;
}

/**
 * Recomputes and replaces every `DerivedMeasurement` row for one match. A no-op (no delete, no
 * insert) when the match ref itself cannot be resolved -- distinct from "resolved but zero
 * eligible measurements", which legitimately clears any stale rows down to none.
 */
export async function persistMatchContextPack(ref: FootballMatchRef): Promise<{ measurementsWritten: number }> {
  const organisationId = await resolveOrganisationId(ref);
  if (!organisationId) return { measurementsWritten: 0 };

  const drafts = await buildMatchContextPack(ref);
  const matchId = ref.kind === "LEAGUE_MATCH" ? ref.matchId : null;
  const eventMatchId = ref.kind === "EVENT_MATCH" ? ref.eventMatchId : null;

  await db.$transaction(async (tx) => {
    await tx.derivedMeasurement.deleteMany({
      where: ref.kind === "LEAGUE_MATCH" ? { matchId: ref.matchId } : { eventMatchId: ref.eventMatchId },
    });

    if (drafts.length > 0) {
      await tx.derivedMeasurement.createMany({
        data: drafts.map((draft) => ({
          organisationId,
          matchId,
          eventMatchId,
          playerId: draft.playerId,
          metricKey: draft.metricKey,
          metricVersion: draft.metricVersion,
          scopeType: draft.scopeType,
          scopeKey: draft.scopeKey,
          value: draft.value,
          unit: draft.unit,
          numerator: draft.numerator,
          denominator: draft.denominator,
          denominatorUnit: draft.denominatorUnit,
          presentationScale: draft.presentationScale,
          exposureSeconds: draft.quality.exposureSeconds,
          coverage: draft.quality.coverage,
          eligible: draft.quality.eligible,
          missingInputs: draft.quality.missingInputs as unknown as Prisma.InputJsonValue,
          warnings: draft.quality.warnings as unknown as Prisma.InputJsonValue,
          dimensions: draft.dimensions as unknown as Prisma.InputJsonValue,
          sourceRefs: draft.sourceRefs as unknown as Prisma.InputJsonValue,
          inputRevision: draft.inputRevision,
        })),
      });
    }
  });

  return { measurementsWritten: drafts.length };
}
