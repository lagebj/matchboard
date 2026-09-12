import { describe, it, expect } from "vitest";
import { readinessLabel, toEventListRowInput, type EventListRowSource } from "../event-list-presentation";

function makeEvent(overrides: Partial<EventListRowSource> = {}): EventListRowSource {
  return {
    id: "e1",
    name: "Spring Cup",
    startsAt: new Date("2026-09-20T09:00:00Z"),
    status: "DRAFT",
    squads: [],
    ...overrides,
  };
}

describe("readinessLabel", () => {
  it("returns Done for a finalized event regardless of squad status", () => {
    expect(readinessLabel(makeEvent({ status: "FINALIZED", squads: [{ status: "DRAFT" }] }))).toBe("Done");
  });

  it("returns 'No squads planned' when there are no squads yet", () => {
    expect(readinessLabel(makeEvent({ squads: [] }))).toBe("No squads planned");
  });

  it("returns 'Squads ready' when every squad is locked", () => {
    expect(readinessLabel(makeEvent({ squads: [{ status: "LOCKED" }, { status: "LOCKED" }] }))).toBe("Squads ready");
  });

  it("returns 'Draft squads' when at least one squad is still draft", () => {
    expect(readinessLabel(makeEvent({ squads: [{ status: "LOCKED" }, { status: "DRAFT" }] }))).toBe("Draft squads");
  });
});

describe("toEventListRowInput", () => {
  it("maps a real event row to the view-model input shape, with a null opponentSummary", () => {
    const row = toEventListRowInput(
      makeEvent({ id: "e2", name: "Autumn Friendly Day", status: "DRAFT", squads: [{ status: "DRAFT" }] }),
    );
    expect(row).toEqual({
      eventId: "e2",
      name: "Autumn Friendly Day",
      startsAt: "2026-09-20T09:00:00.000Z",
      opponentSummary: null,
      readiness: "Draft squads",
      isFinalized: false,
    });
  });

  it("marks isFinalized true only for a FINALIZED event", () => {
    expect(toEventListRowInput(makeEvent({ status: "FINALIZED" })).isFinalized).toBe(true);
    expect(toEventListRowInput(makeEvent({ status: "DRAFT" })).isFinalized).toBe(false);
  });
});
