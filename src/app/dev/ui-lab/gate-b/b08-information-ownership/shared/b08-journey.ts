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
 */

const STORAGE_KEY = "b08-live-journey-v1";

export interface B08JourneyState {
  version: 1;
  /** The reporter's own event list at last save — starts as B08-LIVE's canonical cutoff seed,
   * grows only via a real `recordEvent` call on B08-LIVE. */
  events: LiveEventSummary[];
  /** Set once "Finish reporting" has been used — the signal the Report candidate uses to decide
   * whether to read this ledger at all (an unfinished journey should not leak a half-recorded
   * event list into the Report candidate; only a journey the coach actually finished should). */
  finished: boolean;
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
    if (parsed.version !== 1 || !Array.isArray(parsed.events)) return null;
    return { version: 1, events: parsed.events.map(reviveEvent), finished: parsed.finished === true };
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
  writeStorage({ version: 1, events, finished: current?.finished ?? false });
}

export function markB08JourneyFinished(events: LiveEventSummary[]): void {
  writeStorage({ version: 1, events, finished: true });
}

/** Developer-only reset — exposed via `B08TransitionNav` so a reviewer can start a fresh
 * interactive journey without clearing unrelated browser storage by hand. */
export function resetB08Journey(): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort only.
  }
}
