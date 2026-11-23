# Gate D W1 — Blockers

Missing capabilities, conflicts, and accepted limitations. Nothing here was resolved by this
wave's implementation — each is either an owner decision, a future ADR, or deferred scope.

## 1. Authority conflict — ADR-0139 vs. mandatory coach approval for primary-position changes

**Status: unresolved, owner decision required.**

`04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md` requires explicit coach approval before a primary
position changes. `ADR-0139` (Accepted) auto-promotes a player's primary position via
`runPostMatchLearning()` with no approval step. The source document itself flags this as an
"Existing repository tension (MUST resolve before implementation)" and `15_PLAYER_PROFILE_...`
separately references it as "previously agreed under Decision 4" — i.e. a product-level
agreement that has not yet been formalized as a repository ADR amendment or supersession.

**Why this is not an ARR** (per the `architectural-residue-records` skill's own exclusion): an ARR
records a mismatch between an *already-decided* intended architecture and current implementation.
Here, the only architecture this repository has actually accepted is ADR-0139's auto-promotion;
the approval requirement is a proposed future direction, not a decision already made that the
code has failed to catch up to. Filing an ARR would mean inventing a decision. The correct next
step is an owner decision, recorded as a new or amending ADR if adopted.

**Effect on Gate D**: blocks D07 (attribute evolution review) and D08 (primary position proposal
accept/reject) from this wave and likely the next, until resolved.

**Required to unblock**: an accepted ADR (new or amending ADR-0139) that either adopts the
approval-gate requirement or explicitly declines it for a stated reason.

## 2. Authority conflict — "14-role profile vocabulary" vs. ADR-0154's unified 24-code vocabulary

**Status: unresolved, owner decision required.**

The Gate D register's D01 and D08 acceptance questions assume a 14-role player-profile vocabulary
distinct from, and never conflated with, a 24-code sided tactical vocabulary
(`15_PLAYER_PROFILE_VS_TACTICAL_POSITION_CONTRACT.md`). `ADR-0154` (Accepted) deliberately unified
five previously incompatible position vocabularies — including declaration and tactical slots —
into **one** 24-code set. Direct repository verification (this session) found no production
14-role vocabulary; it exists only as a Gate A *directional study*
(`src/app/dev/ui-lab/gate-a/a06-position-pitches`, `a12-profile-editor`), never shipped.
`15_PLAYER_PROFILE_...` itself states: "Product requirement approved in conversation... No source
code or repository ADR has been changed... requires... deliberate reconciliation with ADR-0154."

**Why this is not an ARR**: same reasoning as §1 — this is a proposed future target explicitly
awaiting reconciliation, not an already-decided architecture the implementation diverges from.

**Effect on Gate D**: D01's candidates in this wave demonstrate the real, current architecture
(one vocabulary, provenance + support-band/confidence distinguishing declared from
evidence-derived) rather than the vocabulary split the register's literal question describes —
disclosed in `VISUAL_VS_CURRENT.md` and the candidate manifest's `knownGaps`, not silently
resolved. D08 remains blocked on this ground in addition to §1's.

**Required to unblock**: an owner decision — either adopt the 14-role profile tier (requiring a
new/amending ADR against ADR-0154 and real implementation, not a UI Lab fixture) or treat the
Gate D register's D01/D08 acceptance questions as stale and revise them against the accepted
ADR-0154 architecture.

## 3. Register gap — D05

`25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`'s Gate D block has no row with ID D05. This is confirmed
as a genuine gap in the source document, not an omission in this wave's recovery. No scenario was
invented to fill it. If D05 was intended to exist, that is an owner-side correction to the
register, not something this wave can supply.

## 4. Deferred scenarios (not blocked, just out of Wave 1's bounded scope)

- **D03, D06** (Assistant Coach cross-source hypothesis): classified
  `IMPLEMENTED_WITH_PRESENTATION_GAP` in `CURRENT_STATE_AUDIT.md` — real components exist, no
  authority conflict, but bundling AI-hypothesis presentation into the same wave as the non-AI
  evidence story (D01/D02/D04) would blur the evidence/assessment separation the mission brief
  itself requires (§4.2). Recommended for Wave 2.
- **D09** (free-text evidence lineage edit/retract): partially implemented, with a secondary
  dependency on the same mutation/audit-trail machinery implicated in §1. Not deep-audited in this
  wave because it was not a Wave 1 candidate either way.

## 5. Scope deviation — `scripts/ui-lab-visual-review.mjs`

This wave's implementation pass edited `scripts/ui-lab-visual-review.mjs` to register the six new
D01/D02/D04 capture routes (+28 lines). This is outside the strict
`src/app/dev/ui-lab/gate-d/**` / `docs/ui-lab/gate-d-w1-candidates/**` boundary given to that
implementation pass, but without it CI's capture job has no route to screenshot — the same
situation every prior gate's wave (including Gate C W3) resolved the same way. Reviewed and
accepted as consistent with established precedent; not a new pattern.

## 6. No capture-attestation.json yet

`capture-attestation.json` requires a real CI capture run against this branch's pushed commit.
It does not exist yet and must not be fabricated. It will be added once this PR's "Capture
fixture-backed UI Lab views" CI job completes successfully, following the same byte/sha256
verification discipline as Gate C W3.

## 7. No visual approval has been assumed

Every candidate's `approval` field in `candidate_manifest.json` is `null`. No `/visual-approve`
or `/visual-reject` comment has been or will be posted by this agent. All three candidates are
`CANDIDATE`, pending the owner's review.
