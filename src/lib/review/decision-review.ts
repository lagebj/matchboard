// ─────────────────────────────────────────────────────────────────
// Decision review (ADR-0131 / ADR-0132).
//
// Reconsider a durable coaching decision — a DevelopmentThread's focus or a
// TeamFocus's statement — after time and context have moved on. This is NOT an
// approval and has no reviewer (that is Peer review / `ReviewRequest`); it is a
// longer coaching loop.
//
// Cadence: on target creation a review is prefilled 42 days out (a product
// cadence, not an evidence threshold — the coach can change the date or choose
// no scheduled review). A material change supersedes the pending review and
// schedules a fresh one; closing the target supersedes the pending review with
// no replacement. Nothing auto-resolves.
// ─────────────────────────────────────────────────────────────────

import crypto from "crypto";
import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import type {
  DecisionReview,
  DecisionReviewTargetType,
  DecisionReviewOutcome,
} from "@/generated/prisma/client";

export const DECISION_REVIEW_CADENCE_DAYS = 42;
export const DECISION_REVIEW_DEFER_DAYS = 7;

function requireOrg(orgFilter: OrgFilterMode): string {
  if (orgFilter.type !== "org") {
    throw new Error("Decision review requires an organisation context.");
  }
  return orgFilter.organisationId;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/** Material-fields fingerprint. Metadata-only edits do not change this (§06). */
export function developmentThreadRevision(t: { focus: string; category: string | null; rationale: string | null }): string {
  return hash(JSON.stringify({ focus: t.focus, category: t.category ?? "", rationale: t.rationale ?? "" }));
}
export function teamFocusRevision(f: { statement: string; context: string | null }): string {
  return hash(JSON.stringify({ statement: f.statement, context: f.context ?? "" }));
}
function hash(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
}

export interface ScheduleDecisionReviewInput {
  targetType: DecisionReviewTargetType;
  targetId: string;
  targetRevision: string;
  /** Defaults to 42 days from now. `null` means "no scheduled review". */
  dueAt?: Date | null;
  createdBy?: string | null;
}

/**
 * Creates one PENDING decision review for a target. A `null` `dueAt` is the
 * coach's explicit "No scheduled review" choice — nothing is created.
 */
export async function scheduleDecisionReview(
  input: ScheduleDecisionReviewInput,
  orgFilter: OrgFilterMode,
): Promise<DecisionReview | null> {
  const organisationId = requireOrg(orgFilter);
  if (input.dueAt === null) return null;
  return db.decisionReview.create({
    data: {
      organisationId,
      targetType: input.targetType,
      targetId: input.targetId,
      targetRevision: input.targetRevision,
      dueAt: input.dueAt ?? daysFromNow(DECISION_REVIEW_CADENCE_DAYS),
      createdBy: input.createdBy ?? null,
    },
  });
}

/**
 * Material change to a target: supersede its pending review(s) and schedule a
 * fresh one due 42 days from the change (unless the caller provides another
 * date). Metadata-only changes must not call this (they pass an unchanged
 * `newRevision` — a no-op).
 */
export async function supersedeDecisionReviewsForChange(
  targetType: DecisionReviewTargetType,
  targetId: string,
  newRevision: string,
  orgFilter: OrgFilterMode,
  opts: { dueAt?: Date | null; createdBy?: string | null } = {},
): Promise<DecisionReview | null> {
  const organisationId = requireOrg(orgFilter);
  const pending = await db.decisionReview.findMany({
    where: { organisationId, targetType, targetId, status: "PENDING" },
  });
  if (pending.length === 0) return null;
  // No material change → nothing to do.
  if (pending.every((p) => p.targetRevision === newRevision)) return null;

  await db.decisionReview.updateMany({
    where: { organisationId, targetType, targetId, status: "PENDING" },
    data: { status: "SUPERSEDED" },
  });
  return scheduleDecisionReview(
    { targetType, targetId, targetRevision: newRevision, dueAt: opts.dueAt, createdBy: opts.createdBy },
    orgFilter,
  );
}

/**
 * The target closed / completed outside a review — its pending review becomes
 * SUPERSEDED and no new one is created (§06).
 */
export async function supersedeDecisionReviewsOnClose(
  targetType: DecisionReviewTargetType,
  targetId: string,
  orgFilter: OrgFilterMode,
): Promise<number> {
  const organisationId = requireOrg(orgFilter);
  const { count } = await db.decisionReview.updateMany({
    where: { organisationId, targetType, targetId, status: "PENDING" },
    data: { status: "SUPERSEDED" },
  });
  return count;
}

/**
 * Resolve a pending review. KEEP / CHANGE schedule the next review 42 days out;
 * COMPLETE stops the cadence.
 */
export async function resolveDecisionReview(
  id: string,
  outcome: DecisionReviewOutcome,
  orgFilter: OrgFilterMode,
  opts: { reviewNote?: string | null; resolvedBy?: string | null; nextDueAt?: Date | null } = {},
): Promise<DecisionReview> {
  const organisationId = requireOrg(orgFilter);
  const review = await db.decisionReview.findFirst({ where: { id, organisationId, status: "PENDING" } });
  if (!review) throw new Error("Decision review not found, not pending, or access denied.");

  const resolved = await db.decisionReview.update({
    where: { id },
    data: {
      status: "COMPLETED",
      outcome,
      reviewNote: opts.reviewNote ?? null,
      resolvedBy: opts.resolvedBy ?? null,
      resolvedAt: new Date(),
    },
  });

  if (outcome !== "COMPLETE") {
    await scheduleDecisionReview(
      {
        targetType: review.targetType,
        targetId: review.targetId,
        targetRevision: review.targetRevision,
        dueAt: opts.nextDueAt,
        createdBy: opts.resolvedBy ?? null,
      },
      orgFilter,
    );
  }
  return resolved;
}

/** Move a pending review's due date out by 7 days ("Later"); it stays pending. */
export async function deferDecisionReview(id: string, orgFilter: OrgFilterMode): Promise<DecisionReview> {
  const organisationId = requireOrg(orgFilter);
  const review = await db.decisionReview.findFirst({ where: { id, organisationId, status: "PENDING" } });
  if (!review) throw new Error("Decision review not found, not pending, or access denied.");
  const dueAt = new Date(review.dueAt);
  dueAt.setDate(dueAt.getDate() + DECISION_REVIEW_DEFER_DAYS);
  return db.decisionReview.update({ where: { id }, data: { dueAt } });
}

/** Pending reviews that are due (dueAt <= now). Ordered soonest first. */
export async function getDueDecisionReviews(
  orgFilter: OrgFilterMode,
  asOf: Date = new Date(),
): Promise<DecisionReview[]> {
  const organisationId = requireOrg(orgFilter);
  return db.decisionReview.findMany({
    where: { organisationId, status: "PENDING", dueAt: { lte: asOf } },
    orderBy: { dueAt: "asc" },
  });
}

export async function getDecisionReviewHistoryForTarget(
  targetType: DecisionReviewTargetType,
  targetId: string,
  orgFilter: OrgFilterMode,
): Promise<DecisionReview[]> {
  const organisationId = requireOrg(orgFilter);
  return db.decisionReview.findMany({
    where: { organisationId, targetType, targetId },
    orderBy: { createdAt: "desc" },
  });
}
