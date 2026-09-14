/**
 * Browser-local "Dismiss today" state (ADR-0141, `04_BROWSER_LOCAL_STATE.md` "Dismiss today").
 * Pure comparison/pruning logic — the actual `localStorage` read/write lives in the client
 * component that owns the DOM; kept here so it is unit-testable without a DOM.
 */

export type TodayDismissedStateV1 = {
  version: 1;
  items: Array<{ fingerprint: string; displayDateKey: string }>;
};

export function emptyTodayDismissedState(): TodayDismissedStateV1 {
  return { version: 1, items: [] };
}

/** Drop entries for a display date other than today's — "dismiss today" never persists past
 * the display day it was dismissed on. */
export function pruneStaleDismissals(
  state: TodayDismissedStateV1 | null | undefined,
  currentDisplayDateKey: string,
): TodayDismissedStateV1 {
  if (!state || state.version !== 1) return emptyTodayDismissedState();
  return {
    version: 1,
    items: state.items.filter((item) => item.displayDateKey === currentDisplayDateKey),
  };
}

export function isDismissed(
  state: TodayDismissedStateV1,
  fingerprint: string,
  currentDisplayDateKey: string,
): boolean {
  return state.items.some(
    (item) => item.fingerprint === fingerprint && item.displayDateKey === currentDisplayDateKey,
  );
}

export function withDismissal(
  state: TodayDismissedStateV1,
  fingerprint: string,
  currentDisplayDateKey: string,
): TodayDismissedStateV1 {
  if (isDismissed(state, fingerprint, currentDisplayDateKey)) return state;
  return { version: 1, items: [...state.items, { fingerprint, displayDateKey: currentDisplayDateKey }] };
}

export function withoutDismissal(state: TodayDismissedStateV1, fingerprint: string): TodayDismissedStateV1 {
  return { version: 1, items: state.items.filter((item) => item.fingerprint !== fingerprint) };
}
