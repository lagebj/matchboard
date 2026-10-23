# Gate B W4 — Changed Files (B07)

## Independent-review remediation pass (PR #811, fixtureVersion 1 → 2)

In addition to everything below (the original implementation), this remediation pass modified:

- `src/app/dev/ui-lab/gate-b/shared/match-b-fixture.ts` — W4-R5 (chronology/match-format) and
  W4-R6 (opponent identity) corrections to the B07 section.
- `.../historical-pattern/fixtures.ts` — W4-R7 causal-framing/coverage-language rewrite;
  fixtureVersion 2.
- `.../historical-pattern/page.tsx` — shortened MetricStrip labels; `intentLabel` header pattern
  matching real `AfterMatchOverview` branching.
- `.../historical-pattern/__tests__/fixtures.test.ts` — match-format, opponent-identity, and real
  chronology tests added; weak tautological test replaced.
- `.../historical-pattern/__tests__/page.test.tsx` — updated for the new insight title text;
  mock-vs-real-component distinction made explicit.
- `.../trivial-fact/fixtures.ts` — W4-R8: `advisorViewModel` changed from a hand-constructed,
  production-unreachable state to the real `null` state; fixtureVersion 2.
- `.../trivial-fact/page.tsx` — `CompletedMatchAdvisorPanel`/`OrgSlugProvider` removed; real
  `AfterMatchOverview` null-handling conditional reproduced verbatim.
- `.../trivial-fact/__tests__/fixtures.test.ts` and `__tests__/page.test.tsx` — rewritten for the
  `null` advisorViewModel; mock removed from the page test (no longer needed).
- `scripts/ui-lab-visual-review.mjs` — W4-R9: evidence-inspector open-state interaction added to
  B07-A's capture registration.
- `docs/ui-lab/gate-b-w4-candidates/*` — all documents updated with the remediation record;
  `capture-attestation.json`'s superseded fixtureVersion-1 evidence preserved under
  `priorVersions`, top-level reset to a placeholder pending a fresh CI run.

No production route, component, data loader, AI capability, or server action was changed by this
remediation pass either — see `BLOCKERS.md` for the three production dependencies found and
deliberately not fixed here.

## New — candidate source (original implementation)

- `src/app/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/historical-pattern/fixtures.ts`
- `src/app/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/historical-pattern/page.tsx`
- `src/app/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/historical-pattern/__tests__/fixtures.test.ts`
- `src/app/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/historical-pattern/__tests__/page.test.tsx`
- `src/app/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/trivial-fact/fixtures.ts`
- `src/app/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/trivial-fact/page.tsx`
- `src/app/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/trivial-fact/__tests__/fixtures.test.ts`
- `src/app/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/trivial-fact/__tests__/page.test.tsx`

## Modified — shared fixtures and registration

- `src/app/dev/ui-lab/gate-b/shared/match-b-fixture.ts` — appended the B07 section (three new
  match identities, two timelines, six-record source list), same file B01-B06 already share.
- `src/app/dev/ui-lab/gate-b/page.tsx` — registered both B07 candidate links; updated the
  "deferred" note (B07 implemented, only B08 remains deferred).
- `scripts/ui-lab-visual-review.mjs` — registered both new routes for CI visual capture
  (`gate-b-w4-b07-historical-pattern`, `gate-b-w4-b07-trivial-fact`), explicitly to avoid
  repeating B06's own B5/R7 finding (new pages shipped with zero capture evidence because they
  were never added to this array).
- `.github/workflows/ui-lab-visual-review.yml` — `timeout-minutes` 25 → 35, after this PR's own
  first CI run was cancelled mid-capture; see `SOURCE_RECONCILIATION.md` W4-R4.

## New — W4 documentation set (this directory)

- `SCENARIO_REGISTER.md`, `CURRENT_STATE_AUDIT.md`, `THREE_PART_EXPERIENCE_CONTRACT.md`,
  `DATA_TRUTH_AND_FIXTURES.md`, `SOURCE_RECONCILIATION.md`, `INTERACTION_AND_STATE_AUDIT.md`,
  `VISUAL_VS_CURRENT.md`, `BLOCKERS.md`, `REVIEW_RECORD.md`, `CHANGED_FILES.md` (this file),
  `candidate_manifest.json`, `capture-attestation.json` (placeholder — see `BLOCKERS.md`).

## Not touched

B01-B06 candidate source, fixtures, tests, and documentation (`gate-b-w1/w2/w3-candidates/`) are
unmodified. No production route, component, data loader, AI capability, or server action was
changed.
