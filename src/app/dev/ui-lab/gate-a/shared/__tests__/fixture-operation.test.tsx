import { describe, it, expect, vi } from "vitest";
import { StrictMode } from "react";
import { renderHook, act } from "@testing-library/react";
import { useFixtureOperation, useDirtyCloseGuard } from "../fixture-operation";

type Authoritative = { assignedTo: string | null; revision: string };
type Draft = { candidateId: string };

function setup() {
  return renderHook(() =>
    useFixtureOperation<Authoritative, Draft, { revision: string }>({ assignedTo: null, revision: "rev-1" }, (authoritative, draft, result) => ({
      assignedTo: draft.candidateId,
      revision: result.revision,
    })),
  );
}

/**
 * Same as `setup()`, but wrapped in `<StrictMode>` — the real-world regression (found via this
 * wave's own CI capture run, not by plain `setup()` above): React Strict Mode intentionally
 * invokes every `setState` functional updater TWICE and keeps only the second call's result, to
 * catch an impure updater. An earlier version of this hook mutated a `useRef` as a side effect
 * inside the updater; the first invocation's mutation was already visible to the second
 * invocation, which then silently no-opped forever. `renderHook`'s default (no wrapper) does NOT
 * exercise this, which is exactly why the bug shipped past the non-Strict-Mode tests below and
 * was only caught in CI, where Next.js's dev server renders the app in Strict Mode.
 */
function setupStrict() {
  return renderHook(
    () =>
      useFixtureOperation<Authoritative, Draft, { revision: string }>({ assignedTo: null, revision: "rev-1" }, (authoritative, draft, result) => ({
        assignedTo: draft.candidateId,
        revision: result.revision,
      })),
    { wrapper: StrictMode },
  );
}

describe("useFixtureOperation", () => {
  it("starts IDLE with no draft and the given authoritative state", () => {
    const { result } = setup();
    expect(result.current.status).toBe("IDLE");
    expect(result.current.draft).toBeNull();
    expect(result.current.authoritative).toEqual({ assignedTo: null, revision: "rev-1" });
  });

  it("SUCCESS applies the draft to authoritative via the caller's reducer and clears the draft", () => {
    const { result } = setup();
    act(() => result.current.setDraft({ candidateId: "player-x" }));
    act(() => result.current.submit({ kind: "SUCCESS", revision: "rev-2", result: { revision: "rev-2" } }));
    expect(result.current.status).toBe("PENDING");
    expect(result.current.authoritative.assignedTo).toBeNull(); // unchanged while pending
    act(() => result.current.resolvePending());
    expect(result.current.status).toBe("SUCCESS");
    expect(result.current.authoritative).toEqual({ assignedTo: "player-x", revision: "rev-2" });
    expect(result.current.draft).toBeNull();
  });

  it.each([
    { kind: "PERMISSION_DENIED", reason: "not allowed" } as const,
    { kind: "CONFLICT", expectedRevision: "rev-1", currentRevision: "rev-2", currentSummary: "someone else changed it" } as const,
    { kind: "PLANNING_CLOSED", reason: "closed" } as const,
    { kind: "SERVER_ERROR", reason: "boom" } as const,
  ])("$kind leaves authoritative state unchanged and preserves the draft", (outcome) => {
    const { result } = setup();
    act(() => result.current.setDraft({ candidateId: "player-x" }));
    act(() => result.current.submit(outcome));
    act(() => result.current.resolvePending());
    expect(result.current.status).toBe(outcome.kind);
    expect(result.current.authoritative).toEqual({ assignedTo: null, revision: "rev-1" });
    expect(result.current.draft).toEqual({ candidateId: "player-x" });
  });

  it("rejects a double submit while already PENDING — a second predeclared outcome never silently queues", () => {
    const { result } = setup();
    act(() => result.current.setDraft({ candidateId: "player-x" }));
    act(() => result.current.submit({ kind: "SUCCESS", revision: "rev-2", result: { revision: "rev-2" } }));
    act(() => result.current.submit({ kind: "SERVER_ERROR", reason: "should be ignored" }));
    act(() => result.current.resolvePending());
    // Only the FIRST submitted outcome (SUCCESS) ever takes effect.
    expect(result.current.status).toBe("SUCCESS");
    expect(result.current.authoritative.assignedTo).toBe("player-x");
  });

  it("throws if submit is called with no draft present", () => {
    const { result } = setup();
    expect(() => act(() => result.current.submit({ kind: "SERVER_ERROR", reason: "x" }))).toThrow(/no draft to submit/);
  });

  it("discardDraft clears the draft and returns to IDLE without touching authoritative state", () => {
    const { result } = setup();
    act(() => result.current.setDraft({ candidateId: "player-x" }));
    act(() => result.current.discardDraft());
    expect(result.current.draft).toBeNull();
    expect(result.current.status).toBe("IDLE");
    expect(result.current.authoritative).toEqual({ assignedTo: null, revision: "rev-1" });
  });

  it("a DENIED resolution can be followed by a fresh draft and a new predeclared outcome (retry selects a new response, never auto-reapplies the old one)", () => {
    const { result } = setup();
    act(() => result.current.setDraft({ candidateId: "player-x" }));
    act(() => result.current.submit({ kind: "PERMISSION_DENIED", reason: "nope" }));
    act(() => result.current.resolvePending());
    expect(result.current.status).toBe("PERMISSION_DENIED");
    act(() => result.current.discardDraft());
    act(() => result.current.setDraft({ candidateId: "player-y" }));
    act(() => result.current.submit({ kind: "SUCCESS", revision: "rev-3", result: { revision: "rev-3" } }));
    act(() => result.current.resolvePending());
    expect(result.current.status).toBe("SUCCESS");
    expect(result.current.authoritative).toEqual({ assignedTo: "player-y", revision: "rev-3" });
  });

  describe("under React.StrictMode (regression: CI capture run found resolvePending() never left PENDING in dev mode)", () => {
    it("resolvePending() reaches SUCCESS and applies the draft, not stuck at PENDING", () => {
      const { result } = setupStrict();
      act(() => result.current.setDraft({ candidateId: "player-x" }));
      act(() => result.current.submit({ kind: "SUCCESS", revision: "rev-2", result: { revision: "rev-2" } }));
      expect(result.current.status).toBe("PENDING");
      act(() => result.current.resolvePending());
      expect(result.current.status).toBe("SUCCESS");
      expect(result.current.authoritative).toEqual({ assignedTo: "player-x", revision: "rev-2" });
    });

    it("resolvePending() reaches a denial outcome, not stuck at PENDING", () => {
      const { result } = setupStrict();
      act(() => result.current.setDraft({ candidateId: "player-x" }));
      act(() => result.current.submit({ kind: "PERMISSION_DENIED", reason: "nope" }));
      act(() => result.current.resolvePending());
      expect(result.current.status).toBe("PERMISSION_DENIED");
      expect(result.current.authoritative).toEqual({ assignedTo: null, revision: "rev-1" });
    });

    it("a second resolvePending() call after settling is a no-op, not a re-application", () => {
      const { result } = setupStrict();
      act(() => result.current.setDraft({ candidateId: "player-x" }));
      act(() => result.current.submit({ kind: "SUCCESS", revision: "rev-2", result: { revision: "rev-2" } }));
      act(() => result.current.resolvePending());
      act(() => result.current.resolvePending());
      expect(result.current.status).toBe("SUCCESS");
      expect(result.current.authoritative).toEqual({ assignedTo: "player-x", revision: "rev-2" });
    });
  });
});

describe("useDirtyCloseGuard", () => {
  it("closes immediately when there is no draft and nothing is pending", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDirtyCloseGuard(false, false, onClose));
    act(() => result.current.requestClose());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result.current.confirming).toBe(false);
  });

  it("asks for confirmation instead of closing when a draft is present, and does not call onClose until confirmed", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDirtyCloseGuard(true, false, onClose));
    act(() => result.current.requestClose());
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.confirming).toBe(true);
    act(() => result.current.confirmDiscardAndClose());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result.current.confirming).toBe(false);
  });

  it("cancelConfirm keeps editing without closing", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDirtyCloseGuard(true, false, onClose));
    act(() => result.current.requestClose());
    act(() => result.current.cancelConfirm());
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.confirming).toBe(false);
  });

  describe("isPending blocks closing entirely (independent review finding: discarding a PENDING draft silently abandoned a submitted-but-unresolved fixture response)", () => {
    it("requestClose() is a no-op while pending — no onClose call, no confirmation prompt", () => {
      const onClose = vi.fn();
      const { result } = renderHook(() => useDirtyCloseGuard(true, true, onClose));
      act(() => result.current.requestClose());
      expect(onClose).not.toHaveBeenCalled();
      expect(result.current.confirming).toBe(false); // blocked silently, not offered as a choice
    });

    it("repeated requestClose() attempts while pending never leave a stale confirmation prompt open", () => {
      const onClose = vi.fn();
      const { result } = renderHook(() => useDirtyCloseGuard(true, true, onClose));
      act(() => result.current.requestClose());
      act(() => result.current.requestClose());
      act(() => result.current.requestClose());
      expect(result.current.confirming).toBe(false);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("once no longer pending, requestClose() resumes normal dirty-draft behavior", () => {
      const onClose = vi.fn();
      const { result, rerender } = renderHook(({ isPending }: { isPending: boolean }) => useDirtyCloseGuard(true, isPending, onClose), {
        initialProps: { isPending: true },
      });
      act(() => result.current.requestClose());
      expect(onClose).not.toHaveBeenCalled();

      rerender({ isPending: false }); // the fixture-simulation step settled
      act(() => result.current.requestClose());
      expect(onClose).not.toHaveBeenCalled(); // a draft is still present — confirmation, not a free close
      expect(result.current.confirming).toBe(true);
      act(() => result.current.confirmDiscardAndClose());
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("integration with useFixtureOperation: the real PENDING -> resolved -> close lifecycle", () => {
    function setupGuarded() {
      const onCloseSpy = vi.fn();
      const hook = renderHook(() => {
        const op = useFixtureOperation<number, { id: string }, { ok: true }>(0, (authoritative) => authoritative + 1);
        const guard = useDirtyCloseGuard(op.draft !== null, op.status === "PENDING", onCloseSpy);
        return { op, guard };
      });
      return { ...hook, onCloseSpy };
    }

    it("PENDING blocks Close/Escape; resolving to SUCCESS then allows an immediate close", () => {
      const { result, onCloseSpy } = setupGuarded();
      act(() => result.current.op.setDraft({ id: "x" }));
      act(() => result.current.op.submit({ kind: "SUCCESS", revision: "r1", result: { ok: true } }));
      expect(result.current.op.status).toBe("PENDING");

      // Close/Escape while PENDING: blocked, operation untouched, no stale confirmation prompt.
      act(() => result.current.guard.requestClose());
      expect(onCloseSpy).not.toHaveBeenCalled();
      expect(result.current.guard.confirming).toBe(false);
      expect(result.current.op.status).toBe("PENDING");
      expect(result.current.op.draft).toEqual({ id: "x" });

      act(() => result.current.op.resolvePending());
      expect(result.current.op.status).toBe("SUCCESS");
      expect(result.current.op.authoritative).toBe(1);

      act(() => result.current.guard.requestClose());
      expect(onCloseSpy).toHaveBeenCalledTimes(1); // SUCCESS clears the draft, so this closes immediately
    });

    it("PENDING blocks Close; resolving to PERMISSION_DENIED then requires discard confirmation, never silently reapplying it", () => {
      const { result, onCloseSpy } = setupGuarded();
      act(() => result.current.op.setDraft({ id: "x" }));
      act(() => result.current.op.submit({ kind: "PERMISSION_DENIED", reason: "nope" }));
      act(() => result.current.guard.requestClose()); // blocked
      expect(onCloseSpy).not.toHaveBeenCalled();

      act(() => result.current.op.resolvePending());
      expect(result.current.op.status).toBe("PERMISSION_DENIED");

      act(() => result.current.guard.requestClose());
      expect(onCloseSpy).not.toHaveBeenCalled();
      expect(result.current.guard.confirming).toBe(true); // draft retained, now a normal discard prompt
      act(() => result.current.guard.confirmDiscardAndClose());
      expect(onCloseSpy).toHaveBeenCalledTimes(1);
      expect(result.current.op.authoritative).toBe(0); // never applied
    });
  });

  describe("under React.StrictMode", () => {
    it("the PENDING block and subsequent resolved-close behavior both hold under double-invocation", () => {
      const onClose = vi.fn();
      const { result } = renderHook(
        () => {
          const op = useFixtureOperation<number, { id: string }, { ok: true }>(0, (authoritative) => authoritative + 1);
          const guard = useDirtyCloseGuard(op.draft !== null, op.status === "PENDING", onClose);
          return { op, guard };
        },
        { wrapper: StrictMode },
      );
      act(() => result.current.op.setDraft({ id: "x" }));
      act(() => result.current.op.submit({ kind: "SUCCESS", revision: "r1", result: { ok: true } }));
      act(() => result.current.guard.requestClose());
      expect(onClose).not.toHaveBeenCalled();
      act(() => result.current.op.resolvePending());
      expect(result.current.op.status).toBe("SUCCESS");
      act(() => result.current.guard.requestClose());
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
