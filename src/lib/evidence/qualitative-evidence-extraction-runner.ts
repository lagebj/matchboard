import "server-only";

import { db } from "@/lib/db";
import type { QualitativeEvidenceSourceType } from "@/generated/prisma/client";
import { runWithSystemPrivilege, runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { logger } from "@/lib/logger";
import { getOrganisationAiSettings } from "@/lib/ai/organisation-ai-settings";
import { getProviderConnection } from "@/lib/ai/provider-connections";
import { getProviderAdapter } from "@/lib/ai/providers/provider-adapter-registry";
import { fromPrismaAiProviderId } from "@/lib/ai/provider-registry";
import { withProviderCredential, ProviderCredentialAccessError } from "@/lib/ai/credential-access";
import { safeParseDebriefAnswers } from "@/lib/post-match/debrief/v1";
import { normalizeSourceText } from "@/lib/post-match/debrief/map-to-qualitative-evidence";
import { safeParseExtractionResponse, validateExtractionSemantics, EXTRACTION_STABLE_INSTRUCTIONS, type ExtractionResponse } from "./qualitative-evidence-extraction-contract";

/**
 * AI_STRUCTURED extraction cron processing (ADR-0152 §4, bundle §9/§11/§12/§13). Claims a
 * bounded batch of `QualitativeEvidenceExtractionRun` rows the same atomic way
 * `ai/jobs/runner.ts` claims `AiAdvisorJob` rows (a distinct queue table, since this model's
 * columns and output contract are both unrelated to Advisor insights), then rebuilds each run's
 * source text fresh at process time — same discipline as `ai/jobs/runner.ts`'s own "context is
 * rebuilt fresh at run time, not read back from the job row" — before calling the provider.
 *
 * Wired resolvers: the two bundle §14 debrief sources (BOTH_CHANGED, "Anything else") plus the
 * five legacy free-text sources (bundle §4/§18 — report teamNote, TeamReflection.note,
 * Match.notes, QuickObservation, opponent-encounter text), the latter enqueued only by the
 * bounded historical backfill (`qualitative-evidence-backfill.ts`), never by a current write
 * path. `AI_CLARIFICATION` rows are written directly as DETERMINISTIC evidence by
 * `answerAiInsightClarification` (Slice 4d) and never enter this AI queue at all.
 */

const BATCH_SIZE = 20;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;
const RETRYABLE_ERROR_CODES = new Set(["PROVIDER_RATE_LIMITED", "PROVIDER_UNAVAILABLE", "PROVIDER_TIMEOUT"]);

interface ClaimedExtractionRow {
  id: string;
  organisationId: string;
  sourceType: QualitativeEvidenceSourceType;
  sourceId: string;
  attempts: number;
}

export interface ProcessExtractionRunsSummary {
  claimed: number;
  succeeded: number;
  failed: number;
  retried: number;
  skippedNotEligible: number;
}

async function claimDueExtractionRuns(limit: number): Promise<ClaimedExtractionRow[]> {
  const claimToken = crypto.randomUUID();
  return runWithSystemPrivilege("qualitative-extraction-atomic-claim", () =>
    db.$queryRaw<ClaimedExtractionRow[]>`
      UPDATE "QualitativeEvidenceExtractionRun"
      SET status = 'RUNNING', "lockedAt" = NOW(), "lockedBy" = ${claimToken}, "updatedAt" = NOW()
      WHERE id IN (
        SELECT id FROM "QualitativeEvidenceExtractionRun"
        WHERE status = 'QUEUED' AND "derivationMethod" = 'AI_STRUCTURED' AND "nextAttemptAt" <= NOW()
        ORDER BY "nextAttemptAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, "organisationId", "sourceType", "sourceId", attempts
    `,
  );
}

async function markFailed(runId: string, failureCode: string): Promise<void> {
  await db.qualitativeEvidenceExtractionRun.update({
    where: { id: runId },
    data: { status: "FAILED", failureCode, lockedAt: null, lockedBy: null },
  });
}

async function markRetry(runId: string, attempts: number, failureCode: string): Promise<void> {
  const delayMs = RETRY_DELAYS_MS[attempts - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  await db.qualitativeEvidenceExtractionRun.update({
    where: { id: runId },
    data: { status: "QUEUED", attempts, nextAttemptAt: new Date(Date.now() + delayMs), failureCode, lockedAt: null, lockedBy: null },
  });
}

function resolveErrorOutcome(run: ClaimedExtractionRow, errorCode: string): "retry" | "fail" {
  const attemptsAfterThisFailure = run.attempts + 1;
  if (RETRYABLE_ERROR_CODES.has(errorCode) && attemptsAfterThisFailure < MAX_ATTEMPTS) return "retry";
  return "fail";
}

async function handleFailure(run: ClaimedExtractionRow, errorCode: string): Promise<"retried" | "failed"> {
  const outcome = resolveErrorOutcome(run, errorCode);
  if (outcome === "retry") {
    await markRetry(run.id, run.attempts + 1, errorCode);
    return "retried";
  }
  await markFailed(run.id, errorCode);
  return "failed";
}

type ResolvedDebriefSource = { matchId: string; teamId: string; teamLabel: string; opponentLabel: string; text: string };

/** League-only (see `qualitative-evidence-service.ts`'s own doc comment on why —
 * https://github.com/lagebj/matchboard/issues/691). An Event-sourced debrief resolves to `null`
 * here and the run fails as `SCOPE_NO_LONGER_ELIGIBLE`, the same outcome as any other
 * no-longer-resolvable source; `enqueueQualitativeExtraction` is never actually called from the
 * EVENT submit branch, so this path is defensive, not a normal occurrence. */
async function resolveDebriefSourceText(sourceType: QualitativeEvidenceSourceType, sourceId: string, organisationId: string): Promise<ResolvedDebriefSource | null> {
  if (sourceType !== "POST_MATCH_DEBRIEF_CHANGE" && sourceType !== "POST_MATCH_DEBRIEF_OTHER") {
    return null;
  }

  const debrief = await db.postMatchDebrief.findFirst({ where: { id: sourceId, organisationId }, select: { answers: true, postMatchReportId: true } });
  if (!debrief?.postMatchReportId) return null;

  const report = await db.postMatchReport.findFirst({ where: { id: debrief.postMatchReportId, organisationId }, select: { matchId: true } });
  if (!report) return null;

  const match = await db.match.findFirst({ where: { id: report.matchId, organisationId }, select: { teamId: true, opponent: true, team: { select: { name: true } } } });
  if (!match) return null;

  const parsed = safeParseDebriefAnswers(debrief.answers);
  if (!parsed.success) return null;

  const answers = parsed.data.answers;
  const text =
    sourceType === "POST_MATCH_DEBRIEF_CHANGE"
      ? answers.match_changes?.option === "BOTH_CHANGED"
        ? normalizeSourceText(answers.match_changes.description)
        : ""
      : normalizeSourceText(answers.anything_else.note);

  return { matchId: report.matchId, teamId: match.teamId, teamLabel: match.team.name, opponentLabel: match.opponent, text };
}

/**
 * Legacy free-text sources (bundle §4/§18 — enqueued only by the bounded historical backfill,
 * never by a current write path). Each resolves to its match's own current text, re-read at
 * claim time exactly like the debrief sources: the run's fingerprint identifies what it was
 * enqueued to process, and the text re-resolves so a since-emptied source succeeds with zero
 * observations rather than extracting stale content. All League-only, matching every other
 * qualitative-evidence writer (issue #691).
 *
 * `sourceId` conventions: the owning match's id for every per-match source
 * (`POST_MATCH_TEAM_NOTE`, `TEAM_REFLECTION_NOTE`, `MATCH_NOTE`, `OPPONENT_ENCOUNTER_TEXT` —
 * each is 1:1 with a match by unique constraint) and the QuickObservation row's own id for
 * `QUICK_OBSERVATION`.
 */
async function resolveLegacySourceText(sourceType: QualitativeEvidenceSourceType, sourceId: string, organisationId: string): Promise<ResolvedDebriefSource | null> {
  switch (sourceType) {
    case "POST_MATCH_TEAM_NOTE": {
      // `PostMatchReport` has no `match` relation (only a scalar, unique `matchId`) — the match
      // is necessarily a second query, the same constraint `findRecentLockedMatches` documents.
      const report = await db.postMatchReport.findFirst({
        where: { matchId: sourceId, organisationId, status: "LOCKED" },
        select: { matchId: true, teamNote: true },
      });
      if (!report) return null;
      const match = await db.match.findFirst({ where: { id: report.matchId, organisationId }, select: { teamId: true, opponent: true, team: { select: { name: true } } } });
      if (!match) return null;
      return { matchId: report.matchId, teamId: match.teamId, teamLabel: match.team.name, opponentLabel: match.opponent, text: normalizeSourceText(report.teamNote) };
    }
    case "TEAM_REFLECTION_NOTE": {
      const reflection = await db.teamReflection.findFirst({
        where: { matchId: sourceId, organisationId, note: { not: null } },
        select: { match: { select: { teamId: true, opponent: true, team: { select: { name: true } } } }, note: true },
      });
      if (!reflection) return null;
      return { matchId: sourceId, teamId: reflection.match.teamId, teamLabel: reflection.match.team.name, opponentLabel: reflection.match.opponent, text: normalizeSourceText(reflection.note) };
    }
    case "MATCH_NOTE": {
      const match = await db.match.findFirst({
        where: { id: sourceId, organisationId },
        select: { teamId: true, opponent: true, notes: true, team: { select: { name: true } } },
      });
      if (!match) return null;
      return { matchId: sourceId, teamId: match.teamId, teamLabel: match.team.name, opponentLabel: match.opponent, text: normalizeSourceText(match.notes) };
    }
    case "OPPONENT_ENCOUNTER_TEXT": {
      const observation = await db.opponentEncounterObservation.findFirst({
        where: { matchId: sourceId, organisationId, factualSummary: { not: null } },
        select: { match: { select: { teamId: true, opponent: true, team: { select: { name: true } } } }, factualSummary: true },
      });
      if (!observation) return null;
      return { matchId: sourceId, teamId: observation.match.teamId, teamLabel: observation.match.team.name, opponentLabel: observation.match.opponent, text: normalizeSourceText(observation.factualSummary) };
    }
    case "QUICK_OBSERVATION": {
      const quick = await db.quickObservation.findFirst({
        where: { id: sourceId, organisationId, matchId: { not: null }, convertedToType: null },
        select: { matchId: true, note: true },
      });
      if (!quick?.matchId) return null;
      const match = await db.match.findFirst({ where: { id: quick.matchId, organisationId }, select: { teamId: true, opponent: true, team: { select: { name: true } } } });
      if (!match) return null;
      return { matchId: quick.matchId, teamId: match.teamId, teamLabel: match.team.name, opponentLabel: match.opponent, text: normalizeSourceText(quick.note) };
    }
    default:
      return null;
  }
}

async function resolveSourceText(sourceType: QualitativeEvidenceSourceType, sourceId: string, organisationId: string): Promise<ResolvedDebriefSource | null> {
  const debriefSource = await resolveDebriefSourceText(sourceType, sourceId, organisationId);
  if (debriefSource) return debriefSource;
  return resolveLegacySourceText(sourceType, sourceId, organisationId);
}

async function persistExtractionSuccess(
  runId: string,
  organisationId: string,
  sourceType: QualitativeEvidenceSourceType,
  sourceId: string,
  source: ResolvedDebriefSource,
  response: ExtractionResponse,
  usage: { inputTokens?: number; outputTokens?: number; inputChars: number; outputChars: number },
  providerMeta: { providerConnectionId: string; provider: Parameters<typeof fromPrismaAiProviderId>[0]; model: string },
): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.qualitativeEvidenceExtractionRun.updateMany({
      where: { organisationId, sourceType, sourceId, status: "SUCCEEDED", supersededAt: null },
      data: { supersededAt: new Date() },
    });
    await tx.qualitativeEvidenceExtractionRun.update({
      where: { id: runId },
      data: {
        status: "SUCCEEDED",
        lockedAt: null,
        lockedBy: null,
        providerConnectionId: providerMeta.providerConnectionId,
        provider: providerMeta.provider,
        model: providerMeta.model,
        inputChars: usage.inputChars,
        outputChars: usage.outputChars,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      },
    });
    if (response.observations.length > 0) {
      await tx.qualitativeEvidenceObservation.createMany({
        data: response.observations.map((o) => ({
          organisationId,
          extractionRunId: runId,
          teamId: source.teamId,
          matchId: source.matchId,
          scope: o.scope,
          phase: o.phase,
          polarity: o.polarity,
          explicitness: o.explicitness,
          period: o.period ?? undefined,
          statement: o.statement,
        })),
      });
    }
  });
}

async function processClaimedRun(run: ClaimedExtractionRow): Promise<"succeeded" | "failed" | "retried" | "not_eligible"> {
  return runWithTenantOrganisationId(run.organisationId, async () => {
    const source = await resolveSourceText(run.sourceType, run.sourceId, run.organisationId);
    if (!source) {
      await markFailed(run.id, "SCOPE_NO_LONGER_ELIGIBLE");
      return "failed";
    }

    // The source no longer has anything to extract (e.g. a resubmit moved away from
    // BOTH_CHANGED, or cleared "Anything else") -- a legitimate zero-observation success, not a
    // provider call worth spending on. The run's own `sourceFingerprint` (set at enqueue time)
    // is left untouched -- it identifies what this run was enqueued to process, not a
    // re-derived-at-claim-time value.
    if (!source.text) {
      await db.qualitativeEvidenceExtractionRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", lockedAt: null, lockedBy: null } });
      return "succeeded";
    }

    const settings = await getOrganisationAiSettings(run.organisationId);
    if (!settings?.enabled || !settings.activeConnectionId) {
      await markFailed(run.id, "NOT_ELIGIBLE");
      return "not_eligible";
    }

    const connection = await getProviderConnection(run.organisationId, settings.activeConnectionId);
    if (!connection || connection.status !== "READY" || !connection.model) {
      await markFailed(run.id, "NOT_ELIGIBLE");
      return "not_eligible";
    }

    const input = { text: source.text, team: source.teamLabel, opponent: source.opponentLabel };
    const providerWireId = fromPrismaAiProviderId(connection.provider);
    const adapter = getProviderAdapter(providerWireId);
    const model = connection.model;

    let executeResult: Awaited<ReturnType<typeof adapter.executeReview>>;
    try {
      executeResult = await withProviderCredential(settings.activeConnectionId, (credential) =>
        adapter.executeReview({ credential, model, instructions: EXTRACTION_STABLE_INSTRUCTIONS, input }),
      );
    } catch (error) {
      const errorCode = error instanceof ProviderCredentialAccessError ? error.errorCode : "PROVIDER_UNAVAILABLE";
      const outcome = await handleFailure(run, errorCode);
      logger.warn({ runId: run.id, sourceType: run.sourceType, errorCode, outcome }, "[qualitative-extraction] Credential access failed");
      return outcome;
    }

    if (!executeResult.ok) {
      const outcome = await handleFailure(run, executeResult.errorCode);
      logger.warn({ runId: run.id, sourceType: run.sourceType, errorCode: executeResult.errorCode, outcome }, "[qualitative-extraction] Provider execution failed");
      return outcome;
    }

    const parsed = safeParseExtractionResponse(executeResult.raw);
    if (!parsed.success) {
      await markFailed(run.id, "PROVIDER_OUTPUT_INVALID");
      logger.warn({ runId: run.id, sourceType: run.sourceType, issues: parsed.error.issues }, "[qualitative-extraction] Provider output failed shape validation");
      return "failed";
    }

    const semantics = validateExtractionSemantics(parsed.data, new Set());
    if (!semantics.valid) {
      await markFailed(run.id, "PROVIDER_OUTPUT_INVALID");
      logger.warn({ runId: run.id, sourceType: run.sourceType, reason: semantics.reason }, "[qualitative-extraction] Provider output failed semantic validation");
      return "failed";
    }

    await persistExtractionSuccess(
      run.id,
      run.organisationId,
      run.sourceType,
      run.sourceId,
      source,
      parsed.data,
      { inputTokens: executeResult.inputTokens, outputTokens: executeResult.outputTokens, inputChars: source.text.length, outputChars: parsed.data.observations.reduce((n, o) => n + o.statement.length, 0) },
      { providerConnectionId: settings.activeConnectionId, provider: connection.provider, model },
    );

    // ADR-0156 §6 best-effort eager refresh: new season-wide qualitative evidence just landed.
    // `refreshTeamSeasonProfileBestEffort` resolves `source.matchId` to a League Match itself
    // and silently no-ops when it isn't one (e.g. an Event source) -- never an AI call, never
    // throws, never blocks this run from being marked succeeded.
    const { refreshTeamSeasonProfileBestEffort } = await import("@/lib/team-season-profile/service");
    await refreshTeamSeasonProfileBestEffort(source.matchId, run.organisationId);

    return "succeeded";
  });
}

/** Entry point for the cron route: claims and processes one bounded batch of due extraction
 * runs, mirroring `processAiJobsBatch()`'s own per-run isolation (one run's failure never blocks
 * or corrupts another's). */
export async function processQualitativeExtractionBatch(): Promise<ProcessExtractionRunsSummary> {
  const claimed = await claimDueExtractionRuns(BATCH_SIZE);
  const summary: ProcessExtractionRunsSummary = { claimed: claimed.length, succeeded: 0, failed: 0, retried: 0, skippedNotEligible: 0 };

  for (const run of claimed) {
    try {
      const outcome = await processClaimedRun(run);
      if (outcome === "succeeded") summary.succeeded++;
      else if (outcome === "retried") summary.retried++;
      else if (outcome === "not_eligible") summary.skippedNotEligible++;
      else summary.failed++;
    } catch (error) {
      logger.error({ err: error, runId: run.id, sourceType: run.sourceType }, "[qualitative-extraction] Unexpected error processing run");
      try {
        await markFailed(run.id, "UNEXPECTED_ERROR");
      } catch (markError) {
        logger.error({ err: markError, runId: run.id }, "[qualitative-extraction] Failed to mark run as failed after unexpected error");
      }
      summary.failed++;
    }
  }

  return summary;
}
