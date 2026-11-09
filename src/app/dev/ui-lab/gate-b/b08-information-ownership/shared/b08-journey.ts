import type { LiveEventSummary } from "@/lib/live-match/live-match-types";

/**
 * B08 W5 remediation (independent review, P1-6: "LIVE-to-report continuity") — a real, bounded,
 * client-only persistence layer distinguishing B08's own two valid modes:
 *
 * - REFERENCE SNAPSHOT: a direct visit to any of the five routes (including every CI/Playwright
 *   capture, which always gets a brand-new, empty browser context — `scripts/
 *   ui-lab-visual-review.mjs` calls `browser.newContext()` fresh per scenario/viewport/theme and
 *   closes it immediately after) reads NOTHING from here and renders the established canonical
 *   fixture, unchanged from before this remediation.
 * - INTERACTIVE JOURNEY: a real browser session that actually records an event on B08-LIVE
 *   persists it here (sessionStorage — tab/session-scoped, never reaches a server, never crosses
 *   origins or devices), so the Report candidate can read what was genuinely recorded instead of
 *   always showing the same fixed list regardless of what the coach did.
 *
 * Deliberately NOT a general-purpose event-sourcing system (explicitly out of scope — see the
 * remediation brief's "Hard boundaries"): one versioned blob, one key, no replay log, no
 * cross-scenario reuse beyond B08's own five routes.
 *
 * V2 (second remediation, 2026-11-08, "lifecycle data consistency"): adds a second persisted
 * slot — the RECONCILED REPORT state — alongside the raw LIVE event ledger. Production itself
 * keeps these as two distinct layers (raw live events vs. the coach-edited report rows —
 * confirmed directly against `get-match-detail-after-data.ts`: `goalFacts`/`assistFacts` come
 * from `report.goals`/`report.assists`, never recomputed from live events on every read), so V2
 * mirrors that real separation instead of inventing a single merged ledger.
 *
 * V3 (third remediation, 2026-11-08, "final data-integrity remediation"): adds `historyOrigin`,
 * recording WHICH match history a persisted report is actually grounded in —
 * `"REFERENCE"` (the coach edited the canonical reference report directly, with no LIVE journey
 * involved) or `"LIVE_JOURNEY"` (the report seeds from a real, finished LIVE session). Before this,
 * `saveB08JourneyReport()` on a reference-mode edit (the common, direct-visit path) wrote
 * `events: []` into storage with no record of WHY — AFTER then saw a persisted report and
 * switched to "interactive" rendering, deriving its timeline from that empty array and silently
 * discarding the real 10'/22'/48' chronology; `safe-transition-controller.ts`'s own
 * `initialLiveEvents()` had the same blind spot in reverse (an empty `events: []` from a
 * reference-mode report edit looked exactly like a resumed-but-empty LIVE session, so opening
 * LIVE after editing the reference report also lost the canonical cutoff seed). `historyOrigin`
 * lets every reader distinguish the two cases explicitly instead of inferring origin from
 * `events`' own (ambiguous) emptiness. Per the "avoid unnecessary duplication" principle: a
 * REFERENCE-origin report does not duplicate the canonical event history into this store at all
 * (`events` stays `[]`) — readers resolve a REFERENCE origin straight from
 * `b08-projection.ts`'s own canonical history (`resolveB08EffectiveHistory()`), the single real
 * source, never a second copy.
 *
 * Storage key bumped on each schema change (`-v1` -> `-v2` -> `-v3`) as the explicit version
 * increment — a stale-version blob is simply never read, the safest possible migration for a
 * client-only, tab-scoped, dev-fixture store (no partial-read risk, no crash, just starts fresh —
 * the same "reference snapshot" default as a brand-new session).
 *
 * FOURTH remediation (2026-11-08, "final source-of-truth remediation", defect #2): `historyOrigin`
 * was introduced to DISTINGUISH the two histories, but `saveB08JourneyEvents()`/
 * `markB08JourneyFinished()` still unconditionally wrote `historyOrigin: "LIVE_JOURNEY"` even when
 * a `"REFERENCE"`-origin report was ALREADY persisted — a coach who edited the reference report
 * directly, then went to LIVE and recorded a real event, would silently flip the origin while
 * RETAINING the old reference-derived report, leaving the event ledger and the report grounded in
 * two different match histories. Both write functions now REJECT (return
 * `{accepted: false, reason}`) rather than perform this transition — the only valid way to start a
 * genuinely new LIVE journey after a reference-origin edit is the existing, explicit "Reset
 * journey" control (`resetB08Journey()`), never an implicit side effect of recording an event.
 */

const STORAGE_KEY = "b08-live-journey-v3";

/** The outcome of a write that could conflict with an already-established `historyOrigin`. Mirrors
 * the shape callers already use to report LIVE action results (`{success, error}`/`{success,
 * conflict}` in `LiveMatchActions`), so `safe-transition-controller.ts` can translate a rejection
 * directly into the real fixture adapter's own existing result shapes without inventing a third
 * one. */
export type B08JourneyWriteResult = { accepted: true } | { accepted: false; reason: string };

const REFERENCE_ORIGIN_CONFLICT_REASON =
  'A reference report has already been edited for this match (historyOrigin "REFERENCE"). Recording or finishing a LIVE session now would leave the event ledger and the persisted report grounded in two different match histories. Use "Reset journey" first to start a genuinely new LIVE session.';

/** Which match history a persisted report is actually grounded in — see the V3 module doc above.
 * Set once, by whichever write happens first (a reference-mode report edit, or a real LIVE
 * session's own `recordEvent`/`endSession`); a report mutation (`saveB08JourneyReport()`) never
 * silently changes an already-established origin. */
export type B08HistoryOrigin = "REFERENCE" | "LIVE_JOURNEY";

/** The reconciled Post-Match Report's own fixture-local state — the exact same shape
 * `SafeReportLocalState` (`b05-post-match-report/shared/use-safe-report-lifecycle.ts`) already
 * uses, persisted verbatim via `SafePostMatchReportShell`'s own `onStateChange` callback so a
 * report reconciled/completed during an interactive journey survives navigation to AFTER/
 * REPORT-COMPLETED and a page reload — not just held in that one component's own React state. */
export interface B08PersistedReportState {
  // Matches `SafeReportLocalState["status"]` exactly (`use-safe-report-lifecycle.ts`) — "DRAFT"
  // is part of that real union even though neither B05 nor B08 ever actually reaches it from
  // `REPORTED`/`LOCKED`; narrowing it here would fight the shared reducer's own type, not add
  // real safety.
  status: "DRAFT" | "REPORTED" | "LOCKED";
  ourScore: number;
  opponentScore: number;
  goals: { id: string; playerId: string | null; playerName: string | null; minute: number | null }[];
  assists: { id: string; playerId: string; playerName: string | null }[];
  players: { id: string; playerId: string; playerName: string; attendanceStatus: string; meta?: string }[];
  timingReview: { period: string; periodLabel: string; resolvedDurationMinutes: number; needsReview: boolean }[];
  outOfRangeEventCount: number;
  completedBy: string | null;
  completedAt: string | null;
  /** Persisted so a goal/assist/player added across two separate page loads of REPORT-DRAFT never
   * collides with an id generated in an earlier load — `useSafeReportLifecycle` mints
   * `<prefix>-local-<nextLocalId>` ids from this counter (`use-safe-report-lifecycle.ts`), and
   * restarting it at 0 on every reconstruction would let a second add-in-a-later-session reuse an
   * id a first add-in-an-earlier-session already claimed. */
  nextLocalId: number;
}

export interface B08JourneyState {
  version: 3;
  /** `null` only when `report` is also `null` (nothing persisted yet at all). Set on the FIRST
   * write and never silently changed afterwards — see the V3 module doc above. */
  historyOrigin: B08HistoryOrigin | null;
  /** The reporter's own event list at last save — starts as B08-LIVE's canonical cutoff seed,
   * grows only via a real `recordEvent` call on B08-LIVE. Raw: includes `EVENT_REVERSED` markers
   * — callers needing the REAL effective set must run this through
   * `shared/b08-projection.ts`'s `computeEffectiveLiveEvents()`, mirroring production's own real
   * reversal-filtering algorithm (`get-match-detail-after-data.ts`), never a second one.
   * Meaningful only when `historyOrigin === "LIVE_JOURNEY"` — a `"REFERENCE"` origin deliberately
   * leaves this `[]` rather than duplicating the canonical history into a second copy. */
  events: LiveEventSummary[];
  /** Set once "Finish reporting" has been used — the signal the Report candidate uses to decide
   * whether to read this ledger at all (an unfinished journey should not leak a half-recorded
   * event list into the Report candidate; only a journey the coach actually finished should). */
  finished: boolean;
  /** `null` until the coach's own report reducer first reports a state change on REPORT-DRAFT
   * (i.e. reconciliation hasn't started yet) — downstream readers fall back to deriving a draft
   * straight from `events` in that case (the pre-existing P1-6 behavior), unaffected. */
  report: B08PersistedReportState | null;
}

/** `JSON.stringify` has no `Date` representation (round-trips to an ISO string) and drops any
 * key whose value is `undefined` entirely — both would silently violate `LiveEventSummary`'s own
 * real type (`wallClockTime: Date | null`, `clientEventId: string | null`) on load. Revive
 * `wallClockTime` back into a real `Date`; `clientEventId` is normalized to `null` at the write
 * side (`safe-transition-controller.ts`'s `recordEvent`), so no `undefined` ever reaches storage. */
function reviveEvent(raw: LiveEventSummary): LiveEventSummary {
  return { ...raw, wallClockTime: raw.wallClockTime ? new Date(raw.wallClockTime) : null };
}

function readStorage(): B08JourneyState | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<B08JourneyState>;
    if (parsed.version !== 3 || !Array.isArray(parsed.events)) return null;
    return {
      version: 3,
      historyOrigin: parsed.historyOrigin === "REFERENCE" || parsed.historyOrigin === "LIVE_JOURNEY" ? parsed.historyOrigin : null,
      events: parsed.events.map(reviveEvent),
      finished: parsed.finished === true,
      report: parsed.report ?? null,
    };
  } catch {
    // Private-window/blocked-storage/corrupt-JSON — never let a storage failure break the demo;
    // fall back to "no journey" (reference snapshot mode).
    return null;
  }
}

function writeStorage(state: B08JourneyState): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best-effort only.
  }
}

/** The full current journey, or `null` if none exists yet (reference snapshot mode). */
export function loadB08Journey(): B08JourneyState | null {
  return readStorage();
}

/** Which match history a persisted report (if any) is actually grounded in — `null` if nothing
 * has been persisted yet at all. */
export function loadB08HistoryOrigin(): B08HistoryOrigin | null {
  return readStorage()?.historyOrigin ?? null;
}

/** Only a FINISHED, LIVE_JOURNEY-origin journey's events — what the Report candidate should
 * actually read. Returns `null` (reference snapshot: use the canonical fixture) if no journey
 * exists, the origin is `"REFERENCE"` (a reference-mode report edit must never be misread as a
 * resumed, empty LIVE session), or a real journey exists but was never finished (the coach is
 * still mid-session on LIVE; the Report candidate must not show a half-recorded event list as
 * though it were the final record). */
export function loadFinishedB08JourneyEvents(): LiveEventSummary[] | null {
  const state = readStorage();
  if (!state || state.historyOrigin !== "LIVE_JOURNEY" || !state.finished) return null;
  return state.events;
}

/** Called only from a real LIVE recording action (`recordEvent` on B08-LIVE) — establishes
 * `"LIVE_JOURNEY"` as the origin on a fresh journey, or reconfirms it on an already-LIVE_JOURNEY
 * one. REJECTS (does not write anything) if a `"REFERENCE"`-origin report is already persisted —
 * see the V3/fourth-remediation module doc above; the caller must report this as a failed
 * recording, never a successful one. */
export function saveB08JourneyEvents(events: LiveEventSummary[]): B08JourneyWriteResult {
  const current = readStorage();
  if (current?.historyOrigin === "REFERENCE") {
    return { accepted: false, reason: REFERENCE_ORIGIN_CONFLICT_REASON };
  }
  writeStorage({ version: 3, historyOrigin: "LIVE_JOURNEY", events, finished: current?.finished ?? false, report: current?.report ?? null });
  return { accepted: true };
}

/** Same rejection rule as `saveB08JourneyEvents()` above — "finishing" a LIVE session while a
 * REFERENCE-origin report is already persisted would ALSO flip the origin while retaining that
 * report, even if no new event was ever recorded in this session. */
export function markB08JourneyFinished(events: LiveEventSummary[]): B08JourneyWriteResult {
  const current = readStorage();
  if (current?.historyOrigin === "REFERENCE") {
    return { accepted: false, reason: REFERENCE_ORIGIN_CONFLICT_REASON };
  }
  writeStorage({ version: 3, historyOrigin: "LIVE_JOURNEY", events, finished: true, report: current?.report ?? null });
  return { accepted: true };
}

/** The reconciled report state, or `null` if the coach hasn't started reconciling yet (no
 * journey at all, or a finished LIVE journey whose report hasn't been touched on REPORT-DRAFT
 * yet). */
export function loadB08JourneyReport(): B08PersistedReportState | null {
  return readStorage()?.report ?? null;
}

/** Persists the report reducer's own current state — called on every change via
 * `SafePostMatchReportShell`'s `onStateChange` callback, so a reload or a navigation to AFTER/
 * REPORT-COMPLETED never loses reconciliation work or a completion the coach already made. Safe
 * to call even if no LIVE journey exists yet (defensive — REPORT-DRAFT is always reachable
 * directly); the resulting blob is still only ever read as "interactive mode" by downstream
 * pages, which look at this field's own presence, not at `finished`.
 *
 * `origin` seeds `historyOrigin` ONLY on the very first write (no journey/report exists yet) —
 * once set, the ALREADY-STORED origin always wins, so a report mutation can never silently flip
 * which history it is grounded in (a caller passing a stale/wrong `origin` on a LATER edit has no
 * effect; the real origin was already fixed by whichever write happened first). */
export function saveB08JourneyReport(report: B08PersistedReportState, origin: B08HistoryOrigin): void {
  const current = readStorage();
  const effectiveOrigin: B08HistoryOrigin = current?.historyOrigin ?? origin;
  writeStorage({ version: 3, historyOrigin: effectiveOrigin, events: current?.events ?? [], finished: current?.finished ?? false, report });
}

/** Developer-only reset — exposed via `B08TransitionNav` so a reviewer can start a fresh
 * interactive journey without clearing unrelated browser storage by hand. Clears BOTH the LIVE
 * ledger and the reconciled report state in one call — a reset must not leave the report half of
 * the journey behind. */
export function resetB08Journey(): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort only.
  }
}
