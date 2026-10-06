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
import type { PlayerTrendStory } from "@/lib/development-context/get-player-trend-stories";

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

  it("omits currentStory when no material evidence exists (ADR-0157 C5)", () => {
    const input = buildOverviewInput({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 0, goals: 0, assists: 0, plannedButAbsent: 0 },
      recentOpportunity: null,
      profile: makeProfile(),
      activeFocus: null,
      latestObservation: null,
      matchHistory: [],
    });
    expect(input.currentStory).toBeNull();
  });

  it("surfaces a material trend as currentStory, taking priority over every other source", () => {
    const trend: PlayerTrendStory = {
      kind: "TREND",
      metricKey: "role_seconds",
      metricPriority: 0,
      dimensions: { position: "CM" },
      dimensionLabel: "Central Midfield exposure",
      direction: "UP",
      materialityRatio: 2,
      sampleWindow: { previousMatches: 3, latestMatches: 3 },
      rateContext: null,
      headline: "Central Midfield exposure has increased across the latest eligible window (previous 3 matches vs. latest 3 matches).",
      sourceRefs: [],
    };
    const input = buildOverviewInput({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 0, goals: 0, assists: 0, plannedButAbsent: 0 },
      recentOpportunity: { perRound: [], recentCount: 5, recentTotal: 5, previousCount: null, previousTotal: null },
      profile: makeProfile(),
      activeFocus: null,
      latestObservation: null,
      matchHistory: [],
      trendStories: [trend],
    });
    expect(input.currentStory).toEqual({ text: trend.headline, source: "TREND" });
  });

  it("surfaces a still-current position-evolution change when its declared primary still matches today's record", () => {
    const now = new Date("2026-10-06T00:00:00Z");
    const input = buildOverviewInput({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 0, goals: 0, assists: 0, plannedButAbsent: 0 },
      recentOpportunity: null,
      profile: makeProfile(),
      activeFocus: null,
      latestObservation: null,
      matchHistory: [],
      now,
      currentDeclaredPrimaryPosition: "CDM",
      positionEvolutionRecord: {
        beforeSnapshot: { primary: "CM", secondary: null, tertiary: null },
        afterSnapshot: { primary: "CDM", secondary: null, tertiary: null },
        createdAt: new Date("2026-09-20T00:00:00Z"), // 16 days before `now` -- within the window.
      },
    });
    expect(input.currentStory?.source).toBe("POSITION_EVOLUTION");
    expect(input.currentStory?.text).toContain("Centre Defensive Midfield");
    expect(input.currentStory?.text).toContain("previously Central Midfield");
  });

  it("never states a position-evolution change that is stale (older than the current-story window)", () => {
    const now = new Date("2026-10-06T00:00:00Z");
    const input = buildOverviewInput({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 0, goals: 0, assists: 0, plannedButAbsent: 0 },
      recentOpportunity: null,
      profile: makeProfile(),
      activeFocus: null,
      latestObservation: null,
      matchHistory: [],
      now,
      currentDeclaredPrimaryPosition: "CDM",
      positionEvolutionRecord: {
        beforeSnapshot: { primary: "CM", secondary: null, tertiary: null },
        afterSnapshot: { primary: "CDM", secondary: null, tertiary: null },
        createdAt: new Date("2026-01-01T00:00:00Z"), // far outside the window.
      },
    });
    expect(input.currentStory).toBeNull();
  });

  it("never states a position-evolution change that has since been superseded by a later declaration", () => {
    const now = new Date("2026-10-06T00:00:00Z");
    const input = buildOverviewInput({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 0, goals: 0, assists: 0, plannedButAbsent: 0 },
      recentOpportunity: null,
      profile: makeProfile(),
      activeFocus: null,
      latestObservation: null,
      matchHistory: [],
      now,
      // The record says CDM, but the live declared primary is now something else entirely --
      // a later manual or automatic change superseded it; never state the stale fact as current.
      currentDeclaredPrimaryPosition: "CM",
      positionEvolutionRecord: {
        beforeSnapshot: { primary: "CM", secondary: null, tertiary: null },
        afterSnapshot: { primary: "CDM", secondary: null, tertiary: null },
        createdAt: new Date("2026-09-20T00:00:00Z"),
      },
    });
    expect(input.currentStory).toBeNull();
  });

  it("surfaces a development focus with a recent supporting observation as currentStory", () => {
    const now = new Date("2026-10-06T00:00:00Z");
    const input = buildOverviewInput({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 0, goals: 0, assists: 0, plannedButAbsent: 0 },
      recentOpportunity: null,
      profile: makeProfile(),
      activeFocus: { id: "dt1", focus: "Direct play", category: null },
      latestObservation: null,
      matchHistory: [],
      now,
      activeFocusLatestObservationAt: new Date("2026-09-28T00:00:00Z"), // 8 days before `now`.
    });
    expect(input.currentStory?.source).toBe("DEVELOPMENT_FOCUS");
    expect(input.currentStory?.text).toContain("Direct play");
  });

  it("surfaces a consistent recent opportunity pattern as currentStory when nothing else qualifies", () => {
    const input = buildOverviewInput({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 0, goals: 0, assists: 0, plannedButAbsent: 0 },
      recentOpportunity: { perRound: [], recentCount: 5, recentTotal: 5, previousCount: null, previousTotal: null },
      profile: makeProfile(),
      activeFocus: null,
      latestObservation: null,
      matchHistory: [],
    });
    expect(input.currentStory).toEqual({ text: "Recent opportunities have been consistent: 5 of 5 eligible rounds.", source: "OPPORTUNITY" });
  });

  it("stays fully useful with every ADR-0157 C5 field omitted (Overview works with AI disabled and no new evidence)", () => {
    const input = buildOverviewInput({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 11, goals: 2, assists: 4, plannedButAbsent: 0 },
      recentOpportunity: null,
      profile: makeProfile(),
      activeFocus: { id: "dt1", focus: "Direct play", category: null },
      latestObservation: null,
      matchHistory: [makeHistoryEntry()],
    });
    expect(input.participation.matches).toBe(11);
    expect(input.effectivePositions.length).toBeGreaterThan(0);
    expect(input.activeDevelopmentFocus?.focus).toBe("Direct play");
    expect(input.currentStory).toBeNull();
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
      developmentContext: null,
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
      developmentContext: null,
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
      developmentContext: null,
    });
    const phaseStory = stories.find((s) => s.id === "match-context-phase")!;
    expect(phaseStory.confidence).toBeNull();
    expect(phaseStory.title).toContain("Not enough evidence");
  });

  it("renders the game-state story's insufficient-evidence state when there is no development context yet (ADR-0155)", () => {
    const stories = buildEvidenceStories({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 0, goals: 0, assists: 0, plannedButAbsent: 0 },
      recentOpportunity: null,
      profile: makeProfile(),
      matchHistory: [],
      developmentContext: null,
    });
    const story = stories.find((s) => s.id === "development-context-game-state")!;
    expect(story.confidence).toBeNull();
    expect(story.value).toBeUndefined();
    expect(story.title).toBe("No recorded role time with a known game state yet");
  });

  it("surfaces the dominant game state without redistributing UNKNOWN time (ADR-0155)", () => {
    const stories = buildEvidenceStories({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 6, goals: 0, assists: 0, plannedButAbsent: 0 },
      recentOpportunity: null,
      profile: makeProfile(),
      matchHistory: [],
      developmentContext: {
        totalRoleSeconds: 1800,
        matchesWithRoleData: 6,
        gameStateBreakdown: [
          { gameState: "DRAWING", seconds: 1200 },
          { gameState: "LEADING", seconds: 300 },
          { gameState: "UNKNOWN", seconds: 300 },
        ],
        topCoPresencePartner: null,
      },
    });
    const story = stories.find((s) => s.id === "development-context-game-state")!;
    expect(story.title).toBe("Most recorded minutes came while DRAWING");
    expect(story.value).toBe("20 min");
    expect(story.confidence).toBe("Established");
    expect(story.interpretation).toContain("5 min LEADING");
    expect(story.interpretation).toContain("5 min recorded with an unknown game state");
    expect(story.interpretation).toContain("never redistributed");
  });

  it("renders the co-presence story's insufficient-evidence state when no teammate pairing exists (ADR-0155)", () => {
    const stories = buildEvidenceStories({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 0, goals: 0, assists: 0, plannedButAbsent: 0 },
      recentOpportunity: null,
      profile: makeProfile(),
      matchHistory: [],
      developmentContext: null,
    });
    const story = stories.find((s) => s.id === "development-context-copresence")!;
    expect(story.confidence).toBeNull();
    expect(story.title).toBe("No shared on-pitch time recorded yet");
  });

  it("surfaces the top co-presence partner as exposure only, never a chemistry score (ADR-0155)", () => {
    const stories = buildEvidenceStories({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 3, goals: 0, assists: 0, plannedButAbsent: 0 },
      recentOpportunity: null,
      profile: makeProfile(),
      matchHistory: [],
      developmentContext: {
        totalRoleSeconds: 900,
        matchesWithRoleData: 3,
        gameStateBreakdown: [],
        topCoPresencePartner: { teammateId: "p2", teammateName: "Jamie Teammate", sharedSeconds: 600 },
      },
    });
    const story = stories.find((s) => s.id === "development-context-copresence")!;
    expect(story.title).toBe("Most shared time with Jamie Teammate");
    expect(story.value).toBe("10 min");
    expect(story.confidence).toBe("Emerging");
    expect(story.interpretation).toContain("not a chemistry");
  });

  it("renders a TREND group story using the persisted direction verbatim, never recomputed (ADR-0157 C5)", () => {
    const trend: PlayerTrendStory = {
      kind: "TREND",
      metricKey: "role_seconds",
      metricPriority: 0,
      dimensions: { position: "CM" },
      dimensionLabel: "Central Midfield exposure",
      direction: "DOWN",
      materialityRatio: 1.5,
      sampleWindow: { previousMatches: 3, latestMatches: 3 },
      rateContext: null,
      headline: "Central Midfield exposure has decreased across the latest eligible window (previous 3 matches vs. latest 3 matches).",
      sourceRefs: [],
    };
    const stories = buildEvidenceStories({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 0, goals: 0, assists: 0, plannedButAbsent: 0 },
      recentOpportunity: null,
      profile: makeProfile(),
      matchHistory: [],
      developmentContext: null,
      trendStories: [trend],
    });
    const trendStory = stories.find((s) => s.group === "TREND")!;
    expect(trendStory.title).toBe("Central Midfield exposure");
    expect(trendStory.value).toBe("Decreasing");
    expect(trendStory.confidence).toBe("Established");
    expect(trendStory.interpretation).toBe(trend.headline);
  });

  it("renders the NOT_ENOUGH_EVIDENCE trend state with null confidence, never a fabricated zero/stable value", () => {
    const stories = buildEvidenceStories({
      playerId: "p1",
      orgSlug: "test-club",
      seasonStats: { actualAppearances: 0, goals: 0, assists: 0, plannedButAbsent: 0 },
      recentOpportunity: null,
      profile: makeProfile(),
      matchHistory: [],
      developmentContext: null,
      trendStories: [
        {
          kind: "NOT_ENOUGH_EVIDENCE",
          metricKey: "role_seconds",
          dimensions: { position: "RW" },
          dimensionLabel: "Right Wing exposure",
          eligibleSampleCount: 3,
          neededSampleCount: 6,
          headline: "Not enough eligible matches yet to show a right wing exposure trend (3 of 6 eligible matches recorded).",
        },
      ],
    });
    const trendStory = stories.find((s) => s.group === "TREND")!;
    expect(trendStory.confidence).toBeNull();
    expect(trendStory.value).toBeUndefined();
    expect(trendStory.title).toContain("Not enough evidence");
  });
});