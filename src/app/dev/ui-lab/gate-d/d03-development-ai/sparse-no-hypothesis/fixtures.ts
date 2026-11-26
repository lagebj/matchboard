import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import { buildPlayerDevelopmentViewModel, type PlayerDevelopmentViewModelInput } from "@/lib/touchline/presentation/player-development-view-model";

/**
 * Gate D Wave 2 — D03, sparse longitudinal evidence (register D03's own acceptance question:
 * "Assistant Coach cannot pad findings"). Leah Nilsen has one recorded match appearance since
 * joining the squad — one observation, no derived trend (trends require 6 eligible matches), and
 * no Assistant Coach hypothesis exists for her (an empty array, exactly mirroring production's
 * real `getPlayerAssistantCoachHypotheses()` return when no `ACTIVE` row exists). The page must
 * not compensate with generic advice or a fabricated "insufficient data" headline dressed up as a
 * finding.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W2-D03-SPARSE",
  fixtureId: "gate-d-w2-d03-sparse-no-hypothesis",
  fixtureVersion: 1,
  fixtureSha256: "fe82ba1b27ec7df520781af6f6e933df7a88b9d140a6be6790f2f689b88cbf21",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-10-12T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const developmentInput: PlayerDevelopmentViewModelInput = buildPlayerDevelopmentViewModel({
  activeFocus: {
    id: "thread-leah-first-impressions",
    focus: "Settling into the squad's defensive shape",
    category: "Tactical",
    rationale: "Thread opened after Leah's first appearance — too early to draw a conclusion, kept open to collect evidence.",
    startedAt: "11 Oct 2026",
    reviewState: null,
    reviewDueAt: null,
    observationCount: 1,
  },
  observationTimeline: [
    {
      id: "obs-leah-w1",
      note: "First match involvement — tracked back once but was generally positional. Too early to read anything into one appearance.",
      createdAt: "11 Oct 2026",
      matchLabel: "vs Grorud",
    },
  ],
  positionalContextNotes: [],
  completedFocusHistory: [],
});

/** Mirrors `getPlayerAssistantCoachHypotheses()`'s real return shape when no ACTIVE hypothesis
 * exists for this player — an empty array, not a fabricated placeholder entry. */
export const hypotheses: never[] = [];

export const noHypothesisState = {
  coachQuestion: "What does the available evidence tell us about Leah's development so far?",
  insufficiencySummary:
    "Only 1 recorded match appearance since Leah joined the squad — not enough independent observations to support any directional claim, and no derived trend exists yet (trends require 6 eligible matches).",
  availableFacts: [
    "1 recorded appearance (11 Oct 2026 vs Grorud)",
    "1 coach observation, not yet forming a pattern",
    "Declared position: Right Winger — not yet evidence-tested",
  ],
};

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W2-D03-SPARSE", developmentInput, hypotheses, noHypothesisState };
