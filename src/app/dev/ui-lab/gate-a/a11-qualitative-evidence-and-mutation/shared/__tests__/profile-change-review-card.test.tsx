import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { StrictMode } from "react";
import { useProfileChangeReview } from "../profile-change-review-card";

describe("useProfileChangeReview — the authoritative state model (independent review finding R5)", () => {
  it("before any decision, the authoritative primary is the starting value, outcome is null", () => {
    const { result } = renderHook(() => useProfileChangeReview("DM", "CM"));
    expect(result.current.authoritativePrimary).toBe("DM");
    expect(result.current.outcome).toBeNull();
  });

  it("Accept changes the authoritative primary to the proposed value exactly once", () => {
    const { result } = renderHook(() => useProfileChangeReview("DM", "CM"));
    act(() => result.current.accept());
    expect(result.current.authoritativePrimary).toBe("CM");
    expect(result.current.outcome).toBe("ACCEPTED");
  });

  it("Reject leaves the authoritative primary unchanged", () => {
    const { result } = renderHook(() => useProfileChangeReview("DM", "CM"));
    act(() => result.current.reject());
    expect(result.current.authoritativePrimary).toBe("DM");
    expect(result.current.outcome).toBe("REJECTED");
  });

  it("Defer leaves the authoritative primary unchanged and is distinct from Reject", () => {
    const { result } = renderHook(() => useProfileChangeReview("DM", "CM"));
    act(() => result.current.defer());
    expect(result.current.authoritativePrimary).toBe("DM");
    expect(result.current.outcome).toBe("DEFERRED");
  });

  it("a repeated Accept after the first is a no-op — the change is never applied twice", () => {
    const { result } = renderHook(() => useProfileChangeReview("DM", "CM"));
    act(() => result.current.accept());
    act(() => result.current.accept());
    act(() => result.current.accept());
    expect(result.current.authoritativePrimary).toBe("CM");
    expect(result.current.outcome).toBe("ACCEPTED");
  });

  it("once Rejected, a later Accept call cannot silently reopen and apply the change", () => {
    const { result } = renderHook(() => useProfileChangeReview("DM", "CM"));
    act(() => result.current.reject());
    act(() => result.current.accept());
    expect(result.current.authoritativePrimary).toBe("DM");
    expect(result.current.outcome).toBe("REJECTED");
  });

  it("the updater is pure and idempotent under React Strict Mode's double-invoke", () => {
    const { result } = renderHook(() => useProfileChangeReview("DM", "CM"), { wrapper: StrictMode });
    act(() => result.current.accept());
    expect(result.current.authoritativePrimary).toBe("CM");
    expect(result.current.outcome).toBe("ACCEPTED");
  });
});
