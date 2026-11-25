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

## Final disposition

**READY_FOR_OWNER_VISUAL_REVIEW**

No BLOCKING findings. The one MAJOR finding (from the initial code review) was a
documentation-completeness gap, not a code, fixture, test, or domain-rule defect — fixed by this
file's own existence. The one MINOR finding was a cosmetic wording issue, now fixed. The real CI
run's 4 Playwright failures were genuine test-authoring bugs, now fixed and re-verified green,
with independently re-verified capture evidence attached. No further implementation work is
required before this wave proceeds through the remaining Visual Authority Gate steps (owner
review, `/visual-approve`) per `docs/development/coding-agent-working-session.md`.
