import { describe, it, expect } from "vitest";
import {
  buildEventsOperatingViewModel,
  EVENTS_ATTENTION_MAX,
} from "../events-overview-view-model";
import type { EventsOverviewEventRow } from "@/lib/events/get-events-overview";

const NOW = "2026-09-16T12:00:00Z";

function squad(
  overrides: Partial<EventsOverviewEventRow["squads"][number]> & { id: string },
): EventsOverviewEventRow["squads"][number] {
  return {
    name: "Squad",
    status: "DRAFT",
    targetSize: 12,
    minSize: null,
    players: [],
    ...overrides,
  };
}

function event(
  overrides: Partial<EventsOverviewEventRow> & { id: string; startsAt: Date },
): EventsOverviewEventRow {
  return {
    name: "Event",
    eventType: "CUP",
    endsAt: null,
    status: "DRAFT",
    squads: [],
    players: [],
    eventMatches: [],
    ...overrides,
  };
}

describe("buildEventsOperatingViewModel — featured Event selection", () => {
  it("selects the earliest non-finalized upcoming Event", () => {
    const vm = buildEventsOperatingViewModel(
      [
        event({ id: "later", startsAt: new Date("2026-09-25T10:00:00Z") }),
        event({ id: "soonest", startsAt: new Date("2026-09-18T10:00:00Z") }),
        event({ id: "past", startsAt: new Date("2026-09-01T10:00:00Z") }),
      ],
      NOW,
    );
    expect(vm.featuredEvent?.eventId).toBe("soonest");
  });

  it("falls back to the earliest upcoming Event when every upcoming Event is finalized", () => {
    const vm = buildEventsOperatingViewModel(
      [
        event({ id: "finalized-soonest", startsAt: new Date("2026-09-18T10:00:00Z"), status: "FINALIZED" }),
        event({ id: "finalized-later", startsAt: new Date("2026-09-25T10:00:00Z"), status: "FINALIZED" }),
      ],
      NOW,
    );
    expect(vm.featuredEvent?.eventId).toBe("finalized-soonest");
    expect(vm.featuredEvent?.finalized).toBe(true);
    expect(vm.featuredEvent?.readinessLabel).toBe("Done");
  });

  it("is explicitly null when there is no upcoming Event", () => {
    const vm = buildEventsOperatingViewModel(
      [event({ id: "past", startsAt: new Date("2026-09-01T10:00:00Z") })],
      NOW,
    );
    expect(vm.featuredEvent).toBeNull();
    expect(vm.hasAnyEvents).toBe(true);
    expect(vm.hasUpcomingEvents).toBe(false);
  });

  it("reports no Events at all", () => {
    const vm = buildEventsOperatingViewModel([], NOW);
    expect(vm.featuredEvent).toBeNull();
    expect(vm.hasAnyEvents).toBe(false);
    expect(vm.hasUpcomingEvents).toBe(false);
  });
});

describe("buildEventsOperatingViewModel — readiness facts", () => {
  it("computes factual populated/locked squad counts, configured matches, helper count, guest count", () => {
    const vm = buildEventsOperatingViewModel(
      [
        event({
          id: "next",
          startsAt: new Date("2026-09-18T10:00:00Z"),
          squads: [
            squad({ id: "s1", status: "LOCKED", players: [{ id: "p1", playerId: "pl1", guestPlayerId: null }] }),
            squad({ id: "s2", status: "DRAFT", players: [] }),
          ],
          players: [
            { id: "ea1", playerId: null, guestPlayerId: "g1", status: "AVAILABLE" },
            { id: "ea2", playerId: null, guestPlayerId: "g2", status: "WITHDRAWN" },
          ],
          eventMatches: [
            { id: "m1", status: "SCHEDULED", supportAssignments: [{ id: "sa1" }, { id: "sa2" }] },
            { id: "m2", status: "CANCELLED", supportAssignments: [{ id: "sa3" }] },
          ],
        }),
      ],
      NOW,
    );

    const readiness = vm.featuredEvent!.readiness;
    expect(readiness.totalSquads).toBe(2);
    expect(readiness.populatedSquads).toBe(1);
    expect(readiness.lockedSquads).toBe(1);
    // Cancelled match excluded from configured count.
    expect(readiness.configuredMatchCount).toBe(1);
    // Helper count is a factual assignment count only — includes the cancelled match's
    // assignment (it is still a real assignment) but never a required-denominator concept.
    expect(readiness.helperAssignmentCount).toBe(3);
    // Guest count excludes the withdrawn guest.
    expect(readiness.guestPlayerCount).toBe(1);
  });

  it("never invents a required-helper denominator in the output shape", () => {
    const vm = buildEventsOperatingViewModel(
      [event({ id: "next", startsAt: new Date("2026-09-18T10:00:00Z") })],
      NOW,
    );
    expect(Object.keys(vm.featuredEvent!.readiness)).not.toContain("helperRequiredCount");
    expect(Object.keys(vm.featuredEvent!.readiness)).not.toContain("helpersConfirmed");
  });
});

describe("buildEventsOperatingViewModel — participating squads", () => {
  it("marks Ready only for LOCKED squads and computes missing count", () => {
    const vm = buildEventsOperatingViewModel(
      [
        event({
          id: "next",
          startsAt: new Date("2026-09-18T10:00:00Z"),
          squads: [
            squad({ id: "s1", name: "Squad 1", status: "LOCKED", targetSize: 12, players: Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, playerId: `pl${i}`, guestPlayerId: null })) }),
            squad({ id: "s2", name: "Squad 2", status: "DRAFT", targetSize: 12, players: Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, playerId: `ql${i}`, guestPlayerId: null })) }),
          ],
        }),
      ],
      NOW,
    );
    const [sq1, sq2] = vm.featuredEvent!.squads;
    expect(sq1.isReady).toBe(true);
    expect(sq1.missingCount).toBe(0);
    expect(sq2.isReady).toBe(false);
    expect(sq2.missingCount).toBe(2);
  });
});

describe("buildEventsOperatingViewModel — needs attention", () => {
  it("shows 'no squads planned' when the Event has zero squads", () => {
    const vm = buildEventsOperatingViewModel(
      [event({ id: "next", startsAt: new Date("2026-09-18T10:00:00Z"), squads: [] })],
      NOW,
    );
    expect(vm.featuredEvent!.attention[0]).toMatchObject({ id: "no-squads", target: "squads" });
  });

  it("suppresses below-target attention for a squad already flagged below-minimum", () => {
    const vm = buildEventsOperatingViewModel(
      [
        event({
          id: "next",
          startsAt: new Date("2026-09-18T10:00:00Z"),
          squads: [
            squad({ id: "s1", name: "Blå", status: "DRAFT", targetSize: 12, minSize: 9, players: Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, playerId: `pl${i}`, guestPlayerId: null })) }),
          ],
        }),
      ],
      NOW,
    );
    const ids = vm.featuredEvent!.attention.map((a) => a.id);
    expect(ids).toContain("below-min-s1");
    expect(ids).not.toContain("below-target-s1");
  });

  it("does not duplicate below-minimum/below-target as an empty-squad item", () => {
    const vm = buildEventsOperatingViewModel(
      [
        event({
          id: "next",
          startsAt: new Date("2026-09-18T10:00:00Z"),
          squads: [squad({ id: "s1", name: "Blå", status: "DRAFT", targetSize: 12, minSize: 9, players: [] })],
        }),
      ],
      NOW,
    );
    const ids = vm.featuredEvent!.attention.map((a) => a.id);
    expect(ids).toContain("empty-s1");
    expect(ids).not.toContain("below-min-s1");
    expect(ids).not.toContain("below-target-s1");
  });

  it("aggregates assigned unavailable/withdrawn players into one factual item", () => {
    const vm = buildEventsOperatingViewModel(
      [
        event({
          id: "next",
          startsAt: new Date("2026-09-18T10:00:00Z"),
          squads: [squad({ id: "s1", status: "LOCKED", players: Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, playerId: `pl${i}`, guestPlayerId: null })) })],
          players: [
            { id: "ea1", playerId: "pl0", guestPlayerId: null, status: "UNAVAILABLE" },
            { id: "ea2", playerId: "pl1", guestPlayerId: null, status: "WITHDRAWN" },
            { id: "ea3", playerId: "pl2", guestPlayerId: null, status: "AVAILABLE" },
          ],
          eventMatches: [{ id: "m1", status: "SCHEDULED", supportAssignments: [] }],
        }),
      ],
      NOW,
    );
    const item = vm.featuredEvent!.attention.find((a) => a.id === "unavailable");
    expect(item).toMatchObject({ title: "2 assigned player(s) unavailable", target: "pool" });
  });

  it("shows 'no matches' only at zero active configured EventMatches", () => {
    const withMatches = buildEventsOperatingViewModel(
      [
        event({
          id: "next",
          startsAt: new Date("2026-09-18T10:00:00Z"),
          squads: [squad({ id: "s1", status: "LOCKED", players: Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, playerId: `pl${i}`, guestPlayerId: null })) })],
          eventMatches: [{ id: "m1", status: "SCHEDULED", supportAssignments: [] }],
        }),
      ],
      NOW,
    );
    expect(withMatches.featuredEvent!.attention.map((a) => a.id)).not.toContain("no-matches");

    const onlyCancelled = buildEventsOperatingViewModel(
      [
        event({
          id: "next",
          startsAt: new Date("2026-09-18T10:00:00Z"),
          squads: [squad({ id: "s1", status: "LOCKED", players: Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, playerId: `pl${i}`, guestPlayerId: null })) })],
          eventMatches: [{ id: "m1", status: "CANCELLED", supportAssignments: [] }],
        }),
      ],
      NOW,
    );
    expect(onlyCancelled.featuredEvent!.attention.map((a) => a.id)).toContain("no-matches");
  });

  it("returns the full deterministic attention list (components own the initial-4 cap/disclosure)", () => {
    const vm = buildEventsOperatingViewModel(
      [
        event({
          id: "next",
          startsAt: new Date("2026-09-18T10:00:00Z"),
          squads: [
            squad({ id: "s1", name: "A", status: "DRAFT", players: [] }),
            squad({ id: "s2", name: "B", status: "DRAFT", players: [] }),
            squad({ id: "s3", name: "C", status: "DRAFT", players: [] }),
          ],
          players: [{ id: "ea1", playerId: "pl0", guestPlayerId: null, status: "UNAVAILABLE" }],
          eventMatches: [],
        }),
      ],
      NOW,
    );
    expect(vm.featuredEvent!.attention.length).toBeGreaterThan(EVENTS_ATTENTION_MAX);
    expect(vm.featuredEvent!.attention.map((a) => a.id)).toEqual([
      "empty-s1",
      "empty-s2",
      "empty-s3",
      "unavailable",
      "no-matches",
    ]);
  });

  it("shows no pre-event attention panel for a finalized featured Event", () => {
    const vm = buildEventsOperatingViewModel(
      [event({ id: "next", startsAt: new Date("2026-09-18T10:00:00Z"), status: "FINALIZED", squads: [] })],
      NOW,
    );
    expect(vm.featuredEvent!.attention).toEqual([]);
  });
});

describe("buildEventsOperatingViewModel — Event facts and boundary", () => {
  it("contains only Type/Date/Participating squads/Configured matches, never Location", () => {
    const vm = buildEventsOperatingViewModel(
      [event({ id: "next", startsAt: new Date("2026-09-18T10:00:00Z") })],
      NOW,
    );
    expect(Object.keys(vm.featuredEvent!.facts).sort()).toEqual(
      ["configuredMatchCount", "dateLabel", "participatingSquadsCount", "typeLabel"].sort(),
    );
  });

  it("never includes EventMatch schedule entries or opponent names anywhere in the view model", () => {
    const vm = buildEventsOperatingViewModel(
      [
        event({
          id: "next",
          startsAt: new Date("2026-09-18T10:00:00Z"),
          eventMatches: [{ id: "m1", status: "SCHEDULED", supportAssignments: [] }],
        }),
      ],
      NOW,
    );
    const serialised = JSON.stringify(vm);
    expect(serialised).not.toContain("opponent");
    expect(serialised).not.toContain("m1");
  });
});

describe("buildEventsOperatingViewModel — Event Season ordering", () => {
  it("orders featured first, remaining upcoming ascending, then past descending", () => {
    const vm = buildEventsOperatingViewModel(
      [
        event({ id: "past-old", startsAt: new Date("2026-08-01T10:00:00Z") }),
        event({ id: "past-recent", startsAt: new Date("2026-09-05T10:00:00Z") }),
        event({ id: "featured", startsAt: new Date("2026-09-18T10:00:00Z") }),
        event({ id: "later-upcoming", startsAt: new Date("2026-09-25T10:00:00Z") }),
      ],
      NOW,
    );
    expect(vm.eventSeason.map((r) => r.eventId)).toEqual([
      "featured",
      "later-upcoming",
      "past-recent",
      "past-old",
    ]);
    expect(vm.eventSeason.find((r) => r.eventId === "featured")?.isFeatured).toBe(true);
    expect(vm.eventSeason.find((r) => r.eventId === "past-recent")?.actionLabel).toBe("View");
    expect(vm.eventSeason.find((r) => r.eventId === "later-upcoming")?.actionLabel).toBe("Open");
  });

  it("still lists the featured Event's own row exactly once in Event Season", () => {
    const vm = buildEventsOperatingViewModel(
      [event({ id: "featured", startsAt: new Date("2026-09-18T10:00:00Z") })],
      NOW,
    );
    expect(vm.eventSeason.filter((r) => r.eventId === "featured")).toHaveLength(1);
  });
});
