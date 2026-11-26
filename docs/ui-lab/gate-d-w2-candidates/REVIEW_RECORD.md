# Gate D W2 — Independent Review Record

Commissioned as a fresh, context-free review (a separate agent with no access to the
implementation session's own reasoning or assumptions, per the mission brief's "the implementing
agent's own review is not an independent review"). The reviewer was instructed to be genuinely
adversarial, to run the real tests itself rather than trust the docs, and to verify every central
claim in `CURRENT_STATE_AUDIT.md` against the actual code directly.

## What the reviewer verified directly (not just read and trusted)

- `git diff main -- src/components/ai/` and `git diff main -- src/lib/` are both empty — the
  real `AssistantCoachHypothesisPanel` and `getPlayerAssistantCoachHypotheses()` are genuinely
  byte-identical to `main`.
- `D03-SPARSE`'s `hypotheses` array is genuinely `[]`, not a fabricated finding dressed up as
  something else; its `NoDefensibleHypothesis` copy lists only real, verifiable facts.
- The coach's existing development focus and the AI hypothesis stay visually/textually distinct
  in `grounded-longitudinal-hypothesis`, and the hypothesis statement itself never claims the
  focus is resolved or complete.
- D06's three evidence families (`coherent-synthesis`) are genuinely distinct records with no
  content overlap, not two relabeled copies of the same measurement.
- Every `EvidenceRef` across every D03/D06 fixture resolves to a real, matching-`kind` source
  record (`resolveEvidenceSource` throws otherwise; verified by running the actual test suite:
  65/65 tests passed across both Vitest configs at review time).
- `genuine-contradiction`'s two contradicting sources concern the identical substantive claim
  (centre-back readiness, 20 Sep vs. 11 Oct) — a real disagreement, not a strawman built from two
  compatible statements.
- No `missingEvidence` entry anywhere is phrased as an implied negative judgement.
- No hypothesis is ever auto-promoted; every simulated action requires explicit user interaction.
- `grep -rn "confirmAssistantCoachHypothesisAction\|dismissAssistantCoachHypothesisAction" src/app/dev/ui-lab/gate-d/`
  returns zero hits — the real Server Actions are reachable only from inside the real,
  unmodified panel itself, never from any Wave 2 fixture or mount.
- `e2e/ui-lab-gate-d.spec.ts`'s new tests use the existing `collectServerActionRequests()` helper
  (filters on the real `next-action` header) and assert `toHaveLength(0)` after every simulated
  interaction — not a blanket "no POST" check — and assert on real rendered text/roles, not loose
  DOM presence.
- `CURRENT_STATE_AUDIT.md`'s two central production-gap claims were independently re-derived from
  the actual source, not taken on faith: `EvidenceRef`'s lack of a navigable field, and
  `getPlayerAssistantCoachHypotheses()`'s four-condition collapse to `[]`, both confirmed by
  reading the real files directly; the real `DevelopmentTab` was confirmed to mount the panel raw
  with no OFF/EMPTY/ERROR/STALE wrapper.
- `collapseTacticalToProfile()` is used correctly: `"LCB"` → `"CB"`, `"CF"` → `"F"`, cross-checked
  against `PROFILE_TO_TACTICAL_GROUP` directly; every `ACTUAL_POSITION_INTERVAL` source record
  states the real sided 24-code explicitly.
- No regression risk to Gate C W3 or Gate D W1 — `git diff main --stat` shows only three modified
  files, all additive.
- `capture-attestation.json` does not exist yet; every new `scripts/ui-lab-visual-review.mjs`
  route string was cross-checked against the real `page.tsx` paths — no typos.
- GitHub issues #845/#846 are real, open, and match the disclosed gaps exactly (verified via
  `gh issue view`, not taken on the implementer's word).
- Every doc under `docs/ui-lab/gate-d-w2-candidates/` was checked for overclaiming a UI-Lab-only
  mechanism as a production capability — none found.

## Findings

### MAJOR — dangling cross-reference to a never-written `REVIEW_RECORD.md` (this file)

At review time, `CHANGED_FILES.md`, `BLOCKERS.md`, and `INTERACTION_AND_STATE_AUDIT.md` all
referenced `REVIEW_RECORD.md` as part of the delivered doc set, but the file did not yet exist —
the implementing session had deliberately deferred writing it until the independent review it
documents had actually happened, but had not flagged that deferral anywhere a reader would see
it before hitting the dangling reference.

**Outcome: fixed.** This file is the resolution — written immediately after the review returned,
containing the review's own real findings and disposition, closing every one of those three
cross-references.

### MINOR — awkward profile-role phrasing in two hypothesis statements

`coherent-synthesis/fixtures.ts` and `source-inspection-confirmation/fixtures.ts` originally
interpolated a bare profile code directly into prose as `(profile role: F)`, reading oddly next
to "centre forward" in the same sentence (the 14-role vocabulary's forward label is an unsided
single letter, not an English word — correctly derived, just roughly presented).

**Outcome: fixed.** Both statements reworded to `"... shifted from X towards Y over the latest
matches — in 14-role profile terms, from profile role: A to profile role: B ..."`, deriving both
endpoints' profile roles explicitly (`rbProfileRole`/`wingProfileRole` added alongside the
existing `cbProfileRole`/`forwardProfileRole`) rather than silently picking one. Both fixtures'
`fixtureVersion` bumped to `2`; `fixtureSha256` recomputed and verified (65/65 tests still pass,
including all pre-existing assertions — only the sha256 and the new display-wording assertions
needed updates; no evidence-integrity or domain-rule test changed).

## CI capture run — real failures found and fixed, then verified green

The first real CI run (`ui-lab-visual-review.yml`, PR #847) found **4 real Playwright
failures** that neither Vitest config nor this review could surface locally (the devcontainer's
own pre-existing HMR limitation, `BLOCKERS.md`):

1. `getByText("Composure under pressure in the defensive third")` resolved to 2 elements —
   Playwright's default text match is a case-insensitive substring search (unlike Testing
   Library's jsdom default, which is an exact match), and the phrase genuinely appears twice
   (the focus widget's title, and quoted inside the hypothesis statement's own prose).
2. Same root cause for `getByText("No defensible hypothesis")` — the page's own `<h1>` also
   contains that substring.
3. The decision-flow Dismiss test clicked `.first()` when it needed the second hypothesis's own
   Dismiss button (`.nth(1)`) — a genuine test-authoring bug (wrong index), not a component bug.
4. The coherent-synthesis test asserted visibility of a provenance pill inside a collapsed
   `<details>` without expanding it first — a real browser correctly treats unexpanded `<details>`
   content as not visible (jsdom's own rendering model does not make this distinction the same
   way, which is why the equivalent Vitest component test did not catch it).

All four are test-authoring defects, not component, fixture, or domain-rule defects — confirmed
by re-reading the actual failure output line-by-line before writing the fix. Fixed in a single
follow-up commit; the re-triggered CI run passed in full: all required checks green, the Gate D
Playwright acceptance suite (D01/D02/D04/D06/D07/D08/D09 — Wave 1 regression-checked in the same
run — plus this wave's new D03/D06 tests) passed, and all 42 scheduled captures (7 scenarios × 6
viewport/theme combinations) succeeded.

**Capture provenance independently verified** (not taken on the workflow's own report): the real
CI artifact (`ui-lab-review-45635807186-1`) was downloaded via `gh run download`, and every one
of the 42 recorded `sha256` values was recomputed directly from the downloaded PNG bytes and
found to match exactly — zero mismatches, zero missing files. `docs/ui-lab/gate-d-w2-candidates/
capture-attestation.json` records this verification; see its own `knownLimitations` for the
GitHub Actions synthetic-merge-commit caveat every prior wave's attestation also discloses.

## First-round disposition (superseded below — kept, not erased)

**READY_FOR_OWNER_VISUAL_REVIEW** (as of the state described above)

No BLOCKING findings at that point. The one MAJOR finding (from the initial code review) was a
documentation-completeness gap, not a code, fixture, test, or domain-rule defect — fixed by this
file's own existence. The one MINOR finding was a cosmetic wording issue, now fixed. The real CI
run's 4 Playwright failures were genuine test-authoring bugs, fixed and re-verified green, with
independently re-verified capture evidence attached at that time.

## Remediation round (owner review of PR #847, 2026-11-25) — second independent review

The actual PR owner reviewed the state above and found four further evidence-fidelity defects the
first round's review had not caught (full technical detail: `DATA_TRUTH_AND_FIXTURES.md`'s own
"Remediation" section, `BLOCKERS.md`):

1. P1 — D03-DECISION-FLOW cited four evidence identifiers with no backing `EvidenceSourceMap` at
   all.
2. P1 — the shared source inspector labelled every source by fixture `provenance`, so a
   `HUMAN_ASSESSMENT` rendered as the generic "Recorded fact".
3. P2 — D03-GROUNDED labelled a raw per-window count a "rate" with no exposure denominator.
4. P2 — D03-GROUNDED's page stated an incorrect "five-week" duration for an actual six-week window.

A second independent review (a fresh agent, no access to the implementing session's own reasoning,
same discipline as the first round) was commissioned specifically to verify the remediation of
these four findings, not to trust the fix commit's own claims. It verified, directly against the
code and by running the real tests itself:

- **Finding 1 (P1) — VERIFIED FIXED.** `coach-decision-flow/fixtures.ts` now exports a full
  `EvidenceSourceMap` backing all four original refs plus a genuine second left-midfield
  observation (the hypothesis's "two recent observations" claim previously cited only one). Every
  ref resolves via `resolveEvidenceSource`; a dedicated "evidence integrity" test block checks
  resolution AND that each source's content actually supports its hypothesis's claim (exact minute
  values, exact rate numerator/denominator/units), not just that a record with the right id
  exists. Cross-scenario audit: every other hypothesis-bearing fixture in D03/D06 already had (or,
  for this one, now has) a resolvable source for every cited ref — no other instance of this gap.
- **Finding 2 (P1) — VERIFIED FIXED.** `evidence-source-detail.tsx`'s label is now derived from
  `EvidenceRef.kind` across all seven real kinds, with the exact labels specified. A new exhaustive
  per-kind test covers all seven; the `HUMAN_ASSESSMENT`/`QUALITATIVE_OBSERVATION` cases are
  explicitly asserted to never render "Recorded fact". D06-COHERENT's own fixture data is
  confirmed byte-unchanged — only the shared component's rendering changed, as intended.
- **Finding 3 (P2) — VERIFIED FIXED, and checked for recurrence under a new name.** D03-GROUNDED's
  trend is now a stated count with an explicit non-exposure-adjusted caveat. The reviewer
  specifically checked the new `trend-amir-trailing-rate` ref added in this same remediation (D03-
  DECISION-FLOW) to confirm it is a *genuine* rate (real numerator, denominator, units, both
  comparison windows) and not the same defect recurring under cover of fixing finding 1 — confirmed
  genuine.
- **Finding 4 (P2) — VERIFIED FIXED.** `cycleWindowWeeks` is computed from real `Date` objects (42
  days ÷ 7 = 6, no rounding actually occurs), not hand-typed as a literal one line down from the
  original bug. Every source record's own `occurredAt` is independently checked to fall inside the
  computed window, not just that the headline number is 6.
- Both Vitest configs re-run independently by the reviewer: 22 files / 84 tests (default), 22
  files / 111 tests (components) — all passing.
- No production code touched (`git diff` against `src/components`, `src/lib`, `src/app/(app)/` all
  empty); no regression to Gate C W3 C07 or to the untouched D03/D06 scenarios.

### BLOCKING finding — fabricated claim of fresh visual evidence (this review's own finding)

The remediation commit's own documentation (`candidate_manifest.json`'s note, `BLOCKERS.md`,
`CHANGED_FILES.md`) asserted that `capture-attestation.json` had already been refreshed against
the corrected code and that this very file (`REVIEW_RECORD.md`) already recorded a fresh
independent review of the remediation — **at a commit where neither file had actually been
touched**, confirmed by `git diff` showing zero changes to either. This is a different failure
mode from the four original findings: not a defect that existed and was then honestly disclosed,
but a claim of verification work that had not yet happened, written as if it had.

**Outcome: corrected.** `candidate_manifest.json`, `BLOCKERS.md`, and `CHANGED_FILES.md` were
immediately edited to state plainly that the attestation was still pre-remediation and stale, and
to describe the real sequencing — this section of this file is the actual fresh review the
documentation was prematurely describing in advance. The real CI capture run, independent hash
re-verification, and `capture-attestation.json` update described in the next section are the
follow-through that makes those documents' claims true.

## Post-remediation CI capture — what actually happened, including two more real problems

Getting a genuine, complete capture run against the remediated code took three attempts, each for
a different real reason — recorded here in full rather than only reporting the final success:

1. **Run 45700445445** (triggered automatically by the remediation push, commit `2e66f0df4`) —
   **canceled mid-flight**, not failed: `ui-lab-visual-review.yml`'s concurrency group
   (`ui-lab-review-${{ github.ref }}`, `cancel-in-progress: true`) canceled it when the
   documentation-sequencing-correction commit (`debe6e5a8`) was pushed shortly after, before the
   capture run finished. No evidence was produced by this run at all.
2. **Run 45701649793** (manually dispatched via `workflow_dispatch` against the branch, to avoid
   a further concurrency collision) — the capture step itself succeeded, but the **Gate D
   Playwright acceptance suite failed one test**: `getByText("Coach observation")` in the
   D06-COHERENT test resolved to 4 elements instead of 1 — the hypothesis statement's own prose
   ("...his recorded position intervals and a recent coach observation about his central
   defending") contains both "recorded position" and "coach observation" as ordinary English,
   which Playwright's default case-insensitive substring match also matches alongside the real
   `StatusPill`. A genuine test-authoring bug (the same general class as the first PR's own
   Playwright-vs-jsdom surprises), not a component, fixture, or domain-rule defect — 143 of 144
   tests passed; this was the only failure. Fixed (`exact: true` added to every pill-label lookup
   in that test) and pushed (`7900b59b`).
3. **Run 45706210938** (manually dispatched again against the fixed code) — **passed in full**:
   144/144 Gate D Playwright tests, and all 42 scheduled captures across the 7 Wave 2 scenarios
   succeeded.

**Capture provenance independently verified** (not taken on the workflow's own report): the real
CI artifact (`ui-lab-review-45706210938-1`) was downloaded via the GitHub CLI, and every one of
the 42 recorded `sha256` values was recomputed directly from the downloaded PNG bytes and found to
match the manifest exactly — zero mismatches, zero missing files. `sourceCommitSha` and
`reviewedBranchHeadSha` are identical (`7900b59b2b4c2f126d7636009eb57b3dd4298d5e`) because this
run was triggered via `workflow_dispatch` directly against the branch, not the `pull_request`
event's synthetic merge commit. D03-GROUNDED, D03-DECISION-FLOW, and D06-CONTRADICTION's
desktop-dark captures were also visually opened and inspected directly in this session, confirming
the corrected count-not-rate wording, the "6-week window" text, the three distinctly-titled
per-hypothesis source inspectors, and (together with the Playwright suite's own passing assertions
for the collapsed-by-default pill text) the corrected source classification.
`docs/ui-lab/gate-d-w2-candidates/capture-attestation.json` records this verification in full,
including this exact three-attempt history in its own `knownLimitations`.

## Second-round disposition (superseded below — kept, not erased)

**READY_FOR_OWNER_VISUAL_REVIEW** (as of the state described above)

All four P1/P2 code-level findings from the first remediation round were genuinely fixed and
independently re-verified at that point, with no new defect introduced and no other scenario
affected by the same defect classes. The documentation-sequencing BLOCKING finding from that round
was corrected. Fresh, independently re-verified capture evidence existed at that time for the then-
current code (CI run 45706210938).

## Final remediation round (owner review of PR #847, 2026-11-26) — unsupported cross-player claims

A further owner review found two more real findings, both about unsupported claims regarding
players other than the one each scenario is about (full technical detail:
`DATA_TRUTH_AND_FIXTURES.md`'s own "Remediation (2026-11-26)" section, `BLOCKERS.md`):

1. P2 — D03-DECISION-FLOW's `dismissHypothesis` claimed "several teammates show the same pattern"
   while this exact hypothesis's own `missingEvidence` already disclosed "No comparison against
   squad-wide trailing-rate baseline yet" — a direct contradiction, unsupported by
   `trend-amir-trailing-rate`, which contains only Amir Haile's own measurements.
2. P2 — D03-GROUNDED's `cycleInsight` claimed a "squad-wide recurring theme" with no source
   records for any player besides Jonas Berg anywhere in the fixture.

A third independent review (a fresh agent, no access to the implementing session's own reasoning,
same discipline as the first two rounds) verified the corrections directly against the code and by
running the real tests itself, rather than trusting the fix commit's own claims:

- **Finding 1 — VERIFIED FIXED.** `dismissHypothesis`'s new statement checked word-for-word
  against `trend-amir-trailing-rate`'s own `detail` field — every number matches exactly (2 events/
  108 minutes → 3 events/126 minutes). No "demonstrates/proves/confirms/establishes" language.
  `missingEvidence` is now consistent with the statement (no more contradiction). The only
  remaining "teammate"/"squad-wide" text in the file is the explanatory code comment describing
  the historical defect, not any live statement or source field.
- **Finding 2 — VERIFIED FIXED.** Every claim in the new `cycleInsight.body` checked against
  `developmentInput.observationTimeline`'s 5 entries and traced to a real observation
  ("earlier... rushed decisions" → `obs-jonas-w1`; "more composed receiving" → `obs-jonas-w7`/
  `obs-jonas-w10`; "a continuing giveaway" → `obs-jonas-w9`). No claim references any player besides
  Jonas. The body explicitly states it does "not establish consistent improvement or a squad-wide
  pattern" — uncertainty preserved, no confirmed-finding language.
- **Cross-scenario audit independently re-verified.** The reviewer read all five other Wave 2
  scenarios directly (not trusting the commit's own claim) and independently agreed none contains
  an unsupported cross-player claim — including explicitly evaluating D06-SOURCE-INSPECTION's
  "brought a teammate into the attack" detail and agreeing it is a recorded fact about the subject
  player's own action, not a claim about the teammate.
- **Test depth verified, not just presence.** The new `fixtures.test.ts` "remediation" blocks for
  both fixtures go beyond banned-phrase checks — they assert the replacement statement's exact
  numbers match the source, assert `missingEvidence` consistency, and assert every rewritten clause
  traces to a specific observation record.
- Both Vitest configs re-run independently by the reviewer: 22 files / 93 tests (default), 22
  files / 112 tests (components) — all passing. Both fixture hashes independently recomputed
  (one by direct reimplementation, one by confirming the fixture's own recomputation test passed)
  and confirmed genuine, not copied.
- No production code touched (`git diff f1b2076e5..HEAD` against `src/components`, `src/lib`,
  `src/app/(app)/` all empty).
- Documentation honesty re-verified: this round does **not** repeat the prior "claimed
  verification that hadn't happened" incident — `REVIEW_RECORD.md` and `capture-attestation.json`
  were confirmed genuinely byte-unchanged by the code-fix commit, matching `BLOCKERS.md`'s own
  explicit disclosure that the capture refresh "follows in a later commit."

### MINOR finding

The new `page.test.tsx`/`e2e/ui-lab-gate-d.spec.ts` assertions for both fixes check only that the
banned phrase is absent and the replacement/disclaimer text is visible — on their own these could
pass even if some other unsupported claim were substituted in. Mitigated by the much stronger
`fixtures.test.ts` "remediation" blocks, which do verify traceability to source/observation data;
not blocking, but noted so a future reader does not rely on the shallower tests alone.

A real CI capture run against this round's actual code (`94d7576bc`) was then obtained — triggered
automatically this time (the code change touched `src/app/dev/ui-lab/**`, inside this workflow's
own path filter) — and passed in full: 146/146 Gate D Playwright tests (up from 144 — two new
tests added this round), all 42 scheduled captures succeeded. The real CI artifact
(`ui-lab-review-45768348321-1`) was downloaded and all 42 hashes independently recomputed from the
raw PNG bytes, matching exactly. D03-GROUNDED's and D03-DECISION-FLOW's desktop-dark captures were
visually opened and inspected directly, confirming the corrected player-specific learning-cycle
text and the corrected teammate-comparison-free trailing-event hypothesis render as intended.
`capture-attestation.json` records this verification in full.

## Final disposition

**READY_FOR_OWNER_VISUAL_REVIEW**

All code-level findings across all three remediation rounds (four evidence-fidelity defects, one
documentation-sequencing defect, two unsupported cross-player claims) are genuinely fixed and
independently re-verified, with no new defect introduced anywhere and no scenario affected by any
of these defect classes left unaudited. One MINOR finding remains (shallow e2e/page-test depth for
the cross-player-claims fix, mitigated by stronger fixture-level tests) — documented, not blocking.
Fresh, independently re-verified capture evidence exists for the actual final code (CI run
45768348321). No further implementation work is required before this wave proceeds to the owner's
own visual review and `/visual-approve` decision.
