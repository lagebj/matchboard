import { describe, it, expect } from "vitest";
import { computeRotationTimelineStates } from "../get-rotation-timeline-states";

describe("computeRotationTimelineStates", () => {
  it("marks every APPLIED change as done", () => {
    const states = computeRotationTimelineStates([{ status: "APPLIED" }, { status: "APPLIED" }]);
    expect(states).toEqual(["done", "done"]);
  });

  it("marks the first non-applied change as next and later ones as later", () => {
    const states = computeRotationTimelineStates([
      { status: "APPLIED" },
      { status: "PENDING" },
      { status: "PENDING" },
      { status: "SKIPPED" },
    ]);
    expect(states).toEqual(["done", "next", "later", "later"]);
  });

  it("marks the first change as next when nothing has been applied yet", () => {
    const states = computeRotationTimelineStates([{ status: "PENDING" }, { status: "PENDING" }]);
    expect(states).toEqual(["next", "later"]);
  });

  it("returns an empty array for an empty plan", () => {
    expect(computeRotationTimelineStates([])).toEqual([]);
  });

  it("marks every change done when the whole plan has been applied", () => {
    const states = computeRotationTimelineStates([{ status: "APPLIED" }, { status: "APPLIED" }, { status: "APPLIED" }]);
    expect(states).toEqual(["done", "done", "done"]);
  });
});
