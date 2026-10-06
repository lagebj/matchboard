import { describe, it, expect } from "vitest";
import { selectPlayerCurrentStory, type PlayerCurrentStory, type PlayerCurrentStoryInput } from "../player-current-story";
import type { PlayerTrendStory } from "@/lib/development-context/get-player-trend-stories";
import { DISALLOWED_FEEDBACK_TERMS } from "@/lib/coaching/types";

/**
 * `selectPlayerCurrentStory()` (ADR-0157 slice C5). Pure, no DB — exercises the four-priority
 * selection order and the "omit entirely" fallback directly against the function's own inputs.
 */

// Neutral-language + no-ranking guardrails (mirrors `recommendation-reason-text.test.ts`'s own
// local list — kept local here too rather than widened into `check-terminology.mjs`, whose
// bare-word bans would false-positive across unrelated code).
const BANNED_SUBSTRINGS = [...DISALLOWED_FEEDBACK_TERMS, "weak", "poor", "bad ", "better player", "worse", "strongest", "best xi", "rank", "score of"];

function expectNeutralLanguage(text: string) {
  const lower = text.toLowerCase();
  for (const banned of BANNED_SUBSTRINGS) {
    expect(lower.includes(banned.toLowerCase()), `"${text}" contains banned "${banned}"`).toBe(false);
  }
}

function makeTrendStory(overrides: Partial<Extract<PlayerTrendStory, { kind: "TREND" }>> = {}): Extract<PlayerTrendStory, { kind: "TREND" }> {
  return {
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
    ...overrides,
  };
}

const emptyInput: PlayerCurrentStoryInput = {
  trendStories: [],
  positionEvolution: null,
  activeDevelopmentFocus: null,
  recentOpportunity: null,
};

describe("selectPlayerCurrentStory", () => {
  it("returns null when no material evidence exists (every priority empty)", () => {
    expect(selectPlayerCurrentStory(emptyInput)).toBeNull();
  });

  it("returns null when the only trend data is STABLE (never a fabricated headline from a non-material trend)", () => {
    const result = selectPlayerCurrentStory({
      ...emptyInput,
      trendStories: [makeTrendStory({ direction: "STABLE" })],
    });
    expect(result).toBeNull();
  });

  it("returns null when the only trend data is a NOT_ENOUGH_EVIDENCE entry", () => {
    const notEnough: PlayerTrendStory = {
      kind: "NOT_ENOUGH_EVIDENCE",
      metricKey: "role_seconds",
      dimensions: { position: "CM" },
      dimensionLabel: "Central Midfield exposure",
      eligibleSampleCount: 3,
      neededSampleCount: 6,
      headline: "Not enough eligible matches yet to show a central midfield exposure trend (3 of 6 eligible matches recorded).",
    };
    expect(selectPlayerCurrentStory({ ...emptyInput, trendStories: [notEnough] })).toBeNull();
  });

  it("priority 1: picks a material trend over every other source, using the persisted headline verbatim", () => {
    const trend = makeTrendStory();
    const result = selectPlayerCurrentStory({
      trendStories: [trend],
      positionEvolution: { newPrimaryLabel: "Striker", previousPrimaryLabel: "Winger" },
      activeDevelopmentFocus: { focus: "Direct play", hasRecentSupportingObservation: true },
      recentOpportunity: { perRound: [], recentCount: 5, recentTotal: 5, previousCount: null, previousTotal: null },
    });
    expect(result).toEqual({ text: trend.headline, source: "TREND" });
  });

  it("prefers role_seconds over teammate co-presence when both are material", () => {
    const roleTrend = makeTrendStory({ metricKey: "role_seconds", headline: "role headline" });
    const copresenceTrend = makeTrendStory({
      metricKey: "teammate_copresence_seconds",
      dimensionLabel: "Shared pitch time with Jamie",
      headline: "copresence headline",
      materialityRatio: 10, // deliberately larger -- priority order still wins over magnitude.
    });
    const result = selectPlayerCurrentStory({ ...emptyInput, trendStories: [copresenceTrend, roleTrend] });
    expect(result).toEqual({ text: "role headline", source: "TREND" });
  });

  it("priority 2: a still-current position-evolution change wins when no material trend exists", () => {
    const result = selectPlayerCurrentStory({
      ...emptyInput,
      positionEvolution: { newPrimaryLabel: "Striker", previousPrimaryLabel: "Winger" },
      activeDevelopmentFocus: { focus: "Direct play", hasRecentSupportingObservation: true },
      recentOpportunity: { perRound: [], recentCount: 5, recentTotal: 5, previousCount: null, previousTotal: null },
    });
    expect(result?.source).toBe("POSITION_EVOLUTION");
    expect(result?.text).toContain("Striker");
    expect(result?.text).toContain("previously Winger");
  });

  it("priority 2 without a previous label omits the parenthetical", () => {
    const result = selectPlayerCurrentStory({ ...emptyInput, positionEvolution: { newPrimaryLabel: "Striker", previousPrimaryLabel: null } });
    expect(result?.text).toBe("Recorded primary position updated to Striker based on recent match evidence.");
  });

  it("priority 3: an active focus with a recent supporting observation wins over opportunity alone", () => {
    const result = selectPlayerCurrentStory({
      ...emptyInput,
      activeDevelopmentFocus: { focus: "Direct play", hasRecentSupportingObservation: true },
      recentOpportunity: { perRound: [], recentCount: 5, recentTotal: 5, previousCount: null, previousTotal: null },
    });
    expect(result?.source).toBe("DEVELOPMENT_FOCUS");
    expect(result?.text).toContain("Direct play");
  });

  it("priority 3 does not qualify without a recent supporting observation", () => {
    const result = selectPlayerCurrentStory({
      ...emptyInput,
      activeDevelopmentFocus: { focus: "Direct play", hasRecentSupportingObservation: false },
      recentOpportunity: { perRound: [], recentCount: 5, recentTotal: 5, previousCount: null, previousTotal: null },
    });
    expect(result?.source).toBe("OPPORTUNITY");
  });

  it("priority 4: a full recent opportunity streak is stated plainly", () => {
    const result = selectPlayerCurrentStory({
      ...emptyInput,
      recentOpportunity: { perRound: [], recentCount: 5, recentTotal: 5, previousCount: null, previousTotal: null },
    });
    expect(result).toEqual({ text: "Recent opportunities have been consistent: 5 of 5 eligible rounds.", source: "OPPORTUNITY" });
  });

  it("priority 4: a complete recent opportunity gap is stated plainly", () => {
    const result = selectPlayerCurrentStory({
      ...emptyInput,
      recentOpportunity: { perRound: [], recentCount: 0, recentTotal: 4, previousCount: null, previousTotal: null },
    });
    expect(result).toEqual({ text: "No planned opportunity in the last 4 eligible rounds.", source: "OPPORTUNITY" });
  });

  it("priority 4 does not fire on an unremarkable partial ratio or a too-thin sample", () => {
    expect(
      selectPlayerCurrentStory({ ...emptyInput, recentOpportunity: { perRound: [], recentCount: 3, recentTotal: 5, previousCount: null, previousTotal: null } }),
    ).toBeNull();
    expect(
      selectPlayerCurrentStory({ ...emptyInput, recentOpportunity: { perRound: [], recentCount: 2, recentTotal: 2, previousCount: null, previousTotal: null } }),
    ).toBeNull();
  });

  it("never produces player-ranking or comparative-value language across every priority branch", () => {
    const scenarios: (PlayerCurrentStory | null)[] = [
      selectPlayerCurrentStory({ ...emptyInput, trendStories: [makeTrendStory({ direction: "DOWN" })] }),
      selectPlayerCurrentStory({ ...emptyInput, positionEvolution: { newPrimaryLabel: "Striker", previousPrimaryLabel: "Winger" } }),
      selectPlayerCurrentStory({ ...emptyInput, activeDevelopmentFocus: { focus: "Direct play", hasRecentSupportingObservation: true } }),
      selectPlayerCurrentStory({ ...emptyInput, recentOpportunity: { perRound: [], recentCount: 5, recentTotal: 5, previousCount: null, previousTotal: null } }),
    ];
    for (const story of scenarios) {
      expect(story).not.toBeNull();
      expectNeutralLanguage(story!.text);
    }
  });
});
