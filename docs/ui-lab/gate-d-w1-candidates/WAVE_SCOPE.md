# Gate D — Wave 1 Scope

## Selected scenarios: D01, D02, D04

These three together form "what Matchboard currently knows about this player, without AI" — the
Overview, Evidence, and Matches tabs of Player Detail, all driven by deterministic, declared, or
recorded data (positions, trend stories, match participation). None of the three touches the
Assistant Coach advisory surface or any mutation/approval flow.

They belong together because:

1. They are the same route (`src/app/(app)/o/[orgSlug]/players/[playerId]/page.tsx`) and the same
   user journey — a coach moving between tabs on one player to answer "what do we know."
2. Per `CURRENT_STATE_AUDIT.md`, all three are `IMPLEMENTED_WITH_PRESENTATION_GAP` or
   `PARTIALLY_IMPLEMENTED` against real, already-wired production components
   (`PlayerPositionProfile`, `player-position-map-widget`, `EvidenceStory` with a live `TREND`
   group, `PlayerMatchTimeline`) — no new business capability is required to mount them.
3. None depends on resolving the ADR-0139 / mutation-contract conflict (§4 of
   `SOURCE_RECONCILIATION.md`), so none is blocked.
4. They have deterministic, synthetic, fully-typed fixture inputs available from existing
   production type contracts (position profile, trend story, match history), satisfying the
   fixture-safety requirement without inventing new persistent types.
5. They minimize cross-gate dependency: Gate A–C's precedent components (Touchline tokens,
   EvidenceStory, fixture-identity pattern) cover them directly.

## Deferred scenarios and reasons

| ID | Reason for deferral |
|---|---|
| D03 | `IMPLEMENTED_WITH_PRESENTATION_GAP`, but belongs with D06 as the Assistant Coach / AI-hypothesis family — a distinct concern from the non-AI evidence story in Wave 1 (per mission brief §4.2, evidence and AI hypothesis are different forms of knowledge and should not be bundled into one wave just because the tab is adjacent). Candidate for Wave 2. |
| D06 | Same reasoning as D03 — groups naturally with it, not with D01/D02/D04. Candidate for Wave 2. |
D05 does not exist in the register (confirmed in `SOURCE_RECONCILIATION.md` §3) and is not
assigned to any wave.

This table originally deferred D07, D08, and D09 as blocked. **Update, 2026-11-23**: the product
owner resolved the blocking authority conflict as a decision (ADR-0160) and explicitly instructed
continuing this same wave with D07 and D08, plus D09 independently. See "Wave 1 extension" below —
this is additive to the original three-scenario scope above, not a replacement of it.

## Wave 1 extension (2026-11-23): D07, D08, D09

### Why these are added now, and what changed

ADR-0160 resolves the policy question that previously blocked D07/D08 (`BLOCKERS.md` §1–§2). It
does **not** implement the review/approval UI or persistence — `sync-effective-position.ts`,
`player-evidence-service.ts`, and `Player.evidenceCutoverAt` are unchanged in production. D07 and
D08 are therefore `MISSING_PRODUCTION_CAPABILITY` for the actual review interaction, not
`IMPLEMENTED_WITH_PRESENTATION_GAP` — there is no existing production component to mount for
"accept/reject a pending proposal," because no such production interaction exists yet.

These candidates are **directional design candidates for a decided-but-unimplemented policy**,
following the exact precedent Gate A already set for the same situation
(`src/app/dev/ui-lab/gate-a/a06-position-pitches`, `a12-profile-editor` — directional studies for
the 14-role profile tier before any production implementation existed). They reuse real,
unmodified presentational primitives wherever the primitive genuinely already exists (e.g.
`AssessmentHistoryPanel` for history display, `EvidenceStory`-family components for evidence
citation, the real confidence/support-band vocabulary), and clearly mark any new review/approval
container or interaction as proposed design, never as an existing production flow. This must be
disclosed explicitly in each such candidate's `knownGaps` and in `VISUAL_VS_CURRENT.md` — not
blended in as if it were the same kind of candidate as D01/D02/D04.

D09 is different: a corrected audit (prompted by the owner's decision #6) found real supersession/
provenance machinery already shipped (`qualitative-evidence-service.ts`'s `supersededAt` marking
on resubmission, ADR-0152's governed-learning loop). D09's candidate should therefore lean toward
the D01/D02/D04 pattern — mounting real components/data shapes — rather than the directional
pattern, to the extent that existing lineage display components exist; if a real display component
does not already exist, that specific gap must be disclosed rather than assumed away.

### Minimum states, using ADR-0160's actual decided thresholds (not hypothetical)

- **D07** (attribute evolution review): a non-material automatic example (≤1 point, ≥3 matches,
  confidence ≥0.7, auto-applied, shown as `AUTOMATIC` in the real history presentation) and a
  material example (≥2 cumulative points from baseline, pending coach review — before/after,
  evidence, confidence, accept/reject, clearly simulated). A manual-edit/lock state demonstrating
  attribute-level (not player-level) rebase is valuable if it fits within the wave's bound; defer
  it explicitly if not, rather than build it hastily.
- **D08** (primary position proposal): a proposal with strong, unambiguous evidence, and a proposal
  with a conflicting note (echoing D01's divergence fixture, now framed as a formal reviewable
  proposal) — both must target a 14-role profile code (never a sided/central tactical code like
  `LCB`/`LAM`) as the proposed primary, per ADR-0160 §6, and must disclose that the profile
  projection itself is constructed directly in the fixture, not called through a real production
  projection function (none exists yet).
- **D09**: at least one state showing an original coach-authored observation, a superseded/
  retracted version, and the active current version with clear provenance — built from real
  qualitative-evidence types and the real supersession field if a presentable real component
  exists; disclose plainly if it has to be assembled from real data shapes without an existing
  display component.

### What remains unchanged from the original Wave 1 decision

D03/D06 remain deferred to Wave 2 (§ above). D05 remains nonexistent. The implementation boundary
from ADR-0160 applies in full: no schema change, no service change, no real Server Action, no real
persisted proposal — UI Lab only, exactly like the rest of this wave.

## Component owners

- `src/app/(app)/o/[orgSlug]/players/[playerId]/page.tsx` — `OverviewTab`, `EvidenceTab`,
  `MatchesTab` sections (route/page owner).
- `src/lib/touchline/presentation/player-overview-view-model.ts` — D01 data shape.
- `src/components/players/player-position-profile.tsx` — declared-position presentation (D01).
- `src/components/touchline/pitch/*` (`touchline-position-map.tsx`, `position-evidence-dot.tsx`,
  `player-position-map-widget.tsx`) — position visualization (D01, D02).
- `src/lib/touchline/presentation/player-evidence-view-model.ts` — D02 data shape.
- `src/components/touchline/evidence/evidence-story.tsx` — D02 presentation.
- `src/components/touchline/player/player-match-timeline.tsx` — D04.

## Data and fixture dependencies

Each candidate fixture is a synthetic, labelled (`sourceClass: "SYNTHETIC_LABELED"`) construction
of the real view-model/component input types above — no new persistent types, no new Prisma
models. Fixtures follow the Gate C W3 pattern: a `FixtureIdentity` plus typed objects, with a
`rawRecordsForHash` the candidate's test recomputes rather than hand-copies.

Specific fixture states needed per scenario (minimum set; see `SCENARIO_REGISTER.md` for the
full matrix):

- **D01**: a player with both a coach-declared position profile and resolved `effectivePositions`
  that agree, and a second fixture where they diverge — to prove the two are never visually
  conflated.
- **D02**: a player with populated `TREND`, `POSITION`, and `OPPORTUNITY` stories, and a sparse
  variant where some groups render the insufficient-evidence (`confidence: null`) state rather
  than a fabricated value.
- **D04**: a match history with some matches carrying full minute data and others with unknown/
  partial minute coverage, to exercise the "not-recorded minutes" acceptance question.

## Known implementation constraints

- Server Component → Client Component boundary: per the Gate D mission brief §6 and the Gate C
  W3 fixtures.ts precedent, any simulated interaction handler must be constructed inside the
  client boundary, never passed as a function prop from the server `page.tsx`. None of D01/D02/D04
  are expected to need a mutation handler at all (they are read-only presentation), which further
  reduces this risk for Wave 1.
- Tenant-context re-establishment (`establishTabTenantContext`) is a real production pattern per
  tab; UI Lab fixtures must not attempt to exercise real tenant context and instead mount the
  presentational components directly with fixture data, consistent with every prior Gate A–C
  candidate.

## Expected visual evidence

Per the register: D01 at desktop dark + mobile dark, D02 at desktop light + mobile light, D04 at
mobile dark + desktop light — six capture combinations minimum across the three scenarios, each
with at least one populated-data and one sparse/partial-data state. No additional viewport/theme
combinations are added as normative; wider coverage, if included, is explicitly non-normative
per the mission brief §7.

## Acceptance questions this wave will answer

- D01: Does Player Detail Overview combine declared and actual position evidence into one
  identity-and-development story without ever rendering a 14-role profile code as if it were a
  sided/central tactical code (XR-P01, XR-P04, XR-V01)?
- D02: Does the Evidence tab consolidate position-evidence dots at the profile level without
  losing the ability to drill into exact sided data or silently double-counting evidence
  (XR-P03, XR-A03)?
- D04: Does the Matches tab make unknown/unrecorded minute coverage visible rather than implying
  full coverage by omission?

## What this wave will NOT prove

It will not demonstrate Assistant Coach cross-source hypothesis presentation (D03/D06), deferred to
Wave 2. For D07/D08, it demonstrates the *decided design direction* (ADR-0160), not a working
production review/approval feature — no real Server Action, no real persisted proposal, no real
schema change. It will not touch production routes, domain services, or Prisma schema anywhere in
this wave, original or extended.
