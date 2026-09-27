/**
 * Guided post-match debrief — DB-touching service layer (ADR-0152 §3, bundle
 * `03_POST_MATCH_DEBRIEF.md`). Every function here is org-scoped and works identically for
 * League and Event via the `DebriefReportRef` discriminated union — one service, not two.
 */

import "server-only";

import { db } from "@/lib/db";
import type { PostMatchDebriefStatus } from "@/generated/prisma/client";
import {
  debriefAnswersSchema,
  parseDebriefAnswers,
  safeParseDebriefAnswers,
  findDebriefReviewGaps,
  EMPTY_DEBRIEF_ANSWERS,
  type DebriefAnswers,
} from "./v1";
import { mapTeamExecutionToTeamReflection, mapOpponentMemory, mapAnythingElseToReportNote, mapPlayerObservations } from "./map-to-canonical";
import { upsertTeamReflection } from "@/lib/coaching/team-reflection";
import { upsertOpponentEncounterObservation } from "@/lib/opponents/opponent-encounter-observation";
import { createFootballObservations } from "@/lib/evidence/football-observation-service";
import { isValidObservationCode, type FootballObservationCode } from "@/lib/evidence/observation-vocabulary";

export type DebriefReportRef = { kind: "LEAGUE"; matchId: string } | { kind: "EVENT"; eventMatchId: string };

export class DebriefDomainError extends Error {}

type DebriefRecord = {
  id: string;
  organisationId: string;
  postMatchReportId: string | null;
  eventPostMatchReportId: string | null;
  version: number;
  status: PostMatchDebriefStatus;
  answers: unknown;
  createdBy: string | null;
  submittedBy: string | null;
  submittedAt: Date | null;
};

async function resolveReportId(ref: DebriefReportRef, organisationId: string): Promise<{ reportId: string } | null> {
  if (ref.kind === "LEAGUE") {
    const report = await db.postMatchReport.findFirst({ where: { matchId: ref.matchId, organisationId }, select: { id: true } });
    return report ? { reportId: report.id } : null;
  }
  const report = await db.eventPostMatchReport.findFirst({ where: { eventMatchId: ref.eventMatchId, organisationId }, select: { id: true } });
  return report ? { reportId: report.id } : null;
}

/**
 * Bundle §07.12 "Legacy draft initialization" — a report that predates the debrief (or simply
 * has never had one opened yet) gets a `DRAFT` debrief created on first read, safely prefilled
 * from whatever compatible legacy free text/ratings already exist. Never marks it `SUBMITTED`
 * automatically, never loses legacy text, never copies `PlayerDevelopmentObservation` rows into
 * the answers JSON (those are shown as already recorded by the caller, not re-entered here).
 */
async function buildPrefilledAnswers(ref: DebriefReportRef, organisationId: string): Promise<DebriefAnswers> {
  const answers: DebriefAnswers = structuredClone(EMPTY_DEBRIEF_ANSWERS);

  if (ref.kind === "LEAGUE") {
    const [teamReflection, report, opponentObservation] = await Promise.all([
      db.teamReflection.findFirst({ where: { matchId: ref.matchId, organisationId } }),
      db.postMatchReport.findFirst({ where: { matchId: ref.matchId, organisationId }, select: { teamNote: true } }),
      db.opponentEncounterObservation.findFirst({ where: { matchId: ref.matchId, organisationId }, select: { factualSummary: true } }),
    ]);
    if (teamReflection) {
      const isKnownRating = (v: string | null): v is "STRONG" | "OK" | "NEEDS_ATTENTION" => v === "STRONG" || v === "OK" || v === "NEEDS_ATTENTION";
      if (isKnownRating(teamReflection.effort)) answers.answers.team_execution.effort = { value: teamReflection.effort };
      if (isKnownRating(teamReflection.teamCohesion)) answers.answers.team_execution.teamCohesion = { value: teamReflection.teamCohesion };
      if (isKnownRating(teamReflection.positionalShape)) answers.answers.team_execution.positionalShape = { value: teamReflection.positionalShape };
      if (isKnownRating(teamReflection.recoveryBehavior)) answers.answers.team_execution.recoveryBehavior = { value: teamReflection.recoveryBehavior };
      if (teamReflection.note) answers.answers.team_execution.note = teamReflection.note;
    }
    if (report?.teamNote) answers.answers.anything_else.note = report.teamNote;
    if (opponentObservation?.factualSummary) answers.answers.opponent_memory.note = opponentObservation.factualSummary;
    return answers;
  }

  const report = await db.eventPostMatchReport.findFirst({
    where: { eventMatchId: ref.eventMatchId, organisationId },
    select: { teamReflection: true, opponentObservation: true, notes: true },
  });
  // Event has no structured TeamReflection/OpponentEncounterObservation (ADR-0152 §3 note) —
  // its own free-text fields are the closest compatible source, prefilled into the debrief's
  // own free-text slots rather than fabricated structured ratings Event never had.
  if (report?.teamReflection) answers.answers.team_execution.note = report.teamReflection;
  if (report?.opponentObservation) answers.answers.opponent_memory.note = report.opponentObservation;
  if (report?.notes) answers.answers.anything_else.note = report.notes;
  return answers;
}

/** Loads the existing debrief for this report, or creates and returns a prefilled `DRAFT` one
 * on first open. Idempotent under a rare create race (falls back to the row that won). */
export async function getOrCreateDebrief(ref: DebriefReportRef, organisationId: string, createdBy?: string): Promise<DebriefRecord> {
  const resolved = await resolveReportId(ref, organisationId);
  if (!resolved) throw new DebriefDomainError("Post-match report not found.");

  const idField = ref.kind === "LEAGUE" ? "postMatchReportId" : "eventPostMatchReportId";
  const existing = await db.postMatchDebrief.findFirst({ where: { [idField]: resolved.reportId, organisationId } });
  if (existing) return existing;

  const prefilled = await buildPrefilledAnswers(ref, organisationId);
  try {
    return await db.postMatchDebrief.create({
      data: {
        organisationId,
        [idField]: resolved.reportId,
        answers: prefilled,
        createdBy: createdBy ?? null,
      },
    });
  } catch {
    // A concurrent first-open race lost — the row that won is equally valid; adopt it (D05-style
    // idempotency, same discipline `seedReportFromLiveSession` already uses).
    const winner = await db.postMatchDebrief.findFirst({ where: { [idField]: resolved.reportId, organisationId } });
    if (!winner) throw new DebriefDomainError("Could not create or load debrief.");
    return winner;
  }
}

export type SaveDraftResult = { success: true } | { success: false; error: string };

/** Persists a draft answers document. Best-effort last-write-wins (matches this app's existing
 * autosave conventions elsewhere — no other mutation in the codebase uses `updatedAt`-based
 * optimistic concurrency either); the caller preserves the coach's local input on any failure. */
export async function saveDraftDebrief(debriefId: string, organisationId: string, rawAnswers: unknown): Promise<SaveDraftResult> {
  const debrief = await db.postMatchDebrief.findFirst({ where: { id: debriefId, organisationId } });
  if (!debrief) return { success: false, error: "Debrief not found." };
  if (debrief.status !== "DRAFT") return { success: false, error: "Cannot edit a submitted debrief. Reopen the report first." };

  const parsed = safeParseDebriefAnswers(rawAnswers);
  if (!parsed.success) return { success: false, error: "Invalid debrief answers." };

  await db.postMatchDebrief.update({ where: { id: debriefId }, data: { answers: parsed.data } });
  return { success: true };
}

export type SubmitDebriefResult = { success: true } | { success: false; error: string; missing?: string[] };

/**
 * Bundle §03.8 "Submit debrief" — validates, transactionally maps onto the canonical models
 * (never inside the same call as any provider work — no AI call happens here or downstream of
 * it synchronously), and only then flips the debrief to `SUBMITTED`. If deterministic mapping
 * fails, the whole write is rolled back and the debrief stays `DRAFT` (bundle §03.8: "If
 * deterministic mapping fails, submission fails and debrief remains DRAFT").
 */
export async function submitDebrief(ref: DebriefReportRef, debriefId: string, organisationId: string, submittedBy: string): Promise<SubmitDebriefResult> {
  const debrief = await db.postMatchDebrief.findFirst({ where: { id: debriefId, organisationId } });
  if (!debrief) return { success: false, error: "Debrief not found." };
  if (debrief.status === "SUBMITTED") return { success: true };

  const parsed = debriefAnswersSchema.safeParse(debrief.answers);
  if (!parsed.success) return { success: false, error: "Saved debrief answers are invalid. Review and re-save before submitting." };

  const gaps = findDebriefReviewGaps(parsed.data.answers);
  if (gaps.length > 0) return { success: false, error: "Review the highlighted debrief questions before submitting.", missing: gaps };

  const answers = parsed.data.answers;

  try {
    if (ref.kind === "LEAGUE") {
      // Submission is only reachable once every team-execution row has an explicit answer
      // (findDebriefReviewGaps above), so the full TeamReflection overwrite below is always
      // intentional — no need to read the existing row first.
      const [existingOpponentObservation, match] = await Promise.all([
        db.opponentEncounterObservation.findFirst({ where: { matchId: ref.matchId, organisationId }, select: { factualSummary: true } }),
        db.match.findFirst({ where: { id: ref.matchId, organisationId }, select: { opponentTeamId: true } }),
      ]);

      const reflection = mapTeamExecutionToTeamReflection(answers);
      const opponentNote = mapOpponentMemory(answers, existingOpponentObservation?.factualSummary ?? null);
      const reportNote = mapAnythingElseToReportNote(answers);

      await db.$transaction(async (tx) => {
        await tx.postMatchDebrief.update({ where: { id: debriefId }, data: { status: "SUBMITTED", submittedBy, submittedAt: new Date() } });
        await upsertTeamReflection({ organisationId, matchId: ref.matchId, ...reflection, recordedBy: submittedBy }, tx);
        if (match?.opponentTeamId && (opponentNote || existingOpponentObservation)) {
          // Only `factualSummary` is known here — every other field (severity ratings, concern
          // categories, playing-style tags, follow-up) is owned by the standalone opponent
          // observation form and must survive this write untouched (see this writer's own doc
          // comment on why every field but the three identity ones is optional).
          await upsertOpponentEncounterObservation(
            { organisationId, matchId: ref.matchId, opponentTeamId: match.opponentTeamId, factualSummary: opponentNote, recordedBy: submittedBy },
            tx,
          );
        }
        await tx.postMatchReport.update({ where: { matchId: ref.matchId }, data: { teamNote: reportNote } });
      });

      await writePlayerObservations(answers, { matchId: ref.matchId });
    } else {
      const reflectionNote = answers.team_execution.note?.trim() || null;
      const opponentNote = mapOpponentMemory(answers, null);
      const reportNote = mapAnythingElseToReportNote(answers);

      await db.$transaction(async (tx) => {
        await tx.postMatchDebrief.update({ where: { id: debriefId }, data: { status: "SUBMITTED", submittedBy, submittedAt: new Date() } });
        await tx.eventPostMatchReport.update({
          where: { eventMatchId: ref.eventMatchId },
          data: {
            teamReflection: reflectionNote,
            opponentObservation: opponentNote,
            notes: reportNote,
          },
        });
      });

      await writePlayerObservations(answers, { eventMatchId: ref.eventMatchId });
    }
  } catch (error) {
    if (error instanceof DebriefDomainError) return { success: false, error: error.message };
    return { success: false, error: "Could not submit debrief. Nothing was saved — try again." };
  }

  return { success: true };
}

async function writePlayerObservations(answers: DebriefAnswers["answers"], target: { matchId: string } | { eventMatchId: string }): Promise<void> {
  const mapped = mapPlayerObservations(answers);
  if (mapped.length === 0) return;

  const inputs = mapped
    .filter((o) => isValidObservationCode(o.observationCode))
    .map((o) => ({
      playerId: o.playerId,
      ...target,
      observationCode: o.observationCode as FootballObservationCode,
      polarity: o.direction,
      note: o.note ?? undefined,
    }));

  // Never blocks debrief submission — createFootballObservations collects per-item errors
  // rather than throwing, matching the bundle's "AI never auto-creates this model, but a
  // canonical write failure here still never risks the debrief/report writes already
  // committed above" discipline.
  await createFootballObservations(inputs);
}

/** Bundle §03.10 "Reopen" — a SUBMITTED debrief becomes DRAFT again; answers/history are
 * untouched (a later resubmit is what supersedes prior extraction/AI state, in a later slice). */
export async function reopenDebrief(debriefId: string, organisationId: string): Promise<{ success: true } | { success: false; error: string }> {
  const debrief = await db.postMatchDebrief.findFirst({ where: { id: debriefId, organisationId } });
  if (!debrief) return { success: false, error: "Debrief not found." };
  await db.postMatchDebrief.update({ where: { id: debriefId }, data: { status: "DRAFT" } });
  return { success: true };
}

export async function getDebrief(debriefId: string, organisationId: string) {
  const debrief = await db.postMatchDebrief.findFirst({ where: { id: debriefId, organisationId } });
  if (!debrief) return null;
  return { ...debrief, parsedAnswers: parseDebriefAnswers(debrief.answers) };
}

export async function isDebriefSubmittedForReport(ref: DebriefReportRef, organisationId: string): Promise<boolean> {
  const resolved = await resolveReportId(ref, organisationId);
  if (!resolved) return false;
  const idField = ref.kind === "LEAGUE" ? "postMatchReportId" : "eventPostMatchReportId";
  const debrief = await db.postMatchDebrief.findFirst({ where: { [idField]: resolved.reportId, organisationId }, select: { status: true } });
  return debrief?.status === "SUBMITTED";
}
