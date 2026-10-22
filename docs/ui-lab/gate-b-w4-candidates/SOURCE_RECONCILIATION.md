# Gate B W4 — Source Reconciliation (B07)

Real findings made and corrected during this wave's own implementation, in the order found —
same convention every prior Gate B wave's `SOURCE_RECONCILIATION.md` has used.

## W4-R1 — missing source record for this match's own cited event

The B07-A insight body cites this match's own 23' goal-against event ("Bærum SK exploited it
again today") as one of the three timed anchors, but the first draft of
`b07HistoricalPatternSourceRecords` only included the two *prior* matches' goal-against events,
not this match's own. Corrected by adding a sixth `SourceRecord`
(`B07_HISTORICAL_GOAL_AGAINST_EVENT_ID`) scoped to the current match, so the insight's own claim
about "today" is backed by an inspectable record, not only the two prior matches. Changed the
hashed fixture content — `fixtureVersion` stayed at 1 since this was corrected before any
external capture or review ever ran against it (no revision to supersede).

## W4-R2 — insufficiently hedged confidence language

The initial insight body ended with an unhedged claim. A dedicated test
(`"the hypothesis does not overstate confidence"`) was written first per TDD, then the body text
was revised to add an explicit "Not every match this team has played raised it... not a guarantee
it recurs again" clause — the brief's own required "acknowledges significant evidence gaps"
criterion, now directly enforced by a test rather than only asserted in prose.

## W4-R3 — vitest component-test environment cannot import the real Advisor panel

Attempting to render the real, unmodified `CompletedMatchAdvisorPanel` inside
`vitest.config.components.ts` (jsdom) failed: `Cannot find module 'next/server' imported from
.../next-auth/lib/env.js`. Traced to the panel's own import of
`@/app/(app)/o/[orgSlug]/matches/[matchId]/ai-insight-actions` (a real `"use server"` module whose
transitive auth/db dependency chain the jsdom test environment cannot resolve — Next.js's real
build pipeline handles the client/server boundary transform that makes this safe in production
and in the real browser-driven CI capture run; vitest's component config does not apply it).
Confirmed this is not special to B07: production's own
`src/components/matches/match-detail/__tests__/after-match-overview.test.tsx` already mocks
`@/components/ai/completed-match-advisor-panel` for the identical reason, with a comment saying
so explicitly. Resolution: both B07 page tests mock the same module with a **faithful**
re-render of the fixture's own `viewModel` fields (summary/insights/section labels/evidence
sources) — not an opaque stub — so the page-level tests still exercise real fixture-to-rendering
wiring. The actual page *source* still mounts the real, unmodified production component; only the
test harness substitutes it, matching exact production precedent.

## W4-R4 — `ui-lab-visual-review.yml`'s 25-minute job timeout had no real margin

This PR's first CI run (https://github.com/lagebj/matchboard/actions/runs/39848281906) was
cancelled by the job's own `timeout-minutes: 25` at 25m26s, mid-capture, having only reached
`gate-b-w3-b06-event-detail` — never starting either B07 scenario. Per-step timing
(`gh api .../jobs/120067320061`) shows the actual cause: `npx playwright install --with-deps
chromium` alone took 11m05s that run (CI infra variance — package/apt mirror load, not a build or
install logic the content of this wave touches), leaving the capture step only 13m29s of the
25-minute budget before being cut off — compare the most recent prior successful capture run
(39829331691), whose equivalent step took under a minute and whose entire job completed in
14m22s, well inside 25 minutes. Corrected by raising `timeout-minutes` to 35 in
`ui-lab-visual-review.yml`, disclosed inline — a CI configuration change, not an app or fixture
change, and the minimum needed to give the capture step real margin against ordinary install-step
variance rather than a change tailored to make this wave's own two extra scenarios just barely
fit.

## No change required

The brief's own section 7 anticipated needing a narrowly-scoped adapter if the real panel
"cannot be used safely in UI Lab." In practice the real component is safe to mount unchanged —
see `CURRENT_STATE_AUDIT.md`'s "Correction to the brief's own assumption" note. No adapter
component was built.
