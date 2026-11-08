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
 * mirrors that real separation instead of inventing a single merged ledger. Storage key bumped
 * (`-v1` -> `-v2`) as the explicit version increment — a v1 blob is simply never read, the
 * safest possible migration for a client-only, tab-scoped, dev-fixture store (no partial-read
 * risk, no crash, just starts fresh — the same "reference snapshot" default as a brand-new
 * session).
 */

const STORAGE_KEY = "b08-live-journey-v2";

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
  version: 2;
  /** The reporter's own event list at last save — starts as B08-LIVE's canonical cutoff seed,
   * grows only via a real `recordEvent` call on B08-LIVE. Raw: includes `EVENT_REVERSED` markers
   * — callers needing the REAL effective set must run this through
   * `shared/b08-projection.ts`'s `computeEffectiveLiveEvents()`, mirroring production's own real
   * reversal-filtering algorithm (`get-match-detail-after-data.ts`), never a second one. */
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
    if (parsed.version !== 2 || !Array.isArray(parsed.events)) return null;
    return {
      version: 2,
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

/** Only the FINISHED journey's events — what the Report candidate should actually read. Returns
 * `null` (reference snapshot: use the canonical fixture) if no journey exists, or one exists but
 * was never finished (the coach is still mid-session on LIVE; the Report candidate must not show
 * a half-recorded event list as though it were the final record). */
export function loadFinishedB08JourneyEvents(): LiveEventSummary[] | null {
  const state = readStorage();
  if (!state || !state.finished) return null;
  return state.events;
}

export function saveB08JourneyEvents(events: LiveEventSummary[]): void {
  const current = readStorage();
  writeStorage({ version: 2, events, finished: current?.finished ?? false, report: current?.report ?? null });
}

export function markB08JourneyFinished(events: LiveEventSummary[]): void {
  const current = readStorage();
  writeStorage({ version: 2, events, finished: true, report: current?.report ?? null });
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
 * pages, which look at this field's own presence, not at `finished`. */
export function saveB08JourneyReport(report: B08PersistedReportState): void {
  const current = readStorage();
  writeStorage({ version: 2, events: current?.events ?? [], finished: current?.finished ?? false, report });
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
