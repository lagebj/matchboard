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
| D07 | `BLOCKED_BY_POLICY_OR_AUTHORITY` — depends on resolving the ADR-0139 vs. mutation-contract conflict. Not implementable truthfully today. |
| D08 | `BLOCKED_BY_POLICY_OR_AUTHORITY` — same conflict, more directly (primary-position approval vs. auto-promotion). |
| D09 | Secondary dependency on the same conflict family plus an only-partially-delivered ADR-0152 slice range; deferred pending both. |

D05 does not exist in the register (confirmed in `SOURCE_RECONCILIATION.md` §3) and is not
assigned to any wave.

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

It will not demonstrate Assistant Coach cross-source hypothesis presentation (D03/D06), any
mutation/approval review flow (D07/D08/D09), or resolution of the ADR-0139 conflict. It will not
touch production routes, domain services, or Prisma schema. It is a presentation-verification
wave over already-wired real components, not a new-capability wave.
