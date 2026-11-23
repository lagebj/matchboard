# Gate D W1 — Visual vs. Current

What already exists in production, what this wave's candidates demonstrate, and — for D01 — a
disclosed mismatch between the register's acceptance question and the current accepted
architecture. Classifications below restate `CURRENT_STATE_AUDIT.md`'s findings against what the
implemented candidates actually proved.

## D01 — Player Detail Overview, position evidence

**Already in production, unmodified**: `PlayerCurrentStoryCard`, `PlayerPositionMapWidget` →
`TouchlinePositionMap` → `PositionEvidenceDot`, `PlayerPositionProfile`. All three components are
mounted exactly as production uses them; nothing was rebuilt.

**What the candidate demonstrates**: declared and evidence-derived positions render side by side,
both using the real `canonicalFullLabel`/`exactPositionLabel` vocabulary, distinguished by
provenance (a declaration card vs. an evidence-derived pitch map) and by support-band/confidence —
never by a different code or label system for the same position.

**Disclosed mismatch (carried into `BLOCKERS.md`/future owner review)**: the official register's
acceptance question for D01 (and D08) assumes a "14-role profile vocabulary" that must never be
conflated with the 24-sided tactical vocabulary (register owner refs cite
`15_PLAYER_PROFILE_VS_TACTICAL_POSITION_CONTRACT.md`'s mapping table). Direct inspection of
`src/domain/positions/roles.ts` and `src/lib/player-form-options.ts` found no such second
vocabulary — ADR-0154 (Accepted) deliberately unified five previously-incompatible position
vocabularies (including a prior 12-code base-role set and a separate evidence-engine normalizer)
into one 24-code `CANONICAL_TACTICAL_POSITIONS` set used for declaration, tactical slots, actual-
position evidence, reporting, and AI context alike. This candidate therefore cannot visually
prove "no conflation between two vocabularies," because the second vocabulary the question assumes
does not exist. What it proves instead is the real, current distinction: one vocabulary, two
provenance tiers. This is a second authority conflict alongside the already-disclosed ADR-0139
one (`SOURCE_RECONCILIATION.md` §4) and needs the same owner-level resolution: either the Gate D
register's acceptance question is stale and should be revised against ADR-0154, or the programme
intends a genuinely new 14-role tier that does not exist in production yet (which would be a
`MISSING_PRODUCTION_CAPABILITY`, out of this wave's scope either way).

## D02 — Player Detail Evidence, position-dot consolidation

**Already in production, unmodified**: `buildPlayerEvidenceViewModel`, `EvidenceStory`,
`Sparkline`, `StackedDistribution`. The `TREND` group (ADR-0155 B6, closed by ADR-0157 C5) is
real and wired in production (`EvidenceTab`, `page.tsx` lines ~484-493) — not a stub, confirmed by
direct code reading before this wave began.

**What the candidate demonstrates**: the populated state shows all four groups with their real
confidence states and a position-share consolidation that keeps each exact sided code separately
named and non-overlapping (sums to 100%). The sparse state shows the real
insufficient-evidence (`confidence: null`) rendering and the real "omit an empty group entirely"
behavior — no fabricated placeholder.

**No disclosed mismatch.** The register's acceptance question for D02 matches what the current
architecture already provides; this candidate is closer to `ALREADY_IMPLEMENTED_AND_VERIFIED`
than `PARTIALLY_IMPLEMENTED` now that it has been built and tested against the real components.

## D04 — Player Detail Matches, minute coverage

**Already in production, unmodified**: `PlayerMatchTimeline`.

**What the candidate demonstrates**: a match with no recorded minutes at all, and a match with
recorded minutes but no recorded actual position, both render their real, honest state — never a
fabricated `0'` and never a position inferred from a plan. Full and partial coverage are visually
distinguishable within the same list.

**No disclosed mismatch.**

## D07 — Attribute evolution review (extension, 2026-11-23, directional)

**Already in production**: the automatic attribute-mutation accumulator and `AssessmentChange`
audit model (ADR-0092), now amended by ADR-0160 to add a materiality/approval layer on top.

**What exists vs. what's new**: `GATE-D-W1-D07-AUTOMATIC` reproduces real, already-shipped
behavior (`AssessmentHistoryPanel`'s rendering, mirrored over fixture data for the reason
disclosed in `DATA_TRUTH_AND_FIXTURES.md`). `GATE-D-W1-D07-MATERIAL` is **not** real production
behavior yet — `MaterialApprovalReview` is a directional design candidate for ADR-0160's decided
policy. No schema supports a "pending approval" state today (confirmed: `AssessmentChange` always
represents an already-applied change). This is explicitly disclosed, not blended with the
real-component candidates above.

## D08 — Primary position proposal (extension, 2026-11-23, directional)

**Already in production**: `ADR-0139`'s automatic candidate-identification computation
(unaffected by ADR-0160); the 14-role profile mapping (`collapseTacticalToProfile`, reused from
Gate A's `a12-profile-editor` directional study — not new to this candidate).

**What's new/directional**: the entire review/approval interaction (`PositionProposalReview`) does
not exist in production. ADR-0139's `evolvePlayerPositionProfile()` still writes automatically
today. Both states explicitly disclose this on-page and in the component's own header comment.

## D09 — Evidence lineage (extension, 2026-11-23)

**Already in production, unmodified data model**: `qualitative-evidence-service.ts`'s
supersession marking (`supersededAt`) — real, already-shipped (ADR-0152).

**What's new**: `EvidenceLineageDisplay` is a new presentational component — no existing
production component surfaces this lineage to a coach today (every real read helper filters to
active-only observations). This candidate exposes real data through new presentation, per the
owner's decision #6 ("exposing existing lineage... not another supersession model").
