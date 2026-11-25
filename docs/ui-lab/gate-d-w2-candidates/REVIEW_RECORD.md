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

## Final disposition

**READY_FOR_OWNER_VISUAL_REVIEW**

No BLOCKING findings. The one MAJOR finding was a documentation-completeness gap, not a code,
fixture, test, or domain-rule defect — it is fixed by this file's own existence. The one MINOR
finding was a cosmetic wording issue, now fixed. No further implementation work is required
before this wave proceeds through the Visual Authority Gate (CI capture, then owner review) per
`docs/development/coding-agent-working-session.md`.
