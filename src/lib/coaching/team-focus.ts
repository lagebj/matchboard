import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

export type TeamFocusStatus = "ACTIVE" | "COMPLETED" | "CLOSED";

export interface CreateTeamFocusInput {
  teamId: string;
  statement: string;
  context?: string;
  linkedIntentId?: string;
  recordedBy?: string;
}

export interface UpdateTeamFocusInput {
  statement?: string;
  context?: string;
  linkedIntentId?: string | null;
  status?: TeamFocusStatus;
}

export interface TeamFocusRow {
  id: string;
  organisationId: string;
  teamId: string;
  statement: string;
  context: string | null;
  status: TeamFocusStatus;
  startedAt: Date;
  completedAt: Date | null;
  closedAt: Date | null;
  linkedIntentId: string | null;
  recordedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_ACTIVE_PER_TEAM = 3;
const STATEMENT_MAX_LENGTH = 300;
const CONTEXT_MAX_LENGTH = 1000;

function validateStatement(statement: string): void {
  if (!statement || statement.trim().length === 0) {
    throw new Error("Statement is required.");
  }
  if (statement.length > STATEMENT_MAX_LENGTH) {
    throw new Error(`Statement must be at most ${STATEMENT_MAX_LENGTH} characters.`);
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

export async function createTeamFocus(
  input: CreateTeamFocusInput,
  orgFilter: OrgFilterMode,
): Promise<TeamFocusRow> {
  validateStatement(input.statement);
  validateContext(input.context);

  const activeCount = await db.teamFocus.count({
    where: { teamId: input.teamId, status: "ACTIVE", ...orgWhere(orgFilter) },
  });

  if (activeCount >= MAX_ACTIVE_PER_TEAM) {
    throw new Error(`Team already has ${activeCount} active focus blocks. Complete or close one before adding another.`);
  }

  if (input.linkedIntentId) {
    const intent = await db.coachingIntent.findFirst({
      where: { id: input.linkedIntentId, ...orgWhere(orgFilter) },
    });
    if (!intent) {
      throw new Error("Linked coaching intent not found.");
    }
  }

  const focus = await db.teamFocus.create({
    data: {
      organisationId: orgFilter.organisationId,
      teamId: input.teamId,
      statement: input.statement.trim(),
      context: input.context?.trim() || null,
      linkedIntentId: input.linkedIntentId || null,
      recordedBy: input.recordedBy || null,
    },
  });

  return focus as TeamFocusRow;
}

export async function updateTeamFocus(
  focusId: string,
  input: UpdateTeamFocusInput,
  orgFilter: OrgFilterMode,
): Promise<TeamFocusRow> {
  if (input.statement !== undefined) validateStatement(input.statement);
  if (input.context !== undefined) validateContext(input.context);

  const existing = await db.teamFocus.findFirst({
    where: { id: focusId, ...orgWhere(orgFilter) },
  });

  if (!existing) {
    throw new Error("Team focus not found.");
  }

  if (existing.status !== "ACTIVE" && input.status === undefined && (input.statement !== undefined || input.context !== undefined)) {
    throw new Error("Only active focus blocks can be edited.");
  }

  if (input.linkedIntentId !== undefined) {
    if (input.linkedIntentId !== null) {
      const intent = await db.coachingIntent.findFirst({
        where: { id: input.linkedIntentId, ...orgWhere(orgFilter) },
      });
      if (!intent) {
        throw new Error("Linked coaching intent not found.");
      }
    }
  }

  const data: Record<string, unknown> = {};
  if (input.statement !== undefined) data.statement = input.statement.trim();
  if (input.context !== undefined) data.context = input.context?.trim() || null;
  if (input.linkedIntentId !== undefined) data.linkedIntentId = input.linkedIntentId;
  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === "COMPLETED") data.completedAt = new Date();
    if (input.status === "CLOSED") data.closedAt = new Date();
  }

  const focus = await db.teamFocus.update({
    where: { id: focusId },
    data,
  });

  return focus as TeamFocusRow;
}

export async function completeTeamFocus(focusId: string, orgFilter: OrgFilterMode): Promise<TeamFocusRow> {
  return updateTeamFocus(focusId, { status: "COMPLETED" }, orgFilter);
}

export async function closeTeamFocus(focusId: string, orgFilter: OrgFilterMode): Promise<TeamFocusRow> {
  return updateTeamFocus(focusId, { status: "CLOSED" }, orgFilter);
}

export async function reopenTeamFocus(focusId: string, orgFilter: OrgFilterMode): Promise<TeamFocusRow> {
  const existing = await db.teamFocus.findFirst({
    where: { id: focusId, ...orgWhere(orgFilter) },
  });

  if (!existing) {
    throw new Error("Team focus not found.");
  }

  if (existing.status !== "COMPLETED" && existing.status !== "CLOSED") {
    throw new Error("Only completed or closed focus blocks can be reopened.");
  }

  const activeCount = await db.teamFocus.count({
    where: { teamId: existing.teamId, status: "ACTIVE", ...orgWhere(orgFilter) },
  });

  if (activeCount >= MAX_ACTIVE_PER_TEAM) {
    throw new Error(`Team already has ${activeCount} active focus blocks. Complete or close one before reopening.`);
  }

  const focus = await db.teamFocus.update({
    where: { id: focusId },
    data: { status: "ACTIVE", completedAt: null, closedAt: null },
  });

  return focus as TeamFocusRow;
}

export async function getTeamFocusesForTeam(
  teamId: string,
  orgFilter: OrgFilterMode,
  status?: TeamFocusStatus,
): Promise<TeamFocusRow[]> {
  const where: Record<string, unknown> = { teamId, ...orgWhere(orgFilter) };
  if (status) where.status = status;

  const focuses = await db.teamFocus.findMany({
    where,
    orderBy: [{ startedAt: "desc" }],
  });

  return focuses as TeamFocusRow[];
}

export async function getActiveTeamFocusesForTeam(
  teamId: string,
  orgFilter: OrgFilterMode,
): Promise<TeamFocusRow[]> {
  return getTeamFocusesForTeam(teamId, orgFilter, "ACTIVE");
}

export async function getTeamFocus(
  focusId: string,
  orgFilter: OrgFilterMode,
): Promise<TeamFocusRow | null> {
  const focus = await db.teamFocus.findFirst({
    where: { id: focusId, ...orgWhere(orgFilter) },
  });

  return focus as TeamFocusRow | null;
}