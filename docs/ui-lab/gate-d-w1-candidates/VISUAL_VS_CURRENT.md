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
