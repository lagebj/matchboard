# Gate D W1 — Blockers

Missing capabilities, conflicts, and accepted limitations.

**Update, 2026-11-23**: the product owner resolved §1 and §2 below in conversation (recorded in
PR #844), as a single coherent position/attribute mutation policy. The decision is now recorded in
**ADR-0160** (`docs/adr/0160-coach-approved-position-and-attribute-mutation-policy.md`), which
partially supersedes ADR-0139 and ADR-0092 and additively extends ADR-0154. **This resolves the
authority conflicts as decisions — it does not yet resolve them as production implementation.**
ADR-0160 explicitly does not change any schema, service, or write path; `sync-effective-position.ts`,
`player-evidence-service.ts`, and `Player.evidenceCutoverAt` remain exactly as they exist today
until separate implementation work lands. D07 and D08 are therefore reclassified from
`BLOCKED_BY_POLICY_OR_AUTHORITY` to `MISSING_PRODUCTION_CAPABILITY` for the actual review/approval
interaction (the policy is decided; the production UI and persistence for it do not exist yet) —
see the updated candidates below and `WAVE_SCOPE.md`/`VISUAL_VS_CURRENT.md` for how this wave
discloses that distinction.

## 1. Authority conflict — ADR-0139 vs. mandatory coach approval for primary-position changes

**Status: RESOLVED (decision). Not yet implemented in production.** See ADR-0160 §1–§3.

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

**Effect on Gate D**: previously blocked D07 and D08. Both are now in scope for this wave as
directional design candidates for the decided-but-unimplemented review/approval flow — see
`WAVE_SCOPE.md`. They are not production-component mounts for the approval interaction itself,
since no such production interaction exists yet; this is disclosed explicitly in each candidate's
`knownGaps` and in `VISUAL_VS_CURRENT.md`, following the same precedent as Gate A's own
`a06-position-pitches`/`a12-profile-editor` directional studies for a decided-but-unbuilt design.

**Resolved by**: ADR-0160 (new/amending ADR against ADR-0139, as this blocker originally required).

## 2. Authority conflict — "14-role profile vocabulary" vs. ADR-0154's unified 24-code vocabulary

**Status: RESOLVED (decision). Not yet implemented in production.** See ADR-0160 §6.

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

**Effect on Gate D**: D01's already-merged-candidate commit demonstrated the real, pre-decision
architecture (one vocabulary, provenance + support-band/confidence) with the mismatch disclosed
rather than resolved. That disclosure remains historically accurate for what was true when D01 was
built; it is not retroactively rewritten. D08's new candidates (this update) use the 14-role
profile vocabulary for proposal targets, per the now-decided direction, while disclosing that the
projection function itself does not exist in production yet (only as a Gate A directional study)
and so the fixture constructs profile-role labels directly rather than calling a real production
projection function.

**Resolved by**: ADR-0160 (adopts the 14-role profile tier as intended architecture; additively
extends ADR-0154 rather than superseding it). Real implementation of the projection module itself
remains required future work, not performed by this wave.

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
  itself requires (§4.2). Still recommended for Wave 2 — the owner's 2026-11-23 decision did not
  touch this deferral.

**Update, 2026-11-23**: D09 is no longer deferred. Per the owner's explicit decision #6
("D09: PROCEED INDEPENDENTLY... does not need to wait for D07/D08"), and a corrected audit finding
real supersession machinery already in production (`qualitative-evidence-service.ts`,
`supersededAt` marking on resubmission — ADR-0152's governed-learning loop), D09 is added to this
wave's scope as a candidate exposing that existing lineage, not a new supersession model.

- **D07's manual-edit/lock + attribute-level-rebase state** (ADR-0160 §5) was deferred as of
  2026-11-23. **Update, 2026-11-24**: built after all, per the owner's remediation brief, as
  `GATE-D-W1-D07-REBASE` — a directional state machine (no real schema; the real
  `Player.evidenceCutoverAt`-is-player-wide gap is disclosed, not fabricated into a fictional
  per-attribute column).

## 8. Remediation (2026-11-24): five acceptance-fidelity defects found and fixed

An owner review of the pushed PR (commit `77385c745`) found specific defects in the implemented
candidates, not in the overall approach. All five are fixed; none required relaxing an acceptance
contract. See `VISUAL_VS_CURRENT.md`'s "Acceptance classification" table for the full
design/production/operational breakdown per scenario.

1. **D01 disclosed a mismatch instead of demonstrating the approved experience.** The original
   candidates mounted the real 24-code production components and disclosed that the 14-role tier
   doesn't exist in production — true, but insufficient: D01's acceptance question requires
   *demonstrating* the approved 14-role experience, not just disclosing its absence. Fixed by
   adding a directional `ProfileRoleSummary` alongside the unmodified production mount.
2. **D02 showed exact shares, not profile-level consolidation.** The original fixture displayed
   CB 58% / RCB 25% / CDM 17% — a valid exact breakdown, but not the profile-level aggregation
   (CB 83% / DM 17%) D02's own name and acceptance question require. Fixed with a real, tested
   24-to-14 aggregation, keeping the exact breakdown accessible via drill-down. Also surfaced a
   deeper finding in the process: production's real `buildEvidenceStories()` never populates
   `positionShares` with any data at all — recorded in `VISUAL_VS_CURRENT.md`, not previously known.
3. **D07's material-approval fixture violated ADR-0160 §4's own math.** Three automatic one-point
   steps (6→7→8→9) reached +3 cumulative before requiring approval; the policy requires approval
   at +2. Fixed: baseline 6 → current-applied 7 (the one legitimate automatic step) → proposed 8
   (correctly pending approval at +2 cumulative), backed by a new independently-tested
   `materiality-policy.ts` module.
4. **D08's "conflicting" note didn't conflict.** The note ("prefers staying tucked in") actually
   supported the proposed `RWB→RB` move. Fixed with a note raising a genuine, position-relevant
   defensive concern that creates real tension with the proposal.
5. **D09's coverage was partial.** Added simulated Edit/Retract interactions and a new
   `GATE-D-W1-D09-AMBIGUOUS` scenario demonstrating the real `validateExtractionSemantics`
   rejection rule (an unresolvable player reference discards the whole extraction, never a
   kept-but-ambiguous observation). One gap remains genuinely disclosed, not fabricated: the real
   schema has no field for the original raw submitted source text, only each observation's
   structured `statement` — "source-wording preservation" is demonstrated at that level, not as a
   byte-identical original-submission record.

**Still required, not yet done** (see §6, §9, §10 below): a fresh CI capture run against the
remediation commit (the prior capture, from commit `77385c745`, is now stale for every corrected
scenario), a new `capture-attestation.json` from that run, a dedicated Gate D Playwright suite, and
a second independent review specifically against the remediation brief's 10 verification
questions.

**Self-discovered sixth defect, found during capture-screenshot inspection (2026-11-24, not in the
owner's original remediation brief):** `GATE-D-W1-D01-DIVERGING`'s `currentStory` fixture used the
real production `POSITION_EVOLUTION`-sourced headline ("Recorded primary position updated to Right
Back... (previously Centre Back)") — but that exact copy, in `selectPlayerCurrentStory()`, is only
ever emitted when a position change has *already been applied* (today's pre-ADR-0160 production
reality). Pairing it with `player.primaryPosition: "CB"` (still declared) and the new
`ProfileRoleSummary`'s own "no automatic primary-position mutation occurs" disclosure produced a
visibly self-contradictory screenshot — caught only by actually looking at the rendered capture,
not by any test. Fixed by switching the fixture to an `OPPORTUNITY`-sourced headline (matching the
sibling `agreeing-positions` fixture's own convention), which makes no claim about the primary
position at all. `fixtureVersion` bumped 2→3; `fixtureSha256` recomputed. This is exactly the kind
of defect §10 of the remediation brief asked us to catch by inspecting actual screenshots rather
than trusting that files exist.

## 9. Browser-level (Playwright) coverage was missing

The original wave had component tests and a successful CI capture, but no dedicated
Playwright/browser-level assertions for any Gate D interaction (simulated accept/reject/defer/
edit/retract, `next-action` header absence, responsive overflow). Required by the owner's
remediation brief §8; being added as part of this remediation pass — see `CHANGED_FILES.md` for
the exact new spec file once it lands.

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
or `/visual-reject` comment has been or will be posted by this agent. All eleven candidates
(D01/D02/D04's original six, plus D07/D08/D09's five) are `CANDIDATE`, pending the owner's review.
