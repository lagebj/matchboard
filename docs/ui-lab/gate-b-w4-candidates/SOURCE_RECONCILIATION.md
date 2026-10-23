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

---

## Independent review remediation (PR #811, reviewed commit `edd576b52471559cbe7140c10240c1ad8b0c116f`)

A separate, independent review of the merged candidate found four P1 and several P2 defects.
Every finding was first independently verified against the real repository (not assumed correct)
before any fix — see each entry below for what was actually found. `fixtureVersion` bumped 1 → 2
for both scenarios; both scenarios remain `CANDIDATE`, `approval: null`.

### W4-R5 (P1) — match-format/chronology contradiction, confirmed real

B07's timelines used an 80-minute match structure (events up to 74'/69', a historical source
record at 61') for the same "Slemmestad Rød" team identity B05's own fifth/sixth remediation
passes already established plays the real NFF Akershus G11 7v7 format — two 30-minute periods, 60
minutes regulation (`B05_MATCH_FORMAT`, `b05-post-match-report/shared/report-data.ts:56`). No
match-specific exception was declared for B07, so this was a real contradiction, not a false
positive. Corrected: `b07HistoricalTimeline`'s 66'/74'/80' became 53'/58'/60'; the historical
source record's 61' became 55' (the exact same correction B05's own R10-1 pass made to an
identically out-of-regulation 61' event); `b07TrivialTimeline`'s 69'/80' became 58'/60'. Event
order and both final scores (3-2, 4-1) are unchanged. `globalMinuteToPeriodRelative()` itself was
**not** adopted — it converts a global minute into `MatchCanonicalLiveEventFact`'s
period/matchSeconds encoding, a field pair `MatchTimelineItem` (what B01/B03/B04/B06/B07 actually
use) doesn't have; the in-scope fix is simply that no minute exceeds
`B05_MATCH_FORMAT.regulationDurationMinutes`, now enforced by a dedicated test importing that real
constant (not a re-declared literal) plus negative-regression tests using the original invalid
66'/74'/80'/61'/69' values. **Note:** importing `B05_MATCH_FORMAT` directly into
`shared/match-b-fixture.ts` was attempted first and reverted — `report-data.ts` already imports
`MATCH_B_TEAM_NAME`/`B05_MATCH_ID`/etc. *from* `match-b-fixture.ts`, so that import would have
created a real circular module dependency (risking `undefined` values at the module-evaluation
boundary, not merely a lint warning). The fixture file hardcodes the literal `"60'"` instead, with
test-file-only imports of `B05_MATCH_FORMAT` for verification (no cycle there, since test files
aren't imported by either production fixture module).

### W4-R6 (P1) — historical evidence opponent-identity contradiction, confirmed real

`B07_PRIOR1_DEBRIEF_NOTE` named "Bærum" as the opponent that exploited the defensive weakness, but
`B07_PRIOR1_OPPONENT_NAME` is "Fjellhug IF" — Bærum SK is actually the HISTORICAL (current) match's
own opponent, a copy-paste error from drafting all three debrief notes together. Corrected to name
Fjellhug. Audited every other B07 evidence record (match identity, date, event id, goal minute,
source class, scope, observed behavior) for the same class of error — no further instances found.
Also corrected: the primary insight's body previously said "Bærum SK exploited it again today
\[23'\]," asserting the review's own causal link between a specific goal and the lost-throw-in
mechanism; reworded so the "Match data" record states only when a goal was conceded and the
"Coach observation" record carries the coaching staff's own explanation — the review never asserts
the timing alone proves the cause. Also corrected an unsupported completeness claim: "recorded in
2 of the last 2 prior completed matches' debriefs" (implying these are literally the team's most
recent matches, which this two-match fixture does not establish) became "the two prior matches
included in this review" throughout the insight text and page caption.

### W4-R7 (part of R6) — causal-framing and coverage-language test coverage

New tests directly enforce both corrections above: an opponent-identity cross-check (every
match's own debrief note never names a different match's opponent fragment), a "never claims
'last N'" check, and a "doesn't assert timing alone proves cause" check — replacing prose-only
guarantees with assertions that fail if either wording regresses.

### W4-R8 (P1) — B07-B's Advisor state was production-unreachable, confirmed real

Traced `getCompletedMatchAdvisorViewModel()`'s full state transition
(`completed-match-advisor.ts:149-188`): `buildViewModel()` — the only code path that can produce
`status: "fresh"`/`"stale"` — runs only when a `SUCCEEDED` review's `insights.length > 0` (line
174); whenever that gate passes, at least one of `sectionableInsights`/`clarificationInsight`/
`suggestionInsights` is non-empty by construction (every active insight falls into one of those
three buckets). So the fixture's previous `{status: "fresh", insights: [], clarification: null,
suggestions: []}` — all three empty while status is "fresh" — can never be real output. When a
succeeded review genuinely has zero active insights, the `review.insights.length > 0` gate fails
and the function falls through to the job-status check (QUEUED/RUNNING → `"reviewing"`, FAILED →
`"unavailable"`); since there's no pending/failed job for an already-succeeded review, it returns
`null` — the same `null` production returns for AI-disabled/no-connection/report-not-LOCKED.
Corrected: `advisorViewModel` is now literally `null`; `page.tsx` no longer imports
`CompletedMatchAdvisorPanel`/`OrgSlugProvider` at all, and instead reproduces
`AfterMatchOverview`'s own real conditional branching
(`after-match-overview.tsx:201-209`) verbatim — `hasAdvisorContent`/`intentLabel` computed the
same way, falling through to the real, verbatim-copied fallback text "No coaching intent or review
recorded for this match." This also directly addresses the brief's own instruction not to show
"synthetic AI-generated reassurance" — the removed `"No historical pattern identified from the
available evidence."` string was exactly that.

### W4-R9 (P2) — evidence-inspector capture coverage completed

B07-A's primary interaction (opening the historical evidence inspector) had no capture evidence
beyond the default-closed state. Added `interactions: [{id: "evidence-open", perform:
openSourceInspectorByName("Inspect historical evidence")}]` with `interactionViewports: ["desktop",
"mobile"]` to `ui-lab-visual-review.mjs` — reusing A04's own existing capture helper unmodified,
not a new interaction mechanism, and scoped to exactly the two viewports the brief asked for
(desktop + mobile), both themes (the capture loop already runs per-theme).

### W4-R10 (P2) — test-quality issues, confirmed and corrected

1. The historical-pattern chronology test compared `identity.fixedDateTimeUtc` (literally
   `B07_HISTORICAL_REFERENCE_AT`) against a second hardcoded copy of the same ISO string — a
   tautology that could never fail regardless of whether prior matches actually precede the
   current one. Replaced with assertions comparing the real imported
   `B07_PRIOR1_KICKOFF_AT`/`B07_PRIOR2_KICKOFF_AT`/`B07_HISTORICAL_KICKOFF_AT` constants against
   each other and against `identity.fixedDateTimeUtc`.
2. Page tests render against a mocked `CompletedMatchAdvisorPanel` (necessary — see W4-R3); added
   an explicit comment distinguishing what a mocked-component composition test can and cannot
   prove, and pointing to the real CI browser captures as the actual verification of the real
   component's rendering, rather than leaving that distinction implicit.
3. The "carries no clarification or development suggestion" test already asserted the real
   guarantee (fixture-level, not DOM-level) — kept as-is; the DOM-level "no mutation action
   reachable" tests removed in the original implementation (for being vacuous against a mock that
   never defines those controls) remain removed, with the fixture-level test doing the real work,
   now cross-referenced explicitly in both page test files' comments.

### W4-R11 — CodeQL: incomplete string escaping in the new match-format tests

This remediation's own first CI run surfaced 3 new high-severity CodeQL alerts (`js/incomplete-
sanitization`), all `minuteLabel?.replace("'", "")` — a single-argument `.replace()` only replaces
the FIRST occurrence of `'`. Every `minuteLabel` here only ever has one trailing apostrophe (e.g.
`"58'"`), so this was functionally correct for this fixture's own data, but CodeQL can't know that
from static analysis, and B05's own R10-1 pass hit and fixed the identical pattern in its own new
test file. Corrected the same way, reusing the exact established fix
(`b05-post-match-report/shared/__tests__/combination-evidence.test.ts:289`): `.replace(/'/g, "")`,
a global regex, in all three occurrences across both new test files.

### 320px/360px visual finding (P1) — see `VISUAL_VS_CURRENT.md` and `BLOCKERS.md`

Confirmed real (score wraps to two lines, metric labels truncate illegibly) but traced to two
shared, unmodified production components (`MatchIdentityCard`, `MetricStrip`) that reproduce the
identical defect in already-captured B04/B06 baselines — not introduced by B07, not fixed in this
PR per the review's own instruction not to silently change production code here. B07's own
`factsItems` labels were shortened (within B07's own scope) to reduce truncation; the component-
level fix is recorded as a production dependency. **Superseded by W4-R12 below.**

---

## Close-out remediation (B07 ready for owner visual approval)

### W4-R12 (P1) — `MatchIdentityCard` fix: completed, verified, and merged into this PR

The production fix for the above finding was prepared on its own branch
(`fix/match-identity-card-narrow-score-wrap`), as intended, in two commits:

1. **`abfa8d9967cb64344fc86229c00dda657e5822f6`** — the initial fix: `whitespace-nowrap` +
   `shrink-0` on the score column; a tighter row gap (`gap-3 sm:gap-10`, was `gap-6 sm:gap-10`); a
   tighter team-name truncation width below `medium`; the existing smaller `TeamKitMark` size
   variant below `medium` (two instances toggled by CSS display). 10 new jsdom tests covering
   scheduled/live/cancelled/completed states, home/away orientation, long names, two-digit scores,
   and the `lg` size variant.
2. **`cd7f9b59565913760693214d8d80805de5e3559e`** — a follow-up independent review caught two real
   issues in commit 1: `TeamIdentity`'s new `flex-1` was unconditional (not breakpoint-scoped) —
   harmless in every real call site today (none stretch `MatchIdentityCard`'s own root element),
   but scoped explicitly to `flex-1 medium:flex-none` anyway rather than relying on that caller-side
   fact implicitly; and the 2-tier `gap-3 sm:gap-10` would have silently redefined the untouched
   600-639px range (previously `gap-6` the whole way to 640px, same as below 600px) down to the new
   tighter `gap-3` — corrected to a 3-tier `gap-3 medium:gap-6 sm:gap-10` that preserves the
   original `gap-6` value, unchanged, for exactly 600-639px.

**Real-browser verification** (not jsdom): two `ui-lab-visual-review.yml` `workflow_dispatch` runs
directly on the fix branch (no PR needed for this) —
[39951319072](https://github.com/lagebj/matchboard/actions/runs/39951319072) (commit 1) and
[40014393376](https://github.com/lagebj/matchboard/actions/runs/40014393376) (commit 2, final).
Both completed successfully; `sourceCommitSha` confirmed to match the exact branch-tip commit each
time (no PR synthetic-merge involved, since `workflow_dispatch` runs directly against the pushed
branch). 92 B01/B04/B06 captures (320/360/390/430/600/768/900/1440px, both themes) independently
hash-recomputed each run, zero mismatches.

**Pixel-level regression proof** (`PIL.ImageChops.difference`, not visual inspection alone):
compared the final run's B04 screenshots against the true pre-fix baseline (this PR's very first
capture run, before any `MatchIdentityCard` change existed):
- 1440px (desktop, both themes), 768px, 900px, and 600px: **zero-pixel diff, `bbox=None`** —
  byte-for-byte identical to the pre-fix rendering. This is the rigorous answer to the "does
  `flex-1`/the gap change alter desktop or the 600-639px range" question: it does not, confirmed
  by direct measurement, not just reasoning about flexbox semantics.
- 320/360/390/430px: genuinely differ from the pre-fix baseline (the wrap is fixed) — and are
  pixel-identical between commit 1's own capture and commit 2's capture, confirming the
  `flex-1`/gap refinement changed nothing below 600px, only corrected the 600-639px boundary.

**Integration — the dependency cycle and its resolution:** opening the fix as its own PR was
blocked by a real cycle, not a preference — confirmed via
`gh api repos/lagebj/matchboard/rules/branches/main`, which shows "Visual Authority Gate" as a hard
`required_status_checks` entry (a repository ruleset, not classic branch protection, which is why
the legacy `branches/main/protection` endpoint reports "not protected"): PR #811 cannot merge until
the owner resolves that gate; `AGENTS.md` forbids opening a second PR while #811 is open; B07's own
captures can't reflect the fix until it's on `main`. Resolved by merging the fix directly into this
PR's own branch (`git merge --no-ff fix/match-identity-card-narrow-score-wrap`) — fully visible in
the one PR the owner already reviews, nothing merged to `main` without the owner's own action
either way. `fixtureVersion` was **not** bumped — no B07 fixture content changed, only a shared
production component's CSS.

### Why `MetricStrip` was not also changed

B07's own `factsItems` label shortening (from the prior remediation pass) already resolved the
truncation-readability problem within B07's own scope. No further `MetricStrip` production change
was found to be necessary — the brief's own instruction was explicit not to touch it "merely
because it was involved in the original finding," only if an actual readability defect remained,
and none did after the label change.

### W4-R13 (P1) — `MatchIdentityCard`: team-identity truncation regression, found and corrected

A follow-up independent review confirmed a real defect in W4-R12's own fix: keeping the score on
one line relied on truncating compact team names to a fixed `max-w-[4.5rem]`, which discards
exactly the information distinguishing two same-club teams ("Slemmestad Rød" → "Slemme…",
indistinguishable from "Slemmestad Hvit"/"Slemmestad Blå"). Match identity must never be
sacrificed for score compactness.

Corrected with commit `c608554383bde1abc5c8774d0966387b89090953`: `MatchIdentityCard`'s compact
composition is rebuilt as a 2-row CSS grid — `[home kit] [score] [away kit]` / `[home name]
[status] [away name]` — so team names no longer share horizontal room with the score at all. Full
design rationale, the three options considered, and real-browser verification (including a
temporary, never-merged scratch-branch capture of the exact same-club-suffix case the review
asked for) are in `VISUAL_VS_CURRENT.md`'s "Second remediation" section. 10 jsdom tests
rewritten/added, including a negative-regression test asserting the removed `truncate`/
`max-w-[4.5rem]` classes never reappear on the compact names, and explicit same-club-pair
assertions. Two downstream UI Lab page tests (B05 draft, B06 League-After) updated from
`getByText` to `getAllByText`, since the score legitimately renders twice now (one per
composition). `fixtureVersion` unchanged at 2 — no B07 fixture content changed.
