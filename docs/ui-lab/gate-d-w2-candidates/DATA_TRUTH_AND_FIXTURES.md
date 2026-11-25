# Gate D W2 — Data Truth and Fixtures

## Remediation (owner review of PR #847, 2026-11-25)

The owner's review of this PR's first version found four real evidence-fidelity defects, not
present in this document's own original claims:

1. **P1 — D03-DECISION-FLOW cited evidence with no backing source records.** The original
   `coach-decision-flow/fixtures.ts` cited `trend-amir-lm-minutes`, `obs-amir-lm-comfort`,
   `trend-amir-trailing-rate`, and `trend-amir-copresence` with **no `EvidenceSourceMap` at all**
   — `resolveEvidenceSource` was never called against this fixture's own refs, and no test checked
   that it could be. This document's original "Evidence consistency, independently verified per
   fixture" section only ever described D06 fixtures' verification by name — it did not claim
   D03-DECISION-FLOW was covered, but it also did not disclose that it was not. Corrected: a full
   `EvidenceSourceMap` now backs all four refs (plus a second observation, since the hypothesis's
   own "two recent observations" claim had cited only one), independently verified by a new test
   suite (`coach-decision-flow/__tests__/fixtures.test.ts`'s "evidence integrity" block).
2. **P1 — a `HUMAN_ASSESSMENT`/`QUALITATIVE_OBSERVATION` could render as "Recorded fact."**
   `evidence-source-detail.tsx`'s pill label was derived from `FixtureSourceProvenance`
   (RECORDED/DERIVED), not from `EvidenceRef.kind` — a coach's own judgment, stored with
   `provenance: "RECORDED"` because the fixture didn't compute it, displayed identically to a
   canonical match fact. Corrected: the label is now derived from `kind` directly (`w2-shared/
   evidence-source-detail.tsx`'s `KIND_LABEL` map), covering all seven real `EvidenceRef` kinds,
   independently tested for every kind (`w2-shared/__tests__/evidence-source-detail.test.tsx`).
3. **P2 — D03-GROUNDED called a count a "rate."** The trend labelled "Defensive-third giveaway
   rate" was backed only by two raw per-window counts (5, then 2) with no exposure denominator
   (minutes, pressure situations). Corrected: renamed to "Recorded defensive-third giveaways" (a
   count), with an explicit disclosed caveat that this is not an exposure-adjusted rate.
4. **P2 — D03-GROUNDED's learning-cycle duration was wrong.** The page said "five-week window"
   for a range (30 Aug – 11 Oct 2026) that is actually six weeks. Corrected: the week count is now
   computed from the fixture's own date boundaries (`cycleWindowWeeks`), not hand-typed.

All four are recorded here as genuine findings against the version of this document that existed
before this review — not retroactively erased. The corrections and their independent verification
are described throughout the rest of this document, updated in place where the underlying fact
changed.

Every candidate fixture is deterministic, explicitly synthetic (`sourceClass:
"SYNTHETIC_LABELED"`), and typed against real production view-model/component types — no new
persistent types, no new Prisma models. Each fixture follows the Gate C W3 `FixtureIdentity`
convention (scenario ID, fixture ID, fixture version, a `fixtureSha256` independently recomputed
by its own test from `rawRecordsForHash`, fixed reference date, viewer timezone, locale).

## The one new piece of logic: `resolveEvidenceSource`

`src/app/dev/ui-lab/gate-d/w2-shared/evidence-source-types.ts` adds a `FixtureSourceRecord` type
and a `resolveEvidenceSource(ref, sources)` function that throws if a cited `EvidenceRef` has no
matching source record, or if the source record's `kind` disagrees with the ref's own declared
`kind`. This exists specifically to make "a plausible-looking source label without a
corresponding source record" (prohibited by the mission brief) a hard test failure rather than a
silent possibility. Built test-first (`w2-shared/__tests__/evidence-source-types.test.ts`
confirmed red before the implementation existed, then green after).

Every D03 and D06 fixture that defines a hypothesis has its own test that independently calls
`resolveEvidenceSource` for every cited ref — a valid TypeScript type is never treated as proof
that the evidence statement is truthful; the test itself verifies the resolution succeeds and,
where relevant, that the resolved record's content matches what the hypothesis statement claims
(e.g. the D03-GROUNDED test asserts the derived trend's own source record states its comparison
window in the detail text, not just a bare number). This coverage was incomplete at this PR's
first version — D03-DECISION-FLOW had no source map and no such test at all (see "Remediation"
above) — and is now uniform across every hypothesis-bearing scenario.

## Evidence consistency, independently verified per fixture

- **Every evidence reference resolves to a fixture source.** Asserted directly by each
  hypothesis-bearing fixture's own test (`resolveEvidenceSource` does not throw for any cited ref,
  across all of D03-GROUNDED, D03-DECISION-FLOW, D06-COHERENT, D06-CONTRADICTION, and
  D06-SOURCE-INSPECTION) and transitively by the shared validator's own unit tests.
- **Source kinds match their actual records.** Enforced by `resolveEvidenceSource` itself — a
  kind mismatch is a thrown error, not a silently accepted one. A source's displayed *label* is
  also kind-derived now (`KIND_LABEL`, `w2-shared/evidence-source-detail.tsx`), not
  provenance-derived — see "Remediation" above.
- **Timestamps support the stated sequence.** D03-GROUNDED's five observations run 30 Aug → 11 Oct
  2026 in strictly increasing order; D06-CONTRADICTION's two contradicting sources are dated 20
  Sep and 11 Oct 2026 respectively, and the hypothesis statement names both dates explicitly
  (asserted by its own test). Every D03-GROUNDED source's own `occurredAt` is independently
  asserted to fall within the fixture's stated six-week window.
- **Trend/count data supports the stated direction and uses correctly defined units.**
  D03-GROUNDED's trend source states "5 … previous 3 matches … -> 2 … latest 3 matches" as a
  recorded **count**, not a rate (see "Remediation" above — the prior version mislabelled this a
  "rate" with no exposure denominator); D06-COHERENT's trend states "0 … previous 3 matches … ->
  180 … latest 3 matches" — a real increase, matching "shifted … over the latest matches."
  D03-DECISION-FLOW's trailing-event trend now states a real **rate** (numerator, denominator,
  units, and both comparison windows: "2 across 108 recorded trailing minutes … a rate of 1 per 54
  minutes" -> "3 across 126 recorded trailing minutes … a rate of 1 per 42 minutes").
- **Missing sources are not silently filled.** D03-SPARSE and D06-SPARSE both use
  `NoDefensibleHypothesis` instead of fabricating a hypothesis; their own `availableFacts` list
  only what is actually known.
- **Contradictory evidence remains visible.** D03-GROUNDED's `contradictingRefs` and
  D06-CONTRADICTION's `contradictingRefs` are both non-empty and asserted present in both the
  fixture test and the component test — never silently dropped.
- **No hypothesis asserts facts absent from its inputs.** Each hypothesis statement is checked
  against its own cited sources' `detail` text in its fixture test (e.g. D06-COHERENT's assertion
  that the statement never claims "a demonstrated improvement in centre-back ability").
- **Numeric values remain within the real domain.** Minute totals (180 of a possible 270 across 3
  full matches, etc.) are internally consistent with a 90-minutes-per-match assumption; no value
  exceeds what three full matches could produce.
- **Profile-position labels use the approved 14-role projection; exact evidence retains 24-code
  precision.** Asserted directly: D06-COHERENT and D06-SOURCE-INSPECTION each call the real
  `collapseTacticalToProfile()` for their own profile-level narrative language (`CB` and `F`
  respectively — note `F`, not `CF`: the real 14-role vocabulary's forward label is unsided `F`,
  confirmed by reading `profile-position-model.ts`'s own `PROFILE_POSITIONS` list directly rather
  than assumed), while every `ACTUAL_POSITION_INTERVAL` source record's `detail` text states the
  exact sided 24-code (`RB`, `LCB`, `LW`, `CF`) explicitly, independently asserted by each
  fixture's own test.

## Per-scenario fixture summary

- **D03-GROUNDED** (`fixtureVersion: 2`) — Jonas Berg, 5 observations over 6 weeks (30 Aug–11 Oct
  2026, duration now computed from the fixture's own dates), one active development focus
  ("Composure under pressure in the defensive third"), one "Learning cycle" team-level insight, one
  hypothesis citing a derived **count** (not a rate — see "Remediation") + 2 supporting
  observations + 1 contradicting observation, 3 disclosed missing-evidence items (the third added
  by this remediation: the exposure-normalization caveat).
- **D03-SPARSE** — Leah Nilsen, 1 observation, 1 just-opened development thread with no review
  cadence yet (`reviewState: null`), zero hypotheses (mirrors production's real empty-array
  return), a `NoDefensibleHypothesis` state naming 3 concrete available facts.
- **D03-DECISION-FLOW** (`fixtureVersion: 2`) — Amir Haile, 3 independent hypotheses
  (`confirm-demo`, `dismiss-demo`, `error-demo`), one simulated confirm-error wired by hypothesis
  id. Now fully backed by a 5-entry `EvidenceSourceMap` (two left-midfield observations, one
  left-midfield minutes trend, one trailing-event-rate trend, one co-presence trend) — see
  "Remediation" above; the original version had no source map at all.
- **D06-COHERENT** — Noah Fjeld, 1 hypothesis citing a derived trend, 1 observation, and 2
  position intervals (RB → LCB), 1 disclosed missing-evidence item, zero contradicting refs
  (genuine agreement, not a forced absence of conflict).
- **D06-CONTRADICTION** — Noah Fjeld (same player, different window), 1 hypothesis citing a
  supporting trend + position interval, 2 contradicting refs (`HUMAN_ASSESSMENT` +
  `QUALITATIVE_OBSERVATION`) naming the exact same substantive claim, `uncertainty: "HIGH"`.
- **D06-SPARSE** — Elin Vik, zero hypothesis, 4 `availableFacts` each prefixed with its own gap
  category (`Missing data:`, `Insufficient sample:`, `No contrary evidence:`, `Coach
  uncertainty`).
- **D06-SOURCE-INSPECTION** — Sara Dahl, 1 hypothesis citing a derived trend + observation + 2
  position intervals (LW → CF), 1 disclosed missing-evidence item.

## Limitations disclosed

- The derived-trend `detail` text in every source record is a UI Lab–authored sentence, not a
  literal reproduction of `headlineForTrend()`'s exact output string from
  `get-player-trend-stories.ts` — it follows the same comparison-window phrasing convention
  ("previous 3 matches vs. latest 3 matches") deliberately, but is not asserted byte-identical to
  production's real trend-headline generator. This wave does not call that production function
  directly because D06's trends concern metric/dimension combinations (centre-back role minutes,
  defensive-third giveaways at a specific position) outside the real `MetricKey` enum's five
  ELIGIBLE event types — exactly like Wave 1's own D02 fixtures already used plain-language
  "Opportunity"/"Position" trend language without binding to the literal metric registry.
- `canonicalFullLabel()` (real, `src/domain/positions/canonical-labels.ts`) is called directly for
  every position-interval source record's label — not reimplemented — so position-label text is
  provably the real production label, not a parallel hand-written one.
