# Gate C W1 — Changed Files

## New: UI Lab candidate routes and fixtures

- `src/app/dev/ui-lab/gate-c/page.tsx` — Gate C index.
- `src/app/dev/ui-lab/gate-c/shared/fixtures.ts` — shared command-centre/matchday-context
  builders.
- `src/app/dev/ui-lab/gate-c/shared/matchday-nav.tsx` — C03 phase/source navigation strip.
- `src/app/dev/ui-lab/gate-c/shared/today-mount.tsx` — the one client boundary every scenario's
  server-component `page.tsx` renders into (see its own doc comment: this is a real-bug fix, not
  just structure — see "Found and fixed during local verification" below).
- `src/app/dev/ui-lab/gate-c/c01-quiet-day/{page.tsx,fixtures.ts,__tests__/page.test.tsx}`
- `src/app/dev/ui-lab/gate-c/c02-decision-day/{page.tsx,fixtures.ts,__tests__/page.test.tsx}`
- `src/app/dev/ui-lab/gate-c/c03-matchday-prelive/league/{prepare,verify,imminent}/{page.tsx,fixtures.ts,__tests__/page.test.tsx}`
- `src/app/dev/ui-lab/gate-c/c03-matchday-prelive/event/{prepare,verify,imminent}/{page.tsx,fixtures.ts,__tests__/page.test.tsx}`
- `src/app/dev/ui-lab/gate-c/c03-matchday-prelive/shared/__tests__/live-now-matchday-exclusivity.test.tsx`

## New: documentation

- `docs/ui-lab/gate-c-w1-candidates/` — this directory (`SOURCE_RECONCILIATION.md`,
  `SCENARIO_REGISTER.md`, `CURRENT_STATE_AUDIT.md`, `INFORMATION_OWNERSHIP_MATRIX.md`,
  `DATA_TRUTH_AND_FIXTURES.md`, `INTERACTION_AND_STATE_AUDIT.md`,
  `THREE_PART_EXPERIENCE_CONTRACT.md`, `VISUAL_VS_CURRENT.md`, `BLOCKERS.md`,
  `CHANGED_FILES.md`, `REVIEW_RECORD.md`, `candidate_manifest.json`). `capture-attestation.json`
  is added in a follow-up commit once CI produces real capture evidence for this branch's head
  commit — see `REVIEW_RECORD.md`.

## New: browser acceptance coverage

- `e2e/ui-lab-gate-c.spec.ts` — real Chromium navigation and responsive-overflow assertions for
  C01-C03, mirroring `e2e/ui-lab-b08.spec.ts`'s established convention.

## Modified: capture and CI wiring

- `scripts/ui-lab-visual-review.mjs` — registers the eight Gate C routes (`gc-360`/`gc-430`
  smoke viewports, its own named set per this script's existing convention), and extends the
  existing `data-ui-lab-ready` readiness wait, horizontal-overflow fail-gate, and console-error
  fail-gate to `gate-c/` routes with the same strictness Gate B already has.
- `playwright.config.ts` — adds the `ui-lab-gate-c` project (no auth, same local dev-server
  target as `ui-lab-b08`) and excludes its spec from the default `chromium` project.
- `.github/workflows/ui-lab-visual-review.yml` — runs the new Gate C Playwright suite after the
  existing B08 suite, against the same already-running local server; bumps the job timeout
  45→55 minutes for the added step.
- `AGENTS.md` — the `next dev`-regenerated "This is NOT the Next.js you know" block's heading
  level normalized (`#` → `##`); auto-generated, not hand-edited (see that block's own doc
  comment on why this is committed rather than reverted).

## Found and fixed during local verification

Every scenario's `page.tsx` is a plain server component (matching the real production
`today/page.tsx`'s own shape), not a client component — this is a real fix, not a style choice.
An early draft made each `page.tsx` itself `"use client"` and computed C03's kickoff-offset
fixture directly inside it; `scripts/ui-lab-visual-review.mjs`'s console-error gate caught a real
React hydration mismatch on `gate-c-w1-c03-league-prepare` as a result (`Date.now()`-relative
fixture data evaluated independently, and therefore differently, during the server's initial
render pass and during browser hydration). Moving the fixture computation into each server
component and threading the already-resolved result through `GateCTodayMount` (a single small
client boundary) as serializable props — exactly how the real production page already passes
`AssistantCommandCentre.computedAt`, a `Date`, across that same boundary — fixed it. Re-verified
with a direct console/page-error check against all eight routes (zero errors) and a second full
local capture-script run before pushing.

## Not changed

No file under `src/components/touchline/today/*` or `src/lib/touchline/presentation/*` is
modified — `CURRENT_STATE_AUDIT.md` found no defect requiring a production change. No database
migration, no new route outside `/dev/ui-lab`, no change to Today's primary navigation, no
change to any other Gate's approved candidates or documentation.
