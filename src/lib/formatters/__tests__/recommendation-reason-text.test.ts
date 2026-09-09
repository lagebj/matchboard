import { describe, it, expect } from "vitest";
import {
  CODE_TO_CATEGORY,
  buildReason,
  type ReasonCode,
} from "@/lib/explanations/recommendation-reason";
import { renderReason } from "@/lib/formatters/recommendation-reason-text";
import { DISALLOWED_FEEDBACK_TERMS } from "@/lib/coaching/types";

const ALL_CODES = Object.keys(CODE_TO_CATEGORY) as ReasonCode[];

// Neutral-language + no-ranking guardrails (F6 / PRINCIPLES.md #8). Kept local to the one prose
// owner rather than widened into `check-terminology.mjs` (whose bare-word bans would
// false-positive across unrelated code).
const BANNED_SUBSTRINGS = [
  ...DISALLOWED_FEEDBACK_TERMS,
  "weak",
  "poor",
  "bad ",
  "better player",
  "worse",
  "strongest",
  "best xi",
  "rank",
  "score of",
  "weighted",
  "points",
];

describe("renderReason — the one prose owner for RecommendationReason (C6)", () => {
  it("renders every ReasonCode to non-empty neutral text", () => {
    for (const code of ALL_CODES) {
      const text = renderReason(buildReason(code, { params: { minutesBehind: 6, tier: "NATURAL", matchCount: 3, minutesTogether: 200, occurrences: 4 }, confidence: "ESTABLISHED" }));
      expect(text, code).toBeTruthy();
      expect(text.length, code).toBeGreaterThan(3);
      const lower = text.toLowerCase();
      for (const banned of BANNED_SUBSTRINGS) {
        expect(lower.includes(banned.toLowerCase()), `${code}: "${text}" contains banned "${banned}"`).toBe(false);
      }
    }
  });

  it("never emits a raw score/weight/delta — only counts, minutes, tiers from params", () => {
    // A reason with a `score`-shaped param must not leak it into prose.
    const text = renderReason(
      buildReason("FAIRNESS_UNDER_SHARE", { params: { minutesBehind: 6, score: 42, weight: 3.5, delta: -9 } }),
    );
    expect(text).not.toMatch(/42|3\.5|-9/);
    expect(text).toMatch(/6 minute/);
  });

  it("snapshot of the canonical rendering for every code (stable coach-facing text)", () => {
    const rendered = Object.fromEntries(
      ALL_CODES.map((code) => [
        code,
        renderReason(
          buildReason(code, {
            params: { minutesBehind: 6, tier: "NATURAL", matchCount: 3, minutesTogether: 200, occurrences: 4 },
            confidence: "EMERGING",
          }),
        ),
      ]),
    );
    expect(rendered).toMatchSnapshot();
  });

  it("category is always derivable from code", () => {
    for (const code of ALL_CODES) {
      expect(buildReason(code).category).toBe(CODE_TO_CATEGORY[code]);
    }
  });
});
