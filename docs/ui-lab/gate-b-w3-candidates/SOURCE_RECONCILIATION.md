`CANDIDATE` only.

## Sources recovered

- The B06 register row — recovered from `docs/ui-lab/gate-b-w1-candidates/SCENARIO_REGISTER.md`'s
  own verbatim extract (the original `.matchboard-work/` handoff CSV is not present in this
  checkout). Reproduced again, unmodified, in `SCENARIO_REGISTER.md` above.
- `docs/ui-lab/gate-b-w1-candidates/` (B01-B04) and `docs/ui-lab/gate-b-w2-candidates/` (B05) —
  read in full: every doc file, `candidate_manifest.json`, `capture-attestation.json`, and the
  source under `src/app/dev/ui-lab/gate-b/b01-planned-ready/` and
  `src/app/dev/ui-lab/gate-b/b05-post-match-report/` (page.tsx, fixtures.ts, shared/report-data.ts,
  tests) — the template this wave's doc set and code structure follow.
- ADRs read in full, for what each is authoritative for:
  - **ADR-0011** (`docs/adr/0011-event-match-and-category-stats.md`, status Proposed) — the
    decision that `EventMatch` is a distinct model from `Match`, not a polymorphic extension:
    separate ownership chains (`MatchRound`/`Team` vs `EventSquad`/`Event`), separate report
    tables. This is the authority for "do not pretend League and Event matches are the same
    database entity."
  - **ADR-0147** (`docs/adr/0147-match-details-and-post-match-report-lifecycle-surfaces.md`,
    Accepted) — defines League's own BEFORE/AFTER and DRAFT/COMPLETED surface-state vocabulary.
    Scoped entirely to League's root Match Details route; does not mention Event.
  - **ADR-0152** (`docs/adr/0152-coach-learning-loop.md`, Accepted, delivered incrementally) —
    unifies League and Event on the *lifecycle vocabulary* for Live Reporting/Today/Match
    Details, and introduces the shared guided debrief (`PostMatchDebrief`) used by both origins.
    Documents the real, now-resolved gap (issue #686) that Event once had no Today/live-now
    lifecycle parity at all.
  - **ADR-0158** (`docs/adr/0158-convergence-bundle-residue-after-adr-0157.md`, Accepted,
    delivered) — closes issue #686 by adding lifecycle-awareness to the *existing*
    `event-matches-tab.tsx` surface, explicitly **without** creating a new dedicated route. Adds a
    parity contract test suite asserting "equivalent football semantics, not identical rows" —
    the authority for this wave's own "preserve real domain differences" stance.
  - **ADR-0159** (`docs/adr/0159-visual-authority-gate-and-deliberate-pr-review-deployments.md`,
    Accepted, Stage B active) — the Visual Authority Gate process this wave's PR follows.
  - **ARR-0034** (`docs/arr/0034-league-event-post-match-ui-not-consolidated.md`, state
    Resolved) — the UI-editing capability *is* already unified: League's `PostMatchPage` and
    Event's `EventMatchReportPanel` both wrap the same shared `PostMatchReportShell`. League
    keeps League-only `extraSections` (planned-squad diff, structured absence, player stats);
    Event keeps its own (`PostMatchDebrief`, `FootballObservationSection`, locked-only
    `MatchCombinationEvidencePanel`) — a documented decision, not silent scope-narrowing. This is
    the single most load-bearing source for this wave's core finding (see below).
- Production source read directly (not summarized secondhand): `src/app/(app)/o/[orgSlug]/
  matches/[matchId]/page.tsx`, `match-detail-shell.tsx`, `before-match-overview.tsx`,
  `after-match-overview.tsx`, `post-match-report-page-shell.tsx`, `src/lib/matches/
  match-detail-view-model.ts`, `src/lib/selection/planning-boundary.ts`; `src/app/(app)/events/
  [eventId]/event-detail.tsx`, `event-matches-tab.tsx`, `event-match-lineup-panel.tsx`,
  `event-match-report-panel.tsx`, `src/lib/events/event-match-eligibility.ts`,
  `event-planning-boundary.ts`; `src/components/matches/post-match-report-shell.tsx`,
  `src/components/matches/match-detail/match-identity-card.tsx`,
  `src/components/touchline/pitch/planning-pitch-assignment-projection.ts`,
  `src/lib/reports/post-match-report-view-model.ts`.

## Authorization basis

This wave was picked up directly from the Gate B W3 mission brief, which names the B06 register
row, instructs recovering the original programme register (done, via the W1 document), and
explicitly forbids starting production migration, B07, B08, or Gate C. All work in this PR stays
inside `src/app/dev/ui-lab/` and `docs/ui-lab/gate-b-w3-candidates/`.

## The framing decision

**League Before/After: `CONFIRMS_SHIPPED_BASELINE`.** League already has a dedicated Match
Details route with a real BEFORE/AFTER composition (B01-B05 already candidate this). This wave's
League pages reuse that same real composition with a fresh match identity, purely as the
comparison baseline — they do not propose anything new for League.

**Event Before/After: `DESIGN_PROPOSAL`, explicitly not production-shipped.** Event has no
dedicated Match Details route at all — lineup planning and report editing both live inline on
Event Detail's Matches tab. This wave's Event pages compose a UI-Lab-local standalone layout from
real production pieces (`MatchIdentityCard`, the real `buildPlanningPitchAssignments`
projection, the real shared `PostMatchReportShell`) to make a fair side-by-side comparison
possible, and explicitly discloses on both pages that this layout does not exist in production
and is not authorized by this PR. ADR-0158 already closed the adjacent Today/live-now parity gap
**without** creating a new route (issue #686) — this wave does not relitigate that decision; it
raises a narrower, still-open question (whether Match Details itself, not just Today's live
slot, deserves a dedicated Event route) as a design question for the owner, not a foregone
conclusion.

## This wave's core finding

The editing *capability* is already unified (ARR-0034, resolved). What genuinely differs between
origins is the *information architecture*: League routes AFTER→dedicated tabbed `/post-match`
page; Event keeps everything — lineup and report alike — inline on one page's Matches tab, with
no match-scoped route at all. The return-destination consequence of that: League's "← Back to
match" always resolves to a match-scoped route (`/o/[orgSlug]/matches/[matchId]`); Event's
real handoff (`revalidatePath("/events/${eventId}")`, confirmed via this wave's own audit of
`event-live-report-handoff.ts`) returns the coach to the Event's own page, not a route scoped to
this specific match. Both candidates disclose this difference explicitly (`DecisionBanner`s on
the League · After and Event · After pages) rather than hiding it behind a visually-consistent
shell — see VISUAL_VS_CURRENT.md.

## What this PR does not decide

- Whether Event should get a dedicated Match Details route in production. Left open, with the
  design proposal available for the owner to react to.
- B07 and B08 (deferred, not deleted from scope — see SCENARIO_REGISTER.md).
- Gate C.
- No `APPROVED_GOLDEN` status is claimed anywhere in this wave — every candidate's
  `candidate_manifest.json` entry has `status: "CANDIDATE"` and `approval: null`. The Visual
  Authority Gate (ADR-0159) has not yet run against this PR's revision.
