import { describe, it, expect } from "vitest";
import {
  buildPlayersOverviewRows,
  buildPlayersOverviewInspectorData,
  buildPlayersCurrentRoundRows,
  buildPlayersDevelopmentRows,
  type PlayerIdentityInput,
} from "../players-overview-production-adapter";
import type { PlayerSeasonOverviewRow, PlayerCurrentRoundAttentionRow, PlayerDevelopmentOverviewRow } from "@/lib/players/get-players-overview";
import type { TouchlinePositionMapEntry } from "@/components/touchline/pitch/touchline-position-map";

/**
 * Matchboard Players Operating Surface bundle (`06_EXACT_CODE_EXECUTION_PLAN.md` step 11): the
 * pure mapping from the canonical `get-players-overview.ts` query results, plus batched
 * effective-position map entries, to the Overview view-model row/inspector shapes.
 */
function makeIdentity(overrides: Partial<PlayerIdentityInput> = {}): PlayerIdentityInput {
  return {
    id: "p1",
    firstName: "Sander",
    lastName: "Berg",
    shirtNumber: 7,
    coreTeamKitColor: null,
    primaryPosition: "CM",
    currentAvailability: "AVAILABLE",
    ...overrides,
  };
}

function makeSeasonRow(overrides: Partial<PlayerSeasonOverviewRow> = {}): PlayerSeasonOverviewRow {
  return {
    playerId: "p1",
    displayName: "Sander Berg",
    coreTeam: { id: "t1", name: "U14 Lions" },
    actualAppearances: 10,
    goals: 2,
    assists: 1,
    coreAppearances: 8,
    supportAppearances: 2,
    developmentAppearances: 0,
    matchdayAdditions: 1,
    actualAdditionalAppearances: 0,
    plannedButAbsent: 0,
    finalisedUpcomingAppearances: 0,
    draftSelections: 0,
    squadRepairAppearances: 0,
    unavailableRoundCount: 0,
    dropsCount: 0,
    lastMovement: null,
    recentInvolvement: [],
    roundAssignments: [],
    ...overrides,
  };
}

function makeCurrentRoundRow(overrides: Partial<PlayerCurrentRoundAttentionRow> = {}): PlayerCurrentRoundAttentionRow {
  return {
    playerId: "p1",
    displayName: "Sander Berg",
    coreTeam: { id: "t1", name: "U14 Lions" },
    availability: "AVAILABLE",
    currentAssignment: null,
    integrityState: "COVERED",
    ...overrides,
  };
}

const CM_ENTRY: TouchlinePositionMapEntry = {
  positionCode: "CM",
  positionLabel: "Centre Midfield",
  rank: 1,
  supportBand: "STRONG",
  confidence: "HIGH",
};

describe("buildPlayersOverviewRows", () => {
  it("maps season overview fields through directly", () => {
    const [row] = buildPlayersOverviewRows([makeIdentity()], [makeSeasonRow()], []);
    expect(row.played).toBe(10);
    expect(row.goals).toBe(2);
    expect(row.assists).toBe(1);
    expect(row.core).toBe(8);
    expect(row.support).toBe(2);
    expect(row.matchdayAdditions).toBe(1);
  });

  it("prefers the effective profile's rank-1 position over the declared identity position", () => {
    const [row] = buildPlayersOverviewRows(
      [makeIdentity({ primaryPosition: "CB" })],
      [makeSeasonRow()],
      [],
      { p1: [CM_ENTRY] },
    );
    expect(row.currentPrimaryPositionCode).toBe("CM");
    expect(row.currentPrimaryPosition).toBe("CM");
  });

  it("falls back to the normalized declared position when no effective profile entry exists", () => {
    const [row] = buildPlayersOverviewRows([makeIdentity({ primaryPosition: "DEFENSIVE_MIDFIELDER" })], [makeSeasonRow()], []);
    expect(row.currentPrimaryPositionCode).toBe("DM");
    expect(row.currentPrimaryPosition).toBe("DM");
  });

  it("never renders a raw legacy identifier as the display label", () => {
    const [row] = buildPlayersOverviewRows([makeIdentity({ primaryPosition: "GOALKEEPER" })], [makeSeasonRow()], []);
    expect(row.currentPrimaryPosition).toBe("GK");
  });

  it("renders a broad declared position as a broad human label, not an upgraded exact code", () => {
    const [row] = buildPlayersOverviewRows([makeIdentity({ primaryPosition: "DEFENDER" })], [makeSeasonRow()], []);
    expect(row.currentPrimaryPosition).toBe("Defender");
  });

  it("resolves shirt number and kit colour from the identity input", () => {
    const [row] = buildPlayersOverviewRows(
      [makeIdentity({ shirtNumber: 9, coreTeamKitColor: "RED" })],
      [makeSeasonRow()],
      [],
    );
    expect(row.shirtNumber).toBe(9);
    expect(row.kitColor).toBe("#d5342c");
  });

  it("renders a null kit colour as null when no team colour is set", () => {
    const [row] = buildPlayersOverviewRows([makeIdentity({ coreTeamKitColor: null })], [makeSeasonRow()], []);
    expect(row.kitColor).toBeNull();
  });

  it("derives hasOpportunityThisWeek: true from a COVERED current-round integrity state", () => {
    const [row] = buildPlayersOverviewRows(
      [makeIdentity()],
      [makeSeasonRow()],
      [makeCurrentRoundRow({ integrityState: "COVERED" })],
    );
    expect(row.hasOpportunityThisWeek).toBe(true);
  });

  it("derives hasOpportunityThisWeek: false from a decision-required current-round integrity state", () => {
    const [row] = buildPlayersOverviewRows(
      [makeIdentity()],
      [makeSeasonRow()],
      [makeCurrentRoundRow({ integrityState: "DECISION_REQUIRED_NO_PLANNED_MATCH" })],
    );
    expect(row.hasOpportunityThisWeek).toBe(false);
  });

  it("derives hasOpportunityThisWeek: null when the player is not available this round", () => {
    const [row] = buildPlayersOverviewRows(
      [makeIdentity()],
      [makeSeasonRow()],
      [makeCurrentRoundRow({ integrityState: "NOT_AVAILABLE" })],
    );
    expect(row.hasOpportunityThisWeek).toBeNull();
  });

  it("derives hasOpportunityThisWeek: null when no current-round data exists at all", () => {
    const [row] = buildPlayersOverviewRows([makeIdentity()], [makeSeasonRow()], []);
    expect(row.hasOpportunityThisWeek).toBeNull();
  });

  it("marks attention true for a Blocked or Decision-required integrity state, never for Covered/Not-available", () => {
    const blocked = buildPlayersOverviewRows(
      [makeIdentity()],
      [makeSeasonRow()],
      [makeCurrentRoundRow({ integrityState: "BLOCKED_UNAVAILABLE_SELECTION" })],
    )[0];
    const covered = buildPlayersOverviewRows(
      [makeIdentity()],
      [makeSeasonRow()],
      [makeCurrentRoundRow({ integrityState: "COVERED" })],
    )[0];
    expect(blocked.attention).toBe(true);
    expect(covered.attention).toBe(false);
  });

  it("formats a known availability status into a readable label", () => {
    const [row] = buildPlayersOverviewRows([makeIdentity({ currentAvailability: "INJURED" })], [makeSeasonRow()], []);
    expect(row.availabilityLabel).toBe("Injured");
  });
});

describe("buildPlayersOverviewInspectorData", () => {
  it("renders the real passed effective-position map entries, never a hard-coded empty array", () => {
    const row = buildPlayersOverviewRows([makeIdentity()], [makeSeasonRow()], [], { p1: [CM_ENTRY] })[0];
    const data = buildPlayersOverviewInspectorData(row, [CM_ENTRY], null, (p) => p);
    expect(data.effectivePositions).toEqual([CM_ENTRY]);
  });

  it("renders an empty effectivePositions array honestly when no profile entries exist", () => {
    const row = buildPlayersOverviewRows([makeIdentity()], [makeSeasonRow()], [])[0];
    const data = buildPlayersOverviewInspectorData(row, [], null, (p) => p);
    expect(data.effectivePositions).toEqual([]);
  });

  it("builds the player detail href via the provided org-scoped href resolver", () => {
    const row = buildPlayersOverviewRows([makeIdentity()], [makeSeasonRow()], [])[0];
    const data = buildPlayersOverviewInspectorData(row, [], null, (p) => `/o/acme${p}`);
    expect(data.playerDetailHref).toBe("/o/acme/players/p1");
  });

  it("labels a null opportunity as unavailable this round", () => {
    const row = buildPlayersOverviewRows(
      [makeIdentity()],
      [makeSeasonRow()],
      [makeCurrentRoundRow({ integrityState: "NOT_AVAILABLE" })],
    )[0];
    const data = buildPlayersOverviewInspectorData(row, [], null, (p) => p);
    expect(data.opportunityLabel).toBe("Unavailable this round");
  });

  it("passes the active development focus through when present, null when absent", () => {
    const row = buildPlayersOverviewRows([makeIdentity()], [makeSeasonRow()], [])[0];
    const withFocus = buildPlayersOverviewInspectorData(row, [], "First-touch under pressure", (p) => p);
    const withoutFocus = buildPlayersOverviewInspectorData(row, [], null, (p) => p);
    expect(withFocus.activeDevelopmentFocus).toBe("First-touch under pressure");
    expect(withoutFocus.activeDevelopmentFocus).toBeNull();
  });

  it("carries the row's real season metrics through to the inspector", () => {
    const row = buildPlayersOverviewRows([makeIdentity()], [makeSeasonRow({ actualAppearances: 12, goals: 3 })], [])[0];
    const data = buildPlayersOverviewInspectorData(row, [], null, (p) => p);
    expect(data.played).toBe(12);
    expect(data.goals).toBe(3);
  });

  it("derives the full exact position label alongside the compact code", () => {
    const row = buildPlayersOverviewRows([makeIdentity({ primaryPosition: "CM" })], [makeSeasonRow()], [])[0];
    const data = buildPlayersOverviewInspectorData(row, [], null, (p) => p);
    expect(data.currentPrimaryPosition).toBe("CM");
    expect(data.currentPrimaryPositionFull).toBe("Centre Midfield");
  });

  it("is null when there is no primary position at all", () => {
    const row = buildPlayersOverviewRows([makeIdentity({ primaryPosition: null })], [makeSeasonRow()], [])[0];
    const data = buildPlayersOverviewInspectorData(row, [], null, (p) => p);
    expect(data.currentPrimaryPositionFull).toBeNull();
  });
});

describe("buildPlayersCurrentRoundRows", () => {
  it("maps availability, assignment, and attention state through", () => {
    const [row] = buildPlayersCurrentRoundRows(
      [makeIdentity()],
      [makeCurrentRoundRow({ currentAssignment: { matchId: "m1", teamName: "U14 Lions", opponent: "Riverside FC", role: "CORE" } })],
    );
    expect(row.availabilityLabel).toBe("Available");
    expect(row.currentAssignment).toEqual({ teamName: "U14 Lions", opponent: "Riverside FC", role: "CORE" });
    expect(row.attentionState).toBe("COVERED");
  });

  it("renders a null currentAssignment as null, not an empty object", () => {
    const [row] = buildPlayersCurrentRoundRows([makeIdentity()], [makeCurrentRoundRow({ currentAssignment: null })]);
    expect(row.currentAssignment).toBeNull();
  });
});

describe("buildPlayersDevelopmentRows", () => {
  it("passes the active development focus and start date through", () => {
    const startedAt = new Date("2026-08-01T00:00:00.000Z");
    const [row] = buildPlayersDevelopmentRows(
      [makeIdentity()],
      [{ playerId: "p1", displayName: "Sander Berg", coreTeam: null, activeDevelopmentFocus: "First-touch under pressure", focusStartedAt: startedAt } satisfies PlayerDevelopmentOverviewRow],
    );
    expect(row.activeDevelopmentFocus).toBe("First-touch under pressure");
    expect(row.focusStartedAt).toBe(startedAt.toISOString());
  });

  it("renders no active thread as null, not a fabricated placeholder", () => {
    const [row] = buildPlayersDevelopmentRows(
      [makeIdentity()],
      [{ playerId: "p1", displayName: "Sander Berg", coreTeam: null, activeDevelopmentFocus: null, focusStartedAt: null } satisfies PlayerDevelopmentOverviewRow],
    );
    expect(row.activeDevelopmentFocus).toBeNull();
    expect(row.focusStartedAt).toBeNull();
  });

  it("always leaves latestObservationSummary, effectivePositionSummary, and decisionReviewState null (deferred scope)", () => {
    const [row] = buildPlayersDevelopmentRows(
      [makeIdentity()],
      [{ playerId: "p1", displayName: "Sander Berg", coreTeam: null, activeDevelopmentFocus: "Focus", focusStartedAt: null } satisfies PlayerDevelopmentOverviewRow],
    );
    expect(row.latestObservationSummary).toBeNull();
    expect(row.effectivePositionSummary).toBeNull();
    expect(row.decisionReviewState).toBeNull();
  });
});
