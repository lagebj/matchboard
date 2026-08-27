import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { cleanFactualSummary, containsIdentifyingDetails, FACTUAL_SUMMARY_MAX_LENGTH } from "@/lib/opponents/validate-observation";
import * as developmentThread from "@/lib/planned-rotation/development-thread";
import { upsertTeamReflection, getTeamReflection } from "@/lib/coaching/team-reflection";

// Capture-first, classify-later inbox (Phase 8, DECISIONS.md "Quick observations"). Minimum
// fields at capture time: note, optional match/player context, timestamp, author. Classification
// is a separate, later, explicit coach action — never automatic, never AI-driven.

export type QuickObservationStatus = "OPEN" | "CONVERTED" | "KEPT_AS_NOTE" | "DISCARDED";
export type QuickObservationConversionType = "DEVELOPMENT_THREAD" | "TEAM_REFLECTION" | "OPPONENT_OBSERVATION";

const MAX_NOTE_LENGTH = 1000;
const MAX_PLAYERS_PER_OBSERVATION = 20;

export type QuickObservationRow = {
  id: string;
  matchId: string | null;
  playerIds: string[];
  note: string;
  status: QuickObservationStatus;
  convertedToType: QuickObservationConversionType | null;
  convertedToId: string | null;
  convertedAt: Date | null;
  recordedBy: string | null;
  createdAt: Date;
};

export interface CreateQuickObservationInput {
  matchId?: string | null;
  playerIds?: string[];
  note: string;
  recordedBy?: string;
}

function orgWhere(orgFilter: OrgFilterMode): { organisationId: string } {
  return { organisationId: orgFilter.organisationId };
}

function toRow(record: {
  id: string;
  matchId: string | null;
  playerIds: unknown;
  note: string;
  status: string;
  convertedToType: string | null;
  convertedToId: string | null;
  convertedAt: Date | null;
  recordedBy: string | null;
  createdAt: Date;
}): QuickObservationRow {
  return {
    id: record.id,
    matchId: record.matchId,
    playerIds: Array.isArray(record.playerIds) ? (record.playerIds as string[]) : [],
    note: record.note,
    status: record.status as QuickObservationStatus,
    convertedToType: record.convertedToType as QuickObservationConversionType | null,
    convertedToId: record.convertedToId,
    convertedAt: record.convertedAt,
    recordedBy: record.recordedBy,
    createdAt: record.createdAt,
  };
}

function validateNote(note: string): string {
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Observation note cannot be empty.");
  if (trimmed.length > MAX_NOTE_LENGTH) {
    throw new Error(`Observation note must be ${MAX_NOTE_LENGTH} characters or fewer.`);
  }
  return trimmed;
}

export async function createQuickObservation(
  input: CreateQuickObservationInput,
  orgFilter: OrgFilterMode,
): Promise<QuickObservationRow> {
  const note = validateNote(input.note);
  const playerIds = [...new Set(input.playerIds ?? [])];
  if (playerIds.length > MAX_PLAYERS_PER_OBSERVATION) {
    throw new Error(`A quick observation can reference at most ${MAX_PLAYERS_PER_OBSERVATION} players.`);
  }

  if (input.matchId) {
    const match = await db.match.findFirst({ where: { id: input.matchId, ...orgWhere(orgFilter) } });
    if (!match) throw new Error("Match not found.");
  }

  const created = await db.quickObservation.create({
    data: {
      organisationId: orgFilter.organisationId,
      matchId: input.matchId || null,
      playerIds,
      note,
      recordedBy: input.recordedBy || null,
    },
  });

  return toRow(created);
}

export async function getQuickObservations(
  filters: { matchId?: string; playerId?: string; status?: QuickObservationStatus },
  orgFilter: OrgFilterMode,
): Promise<QuickObservationRow[]> {
  const records = await db.quickObservation.findMany({
    where: {
      ...orgWhere(orgFilter),
      ...(filters.matchId ? { matchId: filters.matchId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = records.map(toRow);
  return filters.playerId ? rows.filter((r) => r.playerIds.includes(filters.playerId!)) : rows;
}

export async function getQuickObservation(id: string, orgFilter: OrgFilterMode): Promise<QuickObservationRow | null> {
  const record = await db.quickObservation.findFirst({ where: { id, ...orgWhere(orgFilter) } });
  return record ? toRow(record) : null;
}

async function requireOpenObservation(id: string, orgFilter: OrgFilterMode) {
  const record = await db.quickObservation.findFirst({ where: { id, ...orgWhere(orgFilter) } });
  if (!record) throw new Error("Quick observation not found.");
  if (record.status !== "OPEN") {
    throw new Error(`Quick observation has already been resolved (${record.status}).`);
  }
  return record;
}

export async function discardQuickObservation(id: string, orgFilter: OrgFilterMode): Promise<QuickObservationRow> {
  await requireOpenObservation(id, orgFilter);
  const updated = await db.quickObservation.update({
    where: { id },
    data: { status: "DISCARDED" },
  });
  return toRow(updated);
}

export async function keepQuickObservationAsNote(id: string, orgFilter: OrgFilterMode): Promise<QuickObservationRow> {
  await requireOpenObservation(id, orgFilter);
  const updated = await db.quickObservation.update({
    where: { id },
    data: { status: "KEPT_AS_NOTE" },
  });
  return toRow(updated);
}

/**
 * Links the note as a new observation on an existing active development thread (the thread must
 * already exist — a quick observation does not implicitly create one, since a player may have at
 * most 2 active threads and creating one is a deliberate coach decision, not a side effect).
 */
export async function convertQuickObservationToDevelopmentThread(
  id: string,
  threadId: string,
  orgFilter: OrgFilterMode,
): Promise<QuickObservationRow> {
  const observation = await requireOpenObservation(id, orgFilter);

  const created = await developmentThread.addObservation(
    {
      threadId,
      matchId: observation.matchId ?? undefined,
      evidence: observation.note,
      recordedBy: observation.recordedBy ?? undefined,
    },
    orgFilter,
  );

  const updated = await db.quickObservation.update({
    where: { id },
    data: {
      status: "CONVERTED",
      convertedToType: "DEVELOPMENT_THREAD",
      convertedToId: created.id,
      convertedAt: new Date(),
    },
  });
  return toRow(updated);
}

/**
 * Appends the note to the match's team reflection (creating one if none exists yet). Existing
 * reflection content is preserved — the note is appended, never overwritten.
 */
export async function convertQuickObservationToTeamReflection(
  id: string,
  orgFilter: OrgFilterMode,
): Promise<QuickObservationRow> {
  const observation = await requireOpenObservation(id, orgFilter);
  if (!observation.matchId) {
    throw new Error("Quick observation has no match context — cannot convert to a team reflection.");
  }

  const existing = await getTeamReflection(observation.matchId);
  const combinedNote = existing?.note ? `${existing.note}\n\n${observation.note}` : observation.note;

  const reflection = await upsertTeamReflection({
    organisationId: orgFilter.organisationId,
    matchId: observation.matchId,
    note: combinedNote,
    recordedBy: observation.recordedBy ?? undefined,
  });

  const updated = await db.quickObservation.update({
    where: { id },
    data: {
      status: "CONVERTED",
      convertedToType: "TEAM_REFLECTION",
      convertedToId: reflection.id,
      convertedAt: new Date(),
    },
  });
  return toRow(updated);
}

/**
 * Appends the note to the match's opponent encounter observation factual summary (creating one
 * with otherwise-default/NOT_ASSESSED fields if none exists). Reuses the same sanitisation as the
 * normal opponent-observation form — no identifying-detail bypass for the quick-capture path.
 */
export async function convertQuickObservationToOpponentObservation(
  id: string,
  orgFilter: OrgFilterMode,
): Promise<QuickObservationRow> {
  const observation = await requireOpenObservation(id, orgFilter);
  if (!observation.matchId) {
    throw new Error("Quick observation has no match context — cannot convert to an opponent observation.");
  }

  const match = await db.match.findFirst({
    where: { id: observation.matchId, ...orgWhere(orgFilter) },
    select: { id: true, opponentTeamId: true },
  });
  if (!match?.opponentTeamId) {
    throw new Error("Match has no opponent team on record — cannot convert to an opponent observation.");
  }

  if (containsIdentifyingDetails(observation.note)) {
    throw new Error("Do not include contact details or links in an opponent observation. Edit the note before converting it.");
  }

  const existing = await db.opponentEncounterObservation.findUnique({ where: { matchId: match.id } });
  const combinedSummary = existing?.factualSummary
    ? `${existing.factualSummary}\n\n${observation.note}`
    : observation.note;
  const cleanedSummary = cleanFactualSummary(combinedSummary);
  if (cleanedSummary && cleanedSummary.length > FACTUAL_SUMMARY_MAX_LENGTH) {
    throw new Error(`Combined factual summary would exceed ${FACTUAL_SUMMARY_MAX_LENGTH} characters — shorten it via the opponent observation form first.`);
  }

  const record = existing
    ? await db.opponentEncounterObservation.update({
        where: { id: existing.id },
        data: { factualSummary: cleanedSummary, recordedBy: observation.recordedBy ?? existing.recordedBy },
      })
    : await db.opponentEncounterObservation.create({
        data: {
          matchId: match.id,
          opponentTeamId: match.opponentTeamId,
          factualSummary: cleanedSummary,
          recordedBy: observation.recordedBy || null,
          organisationId: orgFilter.organisationId,
        },
      });

  const updated = await db.quickObservation.update({
    where: { id },
    data: {
      status: "CONVERTED",
      convertedToType: "OPPONENT_OBSERVATION",
      convertedToId: record.id,
      convertedAt: new Date(),
    },
  });
  return toRow(updated);
}
