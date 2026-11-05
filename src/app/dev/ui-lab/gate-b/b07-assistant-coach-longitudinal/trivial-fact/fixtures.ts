import type { FixtureIdentity } from "../../../gate-a/shared/fixture-identity";
import { b07TrivialMatchIdentity, b07TrivialTimeline, B07_TRIVIAL_KICKOFF_AT } from "../../shared/match-b-fixture";
import type { CompletedMatchAdvisorViewModel } from "@/lib/ai/presentation/completed-match-advisor";

/**
 * B07-B "Trivial fact" (official Gate B register row B07): a clearly recorded hat-trick, shown
 * correctly in the factual Match story below, with no Assistant Coach content repackaging it as
 * a longitudinal "discovery."
 *
 * W4-R8 (independent-review remediation): the prior revision constructed
 * `{status: "fresh", insights: [], clarification: null, suggestions: []}` by hand. Tracing
 * `getCompletedMatchAdvisorViewModel()` (`src/lib/ai/presentation/completed-match-advisor.ts:149`)
 * shows that combination is production-unreachable: `buildViewModel()` (the only code path that
 * can ever produce a `"fresh"`/`"stale"` status) only runs when a `SUCCEEDED` review's
 * `insights.length > 0` (line 174) — and whenever that gate passes, at least one of
 * `sectionableInsights`/`clarificationInsight`/`suggestionInsights` is non-empty by construction,
 * so a `"fresh"` result with ALL THREE empty can never come out of that function. When a
 * succeeded review genuinely has zero active insights (every one dismissed, or the model recorded
 * none), the `review.insights.length > 0` gate fails, the function falls through to the job-status
 * check (QUEUED/RUNNING -> `"reviewing"`, FAILED -> `"unavailable"`), and since there is no
 * pending/failed job for an already-succeeded review, it returns `null` — exactly the same `null`
 * production already returns when AI is disabled, has no connection, or the report isn't LOCKED
 * yet. `null` is therefore the one real, reachable state for "nothing to show," and this fixture
 * now uses it, matching `AfterMatchOverview`'s own real `null`-handling exactly (see `page.tsx`):
 * no Advisor section renders at all; the Overview's own existing "No coaching intent or review
 * recorded for this match." fallback text stands in, copied verbatim from
 * `after-match-overview.tsx:208`, not invented. The brief's own instruction not to show "synthetic
 * AI-generated reassurance" is exactly what the previous `summary` string was.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B07-TRIVIAL-FACT",
  fixtureId: "gate-b-w4-b07-trivial-fact",
  // W4-R5/R8 independent-review remediation: match-format/chronology correction, and replacing
  // the production-unreachable advisorViewModel with the real `null` state — fixtureVersion 1 -> 2.
  fixtureVersion: 2,
  fixtureSha256: "bca9ab4e495369aebf1c164e5bfbf245c7cac54b7c26e5df9594bd8df854b357",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: B07_TRIVIAL_KICKOFF_AT.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchIdentity = b07TrivialMatchIdentity;
export const timeline = b07TrivialTimeline;

/** The real, reachable "nothing to show" state — see the module doc comment above. */
export const advisorViewModel: CompletedMatchAdvisorViewModel | null = null;

export const rawRecordsForHash = {
  matchIdentity,
  timeline,
  advisorViewModel,
};
