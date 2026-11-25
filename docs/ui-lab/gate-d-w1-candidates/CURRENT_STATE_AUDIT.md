# Gate D — Current State Audit

Audits what already exists in production on `main` (as of `43af5f186`, Gate C W3 / PR #843)
against each row of the Gate D register (`SOURCE_RECONCILIATION.md` §3). Classifications use the
mission brief's fixed vocabulary. Evidence is cited by file:line where a file was read directly in
this session; findings attributed to the recon forks are marked as such and were spot-verified
where load-bearing for a Wave 1 decision.

## Player Detail — structural baseline

`src/app/(app)/o/[orgSlug]/players/[playerId]/page.tsx` renders five tabs: Overview, Matches,
Development, Evidence, Manage. Each tab is a separate async Server Component that re-establishes
tenant context (`establishTabTenantContext`) because RSC tab continuations don't propagate the
tenant AsyncLocalStorage context. This is the single existing route for all player-detail
presentation — consistent with XR-I01/I02 (no new player-management page).

Declared vs. evidence-derived positions are already architecturally separated:
`PlayerPositionProfile` (`src/components/players/player-position-profile.tsx`) renders the
coach-declared triple with `confidence: "HIGH"` / `supportBand: "STRONGEST"` **hardcoded**,
because it is a declaration, not a measurement — with an on-page caption directing the coach to
the Overview tab for how declared positions and recorded match evidence combine. This directly
supports §4.4 of the mission brief.

## Row-by-row classification

### D01 — Player Detail / Overview

> **Update, 2026-11-24 (remediation)**: an owner review found that disclosing the mismatch below
> was not sufficient — the candidate must demonstrate the approved 14-role profile experience
> (ADR-0160 §6, adopted 2026-11-23), not only the real 24-code production mount. Corrected:
> `ProfileRoleSummary` now shows declared/evidence-derived profile roles directly, reusing the
> real `collapseTacticalToProfile()`. See `VISUAL_VS_CURRENT.md` and `DATA_TRUTH_AND_FIXTURES.md`.

`buildPlayerOverviewViewModel` (`src/lib/touchline/presentation/player-overview-view-model.ts`)
combines participation, opportunity, pre-resolved `effectivePositions`, active development
focus, latest observation, recent matches, and a `currentStory` selector attributed in code to
ADR-0157 C5. The data combination the scenario describes (declared + actual position evidence,
identity + development story) already exists end-to-end.

**Classification: revised to `BLOCKED_BY_SOURCE` for the scenario's literal acceptance question,
`IMPLEMENTED_WITH_PRESENTATION_GAP` for the underlying architecture it can truthfully
demonstrate.** Direct verification (see `SOURCE_RECONCILIATION.md` §4b) found that the "14 profile
codes never conflated with sided/central tactical labels" question assumes a second, 14-role
vocabulary that does not exist in production — `15_PLAYER_PROFILE_VS_TACTICAL_POSITION_CONTRACT.md`
itself discloses this is a future target pending reconciliation with the Accepted ADR-0154, which
unified all position vocabularies into one 24-code set. The real, current architecture — one
vocabulary, declared vs. evidence-derived distinguished by provenance and support-band/confidence
— is real, already wired, and is what Wave 1's D01 candidates demonstrate instead, with the
mismatch explicitly disclosed rather than papered over.

### D02 — Player Detail / Evidence

> **Update, 2026-11-24 (remediation)**: an owner review found the POSITION story's exact-sided
> breakdown was not profile-level consolidation. Deeper investigation found production's real
> `buildEvidenceStories()` never populates `positionShares` at all — the claim below that
> production evidence here is `ALREADY_IMPLEMENTED_AND_VERIFIED` is corrected: the trend/
> confidence/provenance semantics remain verified, but the POSITION share breakdown specifically
> was a real-rendering-path-but-unpopulated slot, not a verified populated example. Corrected:
> added a real 24-to-14 consolidation (`consolidateExactSharesByProfile`) as the primary view,
> exact breakdown as drill-down. See `VISUAL_VS_CURRENT.md` and `DATA_TRUTH_AND_FIXTURES.md`.

`buildPlayerEvidenceViewModel` (`src/lib/touchline/presentation/player-evidence-view-model.ts`)
groups stories into `OPPORTUNITY | POSITION | MATCH_CONTEXT | TREND`. Verified directly in this
session: the `TREND` group is **not a stub** — `EvidenceTab` in `page.tsx` (lines 472–534) calls
`getPlayerTrendStories(playerId)` and feeds real `DerivedTrend`-backed stories into it (lines
484–493). The view model's own header comment states this is ADR-0155 B6's data "surfaced here
for the first time" by ADR-0157 C5 — i.e. a capability ADR-0155 disclosed as computed-but-unrendered
has since been closed. Confidence is a closed `"Emerging" | "Established" | null` union; `null`
renders an explicit insufficient-evidence state rather than a fabricated value (file header
comment, lines 1–23) — this already satisfies the "no fabricated confidence" half of §4.3.

**Classification: `PARTIALLY_IMPLEMENTED`.** The trend/confidence/provenance semantics are
`ALREADY_IMPLEMENTED_AND_VERIFIED`. The specific acceptance question — profile-level position-dot
consolidation without losing exact sided drill-down or double-counting (XR-P03, XR-A03) — concerns
the Touchline position-dot components (`touchline-position-map.tsx`, `position-evidence-dot.tsx`),
which were not read in this audit; their consolidation behavior is unverified and is the real
open question for this scenario.

### D03 — Player Detail / Development–AI

`AssistantCoachHypothesisPanel` (`src/components/ai/assistant-coach-hypothesis-panel.tsx`) renders
`getPlayerAssistantCoachHypotheses` output; `getPlayerDevelopmentCycleInsight` feeds a "Learning
cycle" card. Capability gating states are real, named exactly `OFF/EMPTY/ERROR/STALE`
(`AdvisorPanelUnavailable`/`AdvisorPanelStale` in `src/components/ai/advisor-panel.tsx`) — this is
the same gating family Gate C W3 (C07) already exercised and captured.

**Classification: `IMPLEMENTED_WITH_PRESENTATION_GAP`.** The panel, insight, and gating states all
exist and are already proven in a UI Lab capture (Gate C W3). What's unverified for D03
specifically is the "cannot pad findings" acceptance question under genuinely sparse longitudinal
data — a fixture/behavioral question, not a missing-component question.

### D04 — Player Detail / Matches

`PlayerMatchTimeline` (`src/components/touchline/player/player-match-timeline.tsx`) exists and is
imported and rendered by the Matches tab in `page.tsx` (confirmed by direct grep in this session).

**Classification: `PARTIALLY_IMPLEMENTED`.** The component and tab exist; whether it currently
distinguishes "recorded matches" from "not-recorded minutes" as a visible coverage signal (rather
than just listing matches) was not read in depth and is the actual gap to verify or close.

### D06 — Assistant Coach cross-source hypothesis

Reuses the same `AssistantCoachHypothesisPanel` family as D03, now required to cite trend +
observation + position-history sources together against sparse data, with no invented
performance claims.

**Classification: `IMPLEMENTED_WITH_PRESENTATION_GAP`.** Each individual source (trends via D02's
`getPlayerTrendStories`, observations via `developmentThread`s, position history via
`position-usage-history`) is independently real and wired. Whether the hypothesis panel's existing
presentation already cites them jointly with explicit source-linking, or whether that's additional
presentation work, is unverified and is treated as the open question rather than assumed either
way.

### D07 — Attribute evolution review (auto-below-threshold / material-approval / manual edit)

> **Update, 2026-11-23**: the policy question below is resolved by ADR-0160 (owner decision).
> Reclassified to `MISSING_PRODUCTION_CAPABILITY`: the decided policy's review/approval UI and
> persistence do not exist in production yet. See `WAVE_SCOPE.md`'s Wave 1 extension.
>
> **Update, 2026-11-24 (remediation)**: the implemented `GATE-D-W1-D07-MATERIAL` candidate was
> found to contradict ADR-0160 §4's own cumulative-materiality math and has been corrected (see
> `DATA_TRUTH_AND_FIXTURES.md` and `VISUAL_VS_CURRENT.md`). The manual-edit/lock + attribute-
> level-rebase state (§5), previously deferred, is now implemented as `GATE-D-W1-D07-REBASE`.
> D07's classification remains `MISSING_PRODUCTION_CAPABILITY` for the real review/approval and
> per-attribute rebase machinery — only the UI Lab candidate's own fidelity to the decided policy
> was corrected, not the production gap itself.

**Original classification (preserved): `BLOCKED_BY_POLICY_OR_AUTHORITY`.** This scenario's acceptance question
("threshold-based, source-linked review; audit; undo when authorised") requires a believable
approval-tier UI. `ADR-0139` currently auto-promotes position-adjacent attributes with no approval
step, which is the exact conflict recorded in `SOURCE_RECONCILIATION.md` §4. Building this
candidate now would either (a) fabricate an approval gate that doesn't reflect what production
actually does, or (b) require changing production mutation behavior, which is outside this wave's
authorized surface (`02_AUTHORITY_SCOPE_AND_APPROVALS.md`). Deferred, not implemented.

### D08 — Primary position proposal (accept/reject)

> **Update, 2026-11-23**: both grounds below are resolved by ADR-0160 (owner decision).
> Reclassified to `MISSING_PRODUCTION_CAPABILITY`: the decided policy's proposal/review UI,
> persistence, and the 14-role profile-projection function do not exist in production yet. See
> `WAVE_SCOPE.md`'s Wave 1 extension.
>
> **Correction, 2026-11-24**: the implemented `GATE-D-W1-D08-CONFLICT` fixture initially did not
> satisfy its own acceptance intent — its "conflicting" coach note actually agreed with the
> proposed role rather than contradicting it. Corrected to a genuinely contrary observation; see
> `VISUAL_VS_CURRENT.md` and `DATA_TRUTH_AND_FIXTURES.md`. This is a defect in the candidate's
> fixture content, not a further classification change — `MISSING_PRODUCTION_CAPABILITY` above
> still stands for the review/approval interaction itself.

**Original classification (preserved): `BLOCKED_BY_POLICY_OR_AUTHORITY`, on two independent grounds.** The scenario's
acceptance question requires "coach approval; no exact-history write" (the ADR-0139 conflict,
same as D07) **and** a "14-role profile target" distinct from sided tactical codes (the ADR-0154
conflict — see `SOURCE_RECONCILIATION.md` §4b). Either conflict alone would block this scenario;
both are present. Deferred, not implemented, not silently reinterpreted to match either source.

### D09 — Free-text evidence lineage (edit/retract)

> **Update, 2026-11-23**: corrected on owner instruction (decision #6, "proceed independently").
> Direct code verification found real, already-shipped supersession machinery
> (`src/lib/evidence/qualitative-evidence-service.ts`: resubmission marks a prior extraction run's
> `supersededAt`, part of ADR-0152's governed-learning loop) — this is not blocked by the D07/D08
> mutation conflict at all; the two systems are independent. **Reclassified to
> `IMPLEMENTED_WITH_PRESENTATION_GAP`**: the supersession/provenance data model is real; what's
> unverified is whether a production UI already surfaces that lineage to a coach, which is what
> D09's candidate (see `WAVE_SCOPE.md`'s Wave 1 extension) now investigates and demonstrates.
>
> **Expansion, 2026-11-24**: the original candidate covered only explicit/tentative/superseded.
> Expanded with interactive Edit/Retract (reproducing the real resubmission/retraction mechanism
> locally) and a new scenario for the real ambiguous-reference-rejection behavior (zero
> observations, not a kept-but-ambiguous one). One disclosed gap remains:
> `IMPLEMENTED_WITH_PRESENTATION_GAP` still applies, but specifically for "does a production UI
> surface this" — the real schema also has no field for the original raw submitted text (only
> each observation's structured `statement`), so full byte-identical source-wording preservation
> cannot be demonstrated from real data as it exists today; this is now explicit rather than
> implied.

**Original classification (preserved): `PARTIALLY_IMPLEMENTED`, with a secondary
`BLOCKED_BY_POLICY_OR_AUTHORITY` dependency** — this coupling to D07/D08 is now known to be
incorrect; see the update above.

## Summary table

| ID | Classification | Wave 1? |
|---|---|---|
| D01 | BLOCKED_BY_SOURCE (literal question) / IMPLEMENTED_WITH_PRESENTATION_GAP (real architecture) | Yes, with disclosed mismatch |
| D02 | PARTIALLY_IMPLEMENTED | Yes |
| D03 | IMPLEMENTED_WITH_PRESENTATION_GAP | Deferred to Wave 2 |
| D04 | PARTIALLY_IMPLEMENTED | Yes |
| D06 | IMPLEMENTED_WITH_PRESENTATION_GAP | Deferred to Wave 2 |
| D07 | BLOCKED_BY_POLICY_OR_AUTHORITY | Deferred, blocked |
| D08 | BLOCKED_BY_POLICY_OR_AUTHORITY (two independent conflicts) | Deferred, blocked |
| D09 | PARTIALLY_IMPLEMENTED (secondary block) | Deferred |

D01 is retained in Wave 1 despite the `BLOCKED_BY_SOURCE` finding against its literal acceptance
question, because the real architecture it demonstrates instead (declared vs. evidence-derived
positions, one vocabulary, distinguished by provenance) is itself a genuine, valuable, truthful
candidate — and because disclosing a stale acceptance question with evidence is more useful to the
owner than silently deferring the whole scenario. This is a judgment call, recorded here rather
than assumed; see `BLOCKERS.md` for the owner decision this still requires.

No Gate D row is classified `MISSING_PRODUCTION_CAPABILITY` or `NOT_APPLICABLE` — every row has
real, substantially-wired production infrastructure behind it. This is consistent with Matchboard
already containing significant player-development functionality per the mission brief §2's own
architectural baseline note, and it shapes Wave 1 toward presentation verification of real
components rather than new capability-building.
