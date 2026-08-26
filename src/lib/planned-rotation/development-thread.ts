import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

export type DevelopmentThreadStatus = "ACTIVE" | "COMPLETED" | "CLOSED";
export type DevelopmentFocusCategory =
  | "POSITIONAL_DISCIPLINE"
  | "CONFIDENCE_REBUILD"
  | "CHALLENGE_EXPOSURE"
  | "TEAM_FIRST_BEHAVIOUR"
  | "RESET_AFTER_ERROR"
  | "SUPPORT_TEAMMATES"
  | "PLAY_THROUGH_TEAM"
  | "BALL_CONTROL"
  | "DECISION_MAKING"
  | "EFFORT_AND_INTENSITY"
  | "POSITIONAL_LEARNING"
  | "GOALKEEPING";

export const DEVELOPMENT_FOCUS_CATEGORIES: DevelopmentFocusCategory[] = [
  "POSITIONAL_DISCIPLINE",
  "CONFIDENCE_REBUILD",
  "CHALLENGE_EXPOSURE",
  "TEAM_FIRST_BEHAVIOUR",
  "RESET_AFTER_ERROR",
  "SUPPORT_TEAMMATES",
  "PLAY_THROUGH_TEAM",
  "BALL_CONTROL",
  "DECISION_MAKING",
  "EFFORT_AND_INTENSITY",
  "POSITIONAL_LEARNING",
  "GOALKEEPING",
];

export interface CreateThreadInput {
  playerId: string;
  focus: string;
  rationale?: string;
  category?: DevelopmentFocusCategory;
  recordedBy?: string;
}

export interface UpdateThreadInput {
  focus?: string;
  rationale?: string;
  category?: DevelopmentFocusCategory;
  status?: DevelopmentThreadStatus;
}

export interface AddObservationInput {
  threadId: string;
  matchId?: string;
  evidence: string;
  context?: string;
  recordedBy?: string;
}

export interface UpdateObservationInput {
  evidence?: string;
  context?: string;
}

export interface DevelopmentThreadWithObservations {
  id: string;
  playerId: string;
  focus: string;
  rationale: string | null;
  status: DevelopmentThreadStatus;
  category: DevelopmentFocusCategory | null;
  startedAt: Date;
  completedAt: Date | null;
  closedAt: Date | null;
  recordedBy: string | null;
  observations: DevelopmentThreadObservationRow[];
}

export interface DevelopmentThreadObservationRow {
  id: string;
  threadId: string;
  matchId: string | null;
  evidence: string;
  context: string | null;
  recordedBy: string | null;
  createdAt: Date;
}

const MAX_ACTIVE_THREADS_PER_PLAYER = 3;
const FOCUS_MAX_LENGTH = 200;
const RATIONALE_MAX_LENGTH = 1000;
const EVIDENCE_MAX_LENGTH = 1000;
const CONTEXT_MAX_LENGTH = 500;

function validateFocus(focus: string): void {
  if (!focus || focus.trim().length === 0) {
    throw new Error("Focus is required.");
  }
  if (focus.length > FOCUS_MAX_LENGTH) {
    throw new Error(`Focus must be at most ${FOCUS_MAX_LENGTH} characters.`);
  }
}

function validateRationale(rationale: string | undefined): void {
  if (rationale && rationale.length > RATIONALE_MAX_LENGTH) {
    throw new Error(`Rationale must be at most ${RATIONALE_MAX_LENGTH} characters.`);
  }
}

function validateEvidence(evidence: string): void {
  if (!evidence || evidence.trim().length === 0) {
    throw new Error("Evidence is required.");
  }
  if (evidence.length > EVIDENCE_MAX_LENGTH) {
    throw new Error(`Evidence must be at most ${EVIDENCE_MAX_LENGTH} characters.`);
  }
}

function validateContext(context: string | undefined): void {
  if (context && context.length > CONTEXT_MAX_LENGTH) {
    throw new Error(`Context must be at most ${CONTEXT_MAX_LENGTH} characters.`);
  }
}

function orgWhere(orgFilter: OrgFilterMode): { organisationId: string } {
  return { organisationId: orgFilter.organisationId };
}

function orgWhereObs(orgFilter: OrgFilterMode): { organisationId: string } {
  return { organisationId: orgFilter.organisationId };
}

export async function createThread(
  input: CreateThreadInput,
  orgFilter: OrgFilterMode,
): Promise<DevelopmentThreadWithObservations> {
  validateFocus(input.focus);
  validateRationale(input.rationale);

  const activeCount = await db.developmentThread.count({
    where: {
      playerId: input.playerId,
      status: "ACTIVE",
      ...orgWhere(orgFilter),
    },
  });

  if (activeCount >= MAX_ACTIVE_THREADS_PER_PLAYER) {
    throw new Error(
      `Player already has ${activeCount} active development threads. Complete or close one before adding another.`,
    );
  }

  const thread = await db.developmentThread.create({
    data: {
      organisationId: orgFilter.organisationId,
      playerId: input.playerId,
      focus: input.focus.trim(),
      rationale: input.rationale?.trim() || null,
      category: input.category || null,
      recordedBy: input.recordedBy || null,
    },
    include: { observations: { orderBy: { createdAt: "asc" } } },
  });

  return thread as DevelopmentThreadWithObservations;
}

export async function updateThread(
  threadId: string,
  input: UpdateThreadInput,
  orgFilter: OrgFilterMode,
): Promise<DevelopmentThreadWithObservations> {
  if (input.focus !== undefined) validateFocus(input.focus);
  if (input.rationale !== undefined) validateRationale(input.rationale);

  const existing = await db.developmentThread.findFirst({
    where: { id: threadId, ...orgWhere(orgFilter) },
  });

  if (!existing) {
    throw new Error("Development thread not found.");
  }

  if (existing.status !== "ACTIVE" && input.status === undefined && (input.focus !== undefined || input.category !== undefined)) {
    throw new Error("Only active threads can be edited.");
  }

  const data: Record<string, unknown> = {};
  if (input.focus !== undefined) data.focus = input.focus.trim();
  if (input.rationale !== undefined) data.rationale = input.rationale?.trim() || null;
  if (input.category !== undefined) data.category = input.category;
  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === "COMPLETED") data.completedAt = new Date();
    if (input.status === "CLOSED") data.closedAt = new Date();
  }

  const thread = await db.developmentThread.update({
    where: { id: threadId },
    data,
    include: { observations: { orderBy: { createdAt: "asc" } } },
  });

  return thread as DevelopmentThreadWithObservations;
}

export async function addObservation(
  input: AddObservationInput,
  orgFilter: OrgFilterMode,
): Promise<DevelopmentThreadObservationRow> {
  validateEvidence(input.evidence);
  validateContext(input.context);

  const thread = await db.developmentThread.findFirst({
    where: { id: input.threadId, ...orgWhere(orgFilter) },
  });

  if (!thread) {
    throw new Error("Development thread not found.");
  }

  if (thread.status !== "ACTIVE") {
    throw new Error("Observations can only be added to active threads.");
  }

  if (input.matchId) {
    const match = await db.match.findFirst({
      where: { id: input.matchId, ...orgWhere(orgFilter) },
    });
    if (!match) {
      throw new Error("Match not found.");
    }
  }

  const observation = await db.developmentThreadObservation.create({
    data: {
      organisationId: orgFilter.organisationId,
      threadId: input.threadId,
      matchId: input.matchId || null,
      evidence: input.evidence.trim(),
      context: input.context?.trim() || null,
      recordedBy: input.recordedBy || null,
    },
  });

  return observation as DevelopmentThreadObservationRow;
}

export async function updateObservation(
  observationId: string,
  input: UpdateObservationInput,
  orgFilter: OrgFilterMode,
): Promise<DevelopmentThreadObservationRow> {
  if (input.evidence !== undefined) validateEvidence(input.evidence);
  if (input.context !== undefined) validateContext(input.context);

  const existing = await db.developmentThreadObservation.findFirst({
    where: { id: observationId, ...orgWhereObs(orgFilter) },
    include: { thread: true },
  });

  if (!existing) {
    throw new Error("Observation not found.");
  }

  if (existing.thread.status !== "ACTIVE") {
    throw new Error("Observations can only be edited on active threads.");
  }

  const data: Record<string, unknown> = {};
  if (input.evidence !== undefined) data.evidence = input.evidence.trim();
  if (input.context !== undefined) data.context = input.context?.trim() || null;

  const observation = await db.developmentThreadObservation.update({
    where: { id: observationId },
    data,
  });

  return observation as DevelopmentThreadObservationRow;
}

export async function removeObservation(
  observationId: string,
  orgFilter: OrgFilterMode,
): Promise<void> {
  const existing = await db.developmentThreadObservation.findFirst({
    where: { id: observationId, ...orgWhereObs(orgFilter) },
    include: { thread: true },
  });

  if (!existing) {
    throw new Error("Observation not found.");
  }

  if (existing.thread.status !== "ACTIVE") {
    throw new Error("Observations can only be removed from active threads.");
  }

  await db.developmentThreadObservation.delete({ where: { id: observationId } });
}

export async function getThread(
  threadId: string,
  orgFilter: OrgFilterMode,
): Promise<DevelopmentThreadWithObservations | null> {
  const thread = await db.developmentThread.findFirst({
    where: { id: threadId, ...orgWhere(orgFilter) },
    include: { observations: { orderBy: { createdAt: "asc" } } },
  });

  return thread as DevelopmentThreadWithObservations | null;
}

export async function getThreadsForPlayer(
  playerId: string,
  orgFilter: OrgFilterMode,
  status?: DevelopmentThreadStatus,
): Promise<DevelopmentThreadWithObservations[]> {
  const where: Record<string, unknown> = {
    playerId,
    organisationId: orgFilter.organisationId,
  };
  if (status) where.status = status;

  const threads = await db.developmentThread.findMany({
    where,
    include: { observations: { orderBy: { createdAt: "asc" } } },
    orderBy: [{ startedAt: "desc" }],
  });

  return threads as DevelopmentThreadWithObservations[];
}

export async function getActiveThreadsForPlayer(
  playerId: string,
  orgFilter: OrgFilterMode,
): Promise<DevelopmentThreadWithObservations[]> {
  return getThreadsForPlayer(playerId, orgFilter, "ACTIVE");
}

export async function completeThread(
  threadId: string,
  orgFilter: OrgFilterMode,
): Promise<DevelopmentThreadWithObservations> {
  return updateThread(threadId, { status: "COMPLETED" }, orgFilter);
}

export async function closeThread(
  threadId: string,
  orgFilter: OrgFilterMode,
): Promise<DevelopmentThreadWithObservations> {
  return updateThread(threadId, { status: "CLOSED" }, orgFilter);
}

export async function reopenThread(
  threadId: string,
  orgFilter: OrgFilterMode,
): Promise<DevelopmentThreadWithObservations> {
  const existing = await db.developmentThread.findFirst({
    where: { id: threadId, ...orgWhere(orgFilter) },
  });

  if (!existing) {
    throw new Error("Development thread not found.");
  }

  if (existing.status !== "COMPLETED" && existing.status !== "CLOSED") {
    throw new Error("Only completed or closed threads can be reopened.");
  }

  const activeCount = await db.developmentThread.count({
    where: {
      playerId: existing.playerId,
      status: "ACTIVE",
      ...orgWhere(orgFilter),
    },
  });

  if (activeCount >= MAX_ACTIVE_THREADS_PER_PLAYER) {
    throw new Error(
      `Player already has ${activeCount} active development threads. Complete or close one before reopening.`,
    );
  }

  return db.developmentThread.update({
    where: { id: threadId },
    data: {
      status: "ACTIVE",
      completedAt: null,
      closedAt: null,
    },
    include: { observations: { orderBy: { createdAt: "asc" } } },
  }) as Promise<DevelopmentThreadWithObservations>;
}