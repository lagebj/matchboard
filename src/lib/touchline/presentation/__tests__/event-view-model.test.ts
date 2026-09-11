import { describe, it, expect } from "vitest";
import { buildEventListViewModel, buildEventDetailViewModel, type EventListRowInput } from "../event-view-model";

function event(overrides: Partial<EventListRowInput> & { eventId: string; startsAt: string }): EventListRowInput {
  return {
    name: "Event",
    opponentSummary: null,
    readiness: "Draft squads",
    isFinalized: false,
    ...overrides,
  };
}

describe("buildEventListViewModel", () => {
  const now = "2026-09-11T12:00:00Z";

  it("picks the earliest non-finalized upcoming event as next", () => {
    const vm = buildEventListViewModel(
      [
        event({ eventId: "later", startsAt: "2026-09-20T10:00:00Z" }),
        event({ eventId: "soonest", startsAt: "2026-09-12T10:00:00Z" }),
        event({ eventId: "past", startsAt: "2026-09-01T10:00:00Z" }),
      ],
      now,
    );
    expect(vm.nextEvent?.eventId).toBe("soonest");
    expect(vm.upcoming.map((e) => e.eventId)).toEqual(["later"]);
    expect(vm.past.map((e) => e.eventId)).toEqual(["past"]);
  });

  it("skips a finalized event for 'next' even if it is the earliest upcoming one", () => {
    const vm = buildEventListViewModel(
      [
        event({ eventId: "finalized-soonest", startsAt: "2026-09-12T10:00:00Z", isFinalized: true }),
        event({ eventId: "open-later", startsAt: "2026-09-15T10:00:00Z" }),
      ],
      now,
    );
    expect(vm.nextEvent?.eventId).toBe("open-later");
  });

  it("orders past events most-recent-first", () => {
    const vm = buildEventListViewModel(
      [
        event({ eventId: "old", startsAt: "2026-08-01T10:00:00Z" }),
        event({ eventId: "recent", startsAt: "2026-09-05T10:00:00Z" }),
      ],
      now,
    );
    expect(vm.past.map((e) => e.eventId)).toEqual(["recent", "old"]);
  });
});

describe("buildEventDetailViewModel", () => {
  it("counts confirmed vs total helpers", () => {
    const vm = buildEventDetailViewModel({
      eventId: "e1",
      name: "Demo Cup",
      venue: "Slemmestad",
      gameFormat: "SEVEN_A_SIDE",
      nextMatch: null,
      timeline: [],
      squadReadiness: [],
      helpers: [
        { playerName: "Coach A", targetMatchLabel: "M1", confirmed: true },
        { playerName: "Coach B", targetMatchLabel: "M2", confirmed: false },
      ],
    });
    expect(vm.helpersConfirmedCount).toBe(1);
    expect(vm.helpersTotalCount).toBe(2);
  });
});
