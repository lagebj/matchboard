"use client";

import { useCallback, useState } from "react";

/**
 * Gate A W3 shared state machine (`03_INTERACTION_AND_POLICY_CONTRACT.md` "State-machine
 * invariant"): every A07/A09 save-flow scenario needs the SAME shape — a separate
 * `authoritativeFixtureState` and `draftState`, where only a `SUCCESS` outcome ever mutates the
 * authoritative one. `DENIED`/`CONFLICT`/`PLANNING_CLOSED`/`SERVER_ERROR` must leave it untouched
 * and retain the draft for inspection/discard. W1/W2 never needed this (A01/A12 are local-only,
 * A04 is read-only — confirmed by research before building this), so this is new ground, not a
 * duplicate of an existing hook.
 *
 * `FixtureOperationOutcome` is the typed **fixture-response port** the bundle requires
 * (`01_START_PROMPT.md` §2): outcomes are predeclared data objects a scenario's `fixtures.ts`
 * exports, never computed by a client-side permission algorithm. `submit()` only ever accepts an
 * outcome the caller already has in hand from its fixture — this module has no branch that
 * invents eligibility, denial, or conflict on its own.
 */
export type FixtureOperationOutcome<TSuccess> =
  | { kind: "SUCCESS"; revision: string; result: TSuccess }
  | { kind: "PERMISSION_DENIED"; reason: string }
  | { kind: "CONFLICT"; expectedRevision: string; currentRevision: string; currentSummary: string }
  | { kind: "PLANNING_CLOSED"; reason: string }
  | { kind: "SERVER_ERROR"; reason: string };

export type FixtureOperationStatus = "IDLE" | "PENDING" | "SUCCESS" | "PERMISSION_DENIED" | "CONFLICT" | "PLANNING_CLOSED" | "SERVER_ERROR";

export type FixtureOperationState<TAuthoritative, TDraft, TSuccess> = {
  authoritative: TAuthoritative;
  draft: TDraft | null;
  status: FixtureOperationStatus;
  outcome: FixtureOperationOutcome<TSuccess> | null;
  /**
   * Holds the predeclared outcome between `submit()` (enters PENDING) and `resolvePending()`
   * (applies it) — the deterministic "fixture-step controller" the capture matrix asks for
   * (`04_TESTS_AND_CAPTURE_MATRIX.md` §"Capture scenarios": "no random timers/network; use a
   * deterministic fixture-step controller/test gate"). A real, visible UI control triggers
   * `resolvePending()`, never a `setTimeout`.
   *
   * Deliberately part of React state, NOT a `useRef` mutated inside a `setState` updater — an
   * earlier version used a ref there, which is impure (a `setState` updater must be a pure
   * function of its input state). React's Strict Mode intentionally invokes every functional
   * updater TWICE to catch exactly this: the first call's `ref.current = null` side effect had
   * already run by the time the second call read the ref, so the second call (the one React
   * actually keeps) always saw a `null` outcome and silently no-opped — `resolvePending()` could
   * never leave `PENDING` in dev mode. Found via this wave's own CI capture run, not by local
   * testing (`@testing-library/react` does not wrap in Strict Mode, so the component tests never
   * exercised the double-invoke). Keeping this in state makes every updater pure and idempotent
   * under a double call, which is the actual fix — not a workaround.
   */
  pendingOutcome: FixtureOperationOutcome<TSuccess> | null;
};

/**
 * `applySuccess` is the only place a `SUCCESS` outcome is allowed to change the authoritative
 * projection — callers pass a pure reducer, never a direct mutation, so "only SUCCESS changes
 * authoritative state" is structural rather than a convention someone can forget at a call site.
 */
export function useFixtureOperation<TAuthoritative, TDraft, TSuccess>(
  initialAuthoritative: TAuthoritative,
  applySuccess: (authoritative: TAuthoritative, draft: TDraft, result: TSuccess) => TAuthoritative,
) {
  const [state, setState] = useState<FixtureOperationState<TAuthoritative, TDraft, TSuccess>>({
    authoritative: initialAuthoritative,
    draft: null,
    status: "IDLE",
    outcome: null,
    pendingOutcome: null,
  });

  const setDraft = useCallback((draft: TDraft | null) => {
    setState((s) => (s.status === "PENDING" ? s : { ...s, draft, status: "IDLE", outcome: null, pendingOutcome: null }));
  }, []);

  const submit = useCallback((outcome: FixtureOperationOutcome<TSuccess>) => {
    setState((s) => {
      // Guards duplicate submit (`04_TESTS_AND_CAPTURE_MATRIX.md` #4: "Tests must reject an
      // attempt to submit twice") — a second submit while already PENDING is a no-op, not a
      // second predeclared outcome silently queued.
      if (s.status === "PENDING") return s;
      if (s.draft === null) {
        throw new Error("useFixtureOperation.submit: no draft to submit — a fixture response must apply to a real pending change.");
      }
      return { ...s, status: "PENDING", outcome: null, pendingOutcome: outcome };
    });
  }, []);

  const resolvePending = useCallback(() => {
    setState((s) => {
      if (s.status !== "PENDING" || !s.pendingOutcome) return s;
      const outcome = s.pendingOutcome;
      if (outcome.kind === "SUCCESS") {
        if (s.draft === null) {
          throw new Error("useFixtureOperation.resolvePending: SUCCESS outcome with no draft to apply.");
        }
        return { authoritative: applySuccess(s.authoritative, s.draft, outcome.result), draft: null, status: "SUCCESS", outcome, pendingOutcome: null };
      }
      // DENIED / CONFLICT / PLANNING_CLOSED / SERVER_ERROR: authoritative and draft are
      // untouched — the coach's proposed change stays visible for inspection or discard.
      return { ...s, status: outcome.kind, outcome, pendingOutcome: null };
    });
  }, [applySuccess]);

  const discardDraft = useCallback(() => {
    setState((s) => ({ ...s, draft: null, status: "IDLE", outcome: null, pendingOutcome: null }));
  }, []);

  return {
    authoritative: state.authoritative,
    draft: state.draft,
    status: state.status,
    outcome: state.outcome,
    setDraft,
    submit,
    resolvePending,
    discardDraft,
  };
}

/**
 * Shared dirty-draft close guard (A07-S6, `02_SCENARIOS_AND_FIXTURES.md`: "editor dismissed with
 * dirty draft" — "Escape and browser Back do not silently drop pending edits"). A single hook so
 * every A07 scenario's X/Escape/Back path gets the same guard for free, rather than re-
 * implementing a "confirm discard" dialog per scenario page.
 */
export function useDirtyCloseGuard(hasDraft: boolean, onClose: () => void) {
  const [confirming, setConfirming] = useState(false);

  const requestClose = useCallback(() => {
    if (hasDraft) {
      setConfirming(true);
      return;
    }
    onClose();
  }, [hasDraft, onClose]);

  const confirmDiscardAndClose = useCallback(() => {
    setConfirming(false);
    onClose();
  }, [onClose]);

  const cancelConfirm = useCallback(() => setConfirming(false), []);

  return { confirming, requestClose, confirmDiscardAndClose, cancelConfirm };
}
