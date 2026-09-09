import { db } from "@/lib/db";
import { isPlanningBoundaryClosed, type PlanningBoundaryResult } from "@/lib/selection/planning-boundary";

/**
 * The Event-side adapter over the shared planning-boundary predicate (ARR-0038 / Consolidation
 * Programme C2). An `EventMatch` line-up is authoritative and editable while planning is open —
 * exactly the same real-world condition a League match line-up uses (`isMatchPlanningEditable`):
 * editable until scheduled kick-off passes, live reporting starts, or a post-match report
 * exists; never editable for a cancelled match.
 *
 * Deliberate differences from League, kept here in the adapter, not in the shared predicate:
 *  - `EventMatch` has no `planningClosedAt` marker and nothing to freeze (no Selection /
 *    MovementLedger / round / availability snapshot), so this passes `planningClosedAt: null`.
 *    Editability is therefore purely derived — a genuine reschedule that moves `startsAt` back
 *    into the future re-opens editing automatically, with no separate "un-close" action.
 *  - An `EventPostMatchReport` (DRAFT/REPORTED/LOCKED) also closes line-up editing, since Event
 *    has no per-match baseline capture to have closed the boundary earlier.
 *
 * NOT covered here (unchanged, deliberate — ADR-0109 §7/§7a): whole-`Event.status` finalize and
 * the whole-`EventSquad` set lock are separate "this container is done" assertions, not per-match
 * planning ceremony.
 */
export async function isEventMatchLineupEditable(
  eventMatchId: string,
  options?: { now?: Date },
): Promise<PlanningBoundaryResult> {
  const match = await db.eventMatch.findFirst({
    where: { id: eventMatchId },
    select: {
      id: true,
      status: true,
      startsAt: true,
      liveSession: { select: { status: true } },
      postMatchReport: { select: { status: true } },
    },
  });

  if (!match) {
    return { editable: false, reason: "Event match not found." };
  }

  return isPlanningBoundaryClosed({
    matchStatus: match.status,
    startsAt: match.startsAt,
    planningClosedAt: null,
    liveSessionStatus: match.liveSession?.status ?? null,
    reportStatus: match.postMatchReport?.status ?? "NONE",
    now: options?.now,
  });
}
