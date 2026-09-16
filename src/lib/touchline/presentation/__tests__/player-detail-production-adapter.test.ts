import { describe, it, expect } from "vitest";
import {
  buildIdentityInput,
  buildOverviewInput,
  buildMatchesInput,
  buildDevelopmentInput,
  buildEvidenceStories,
} from "../player-detail-production-adapter";
import { buildPositionMapEntries } from "../player-position-map-adapter";
import { buildPlayerIdentityViewModel } from "../player-identity-view-model";
import type { EffectivePlayerPositionProfile } from "@/lib/player-development/effective-position-profile";
import type { PlayerMatchHistoryEntry } from "@/lib/players/get-player-match-history";
import type { PlayerRecentOpportunity } from "@/lib/players/get-player-recent-opportunity";

/**
 * Atlas Follow-up Phase F8 (Player Detail production migration, `04_PLAYER_DETAIL_CONTRACT.md`):
 * the pure mapping from canonical query results to the Phase F4 (Hard Human Gate B approved)
 * view-model input shapes.
 */

function makeProfile(overrides: Partial<EffectivePlayerPositionProfile> = {}): EffectivePlayerPositionProfile {
  return {
    primary: "LW",
    secondary: "LM",
    tertiary: null,
    positions: [
      {
        positionId: "LW",
        rank: 1,
        supportBand: "STRONGEST",
        confidence: "HIGH",
        sources: { coachDeclared: true, appearances: 6, minutes: 180, recentAppearances: 6, lastPlayedAt: new Date(), observations: 0 },
      },
      {
        positionId: "LM",
        rank: 2,
        supportBand: "STRONG",
        confidence: "MEDIUM",
        sources: { coachDeclared: true, appearances: 3, minutes: 90, recentAppearances: 3, lastPlayedAt: new Date(), observations: 0 },
      },
    ],
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeHistoryEntry(overrides: Partial<PlayerMatchHistoryEntry> = {}): PlayerMatchHistoryEntry {
  return {
    matchKey: "m1",
    source: "LEAGUE_MATCH",
    playedAt: new Date("2026-09-12T10:00:00Z"),
    opponentOrEventName: "Slemmestad Rød",
    minutes: 40,
    actualPositions: ["CM"],
    goals: 1,
    assists: 0,
    plannedRole: "CORE",
    startedAtKickoff: true,
    eventId: null,
    ...overrides,
  };
}

describe("buildIdentityInput", () => {
  it("maps the canonical player + effective profile to the identity view-model input", () => {
    const identity = buildPlayerIdentityViewModel(
      buildIdentityInput(
        {
          playerId: "p1",
          firstName: "Noah",
          lastName: "Larsen",
          shirtNumber: 10,
          currentAvailability: "AVAILABLE",
          coreTeamName: "Graabein United",
          coreTeamKitColor: "RED",
          groupLabel: "G2015",
        },
        makeProfile(),
      ),
    );
    expect(identity.displayName).toBe("Noah Larsen");
    expect(identity.currentPrimaryPosition).toBe("Left Wing");
    expect(identity.secondaryPositions).toEqual(["Left Midfield"]);
    expect(identity.availabilityLabel).toBe("Available");
    expect(identity.availabilityTone).toBe("positive");
    expect(identity.kitColor).toBe("#d5342c");
  });

  it("uses neutral shirt and attention tone for injured players with no kit colour", () => {
    const identity = buildIdentityInput(
      {
        playerId: "p1",
        firstName: "Noah",
        lastName: null,
        shirtNumber: null,
        currentAvailability: "INJURED",
        coreTeamName: null,
        coreTeamKitColor: null,
        groupLabel: null,
      },
      makeProfile(),
    );
    expect(identity.kitColor).toBeNull();
    expect(identity.availabilityTone).toBe("attention");
    expect(identity.availabilityLabel).toBe("Injured");
  });
});

describe("buildPositionMapEntries", () => {
  it("maps each supported position to a labelled map entry", () => {
    const entries = buildPositionMapEntries(makeProfile());
    expect(entries).toEqual([
      { positionCode: "LW", positionLabel: "Left Wing", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" },
      { positionCode: "LM", positionLabel: "Left Midfield", rank: 2, supportBand: "STRONG", confidence: "MEDIUM" },
    ]);
  });
});

describe("buildOverviewInput", () => {
  it("derives minutes and starts from the match-history window, never fabricating", () => {
    const input = buildOverviewInput({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 11, goals: 2, assists: 4, plannedButAbsent: 0 },
      recentOpportunity: null,
      profile: makeProfile(),
      activeFocus: { id: "dt1", focus: "Direct play", category: null },
      latestObservation: null,
      matchHistory: [
        makeHistoryEntry(),
        makeHistoryEntry({ matchKey: "m2", minutes: 20, startedAtKickoff: false, goals: 0, plannedRole: null }),
      ],
    });
    expect(input.participation).toEqual({ matches: 11, minutes: 60, starts: 1, goals: 2, assists: 4 });
    expect(input.recentMatches).toHaveLength(2);
    expect(input.recentMatches[0]).toMatchObject({ matchId: "m1", opponent: "Slemmestad Rød", role: "Core", goals: 1 });
    expect(input.recentMatches[1].role).toBeNull();
    expect(input.activeDevelopmentFocus?.href).toBe("/o/test-club/players/p1?tab=development");
  });
});

describe("buildMatchesInput", () => {
  it("maps history entries to match rows with league hrefs and planned context", () => {
    const input = buildMatchesInput({
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 2, goals: 1, assists: 1, plannedButAbsent: 0 },
      matchHistory: [
        makeHistoryEntry(),
        makeHistoryEntry({ matchKey: "e1", source: "EVENT_MATCH", eventId: "ev1", plannedRole: null }),
      ],
    });
    expect(input.matches[0].href).toBe("/o/test-club/matches/m1");
    expect(input.matches[0].context).toBe("CORE");
    expect(input.matches[1].href).toBe("/o/test-club/events/ev1");
    expect(input.matches[1].context).toBeNull();
    expect(input.seasonSummary.minutes).toBe(80);
  });
});

describe("buildDevelopmentInput", () => {
  it("maps the active thread, observations, and completed focus history", () => {
    const input = buildDevelopmentInput({
      playerId: "p1",
      activeThread: {
        id: "dt1",
        focus: "Direct play",
        category: "positional_discipline",
        rationale: "Pace on the left",
        startedAt: new Date("2026-08-18T00:00:00Z"),
        reviewState: "PENDING",
        reviewDueAt: new Date("2026-09-29T00:00:00Z"),
        observationCount: 3,
      },
      observations: [{ id: "o1", note: "Created danger on the left", createdAt: new Date("2026-09-07T00:00:00Z"), matchLabel: "vs Graabein United" }],
      completedFocusHistory: [
        { id: "dt0", focus: "Reset after ball loss", category: null, startedAt: new Date("2026-06-03T00:00:00Z"), completedAt: new Date("2026-08-15T00:00:00Z") },
      ],
    });
    expect(input.activeFocus?.observationCount).toBe(3);
    expect(input.activeFocus?.reviewState).toBe("PENDING");
    expect(input.observationTimeline[0].matchLabel).toBe("vs Graabein United");
    expect(input.completedFocusHistory[0].focus).toBe("Reset after ball loss");
  });
});

describe("buildEvidenceStories", () => {
  const opportunity: PlayerRecentOpportunity = {
    perRound: [
      { roundLabel: "W32", hadOpportunity: true },
      { roundLabel: "W33", hadOpportunity: false },
    ],
    recentCount: 1,
    recentTotal: 2,
    previousCount: null,
    previousTotal: null,
  };

  it("builds an Opportunity story with honest confidence for a thin sample", () => {
    const stories = buildEvidenceStories({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 2, goals: 0, assists: 0, plannedButAbsent: 0 },
      recentOpportunity: opportunity,
      profile: makeProfile(),
      matchHistory: [makeHistoryEntry()],
    });
    const opportunityStory = stories.find((s) => s.id === "opportunity-recent")!;
    expect(opportunityStory.group).toBe("OPPORTUNITY");
    expect(opportunityStory.confidence).toBeNull(); // 2 rounds < 3-round Emerging threshold
    expect(opportunityStory.sparkline).toEqual([100, 0]);
    expect(opportunityStory.detailHref).toBe("/o/test-club/insights/player-pathways");
  });

  it("renders the Position story's insufficient-evidence state cleanly when no support exists", () => {
    const stories = buildEvidenceStories({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 0, goals: 0, assists: 0, plannedButAbsent: 0 },
      recentOpportunity: null,
      profile: makeProfile({ positions: [], primary: "", secondary: null, tertiary: null }),
      matchHistory: [],
    });
    const positionStory = stories.find((s) => s.id === "position-concentration")!;
    expect(positionStory.confidence).toBeNull();
    expect(positionStory.title).toBe("No position evidence recorded yet");
  });

  it("never invents a match-phase pattern story for per-player phase data", () => {
    const stories = buildEvidenceStories({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 0, goals: 0, assists: 0, plannedButAbsent: 0 },
      recentOpportunity: null,
      profile: makeProfile(),
      matchHistory: [],
    });
    const phaseStory = stories.find((s) => s.id === "match-context-phase")!;
    expect(phaseStory.confidence).toBeNull();
    expect(phaseStory.title).toContain("Not enough evidence");
  });
});