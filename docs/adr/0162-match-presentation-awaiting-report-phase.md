# ADR-0162: Match Presentation gains an `awaiting_report` phase — "FT" requires a locked report

## Status

Accepted.

## Date

2026-11-28

## Context

ADR-0125 §1 fixed the Match Presentation phase grammar: "Final → final score, `FT` + optional
`WON/DRAW/LOST`; `FT · Report incomplete` when the report is not yet complete." In practice,
`matchPresentationPhase()` (`src/lib/matches/match-presentation.ts`) implemented "final" as: the
lifecycle is `done`, `played`, or `report_incomplete`, **or** the presentation carries a non-null
`score` — whichever came first.

That is wrong in two different, compounding ways, both filed from Gate E W2 (PR #850) review:

- **Issue #853.** `played` (kickoff has passed, no report exists at all) and `report_incomplete`
  (a `DRAFT` report, or one `REPORTED` but not yet `LOCKED`) both rendered an unqualified `FT` —
  the exact class of bug `src/lib/selection/planning-boundary.ts`'s own doc comment already
  documents as a real recurring production incident (2026-09-17: "a match still hours from
  kickoff displayed 'Full time'"). `deriveMatchLifecycleStatus()` (ADR-0101) already distinguishes
  `played`/`report_incomplete`/`done` precisely for this reason; the presentation layer was
  discarding that distinction by falling back to score-presence.
- **Issue #852.** Unrelated layout defect in the same shared component (`ScorebookMatchRow`): the
  scheduled phase renders the kickoff time using the same Barlow Condensed "score" typography and
  fixed `w-[2.75rem]` lane as an actual numeric score. A 5-character time (`"12:40"`) is wider than
  that lane, so it visually overflows into the trailing `Scheduled` label at every tested width,
  and the away line's `shrink-0` date span squeezes the opponent name toward truncation on mobile.

League's `report_incomplete` conflates `DRAFT` and `REPORTED`-but-not-locked into one lifecycle
value (a report may already be submitted, just not locked) — the presentation layer has no finer
signal than that, and this decision does not invent one; the fix stays true for both cases rather
than splitting them further.

## Decision

- `MatchPresentationPhase` gains a fourth, non-final, non-scheduled value: `awaiting_report`
  (`"scheduled" | "live" | "awaiting_report" | "final" | "cancelled"`).
- `matchPresentationPhase()` is derived from `lifecycle` **alone**: `done` → `final`;
  `played`/`report_incomplete` → `awaiting_report`; `live`/`cancelled` unchanged; everything else
  → `scheduled`. A non-null `score` never promotes a presentation to `final` by itself.
- No variant may render a bare `FT` for `awaiting_report`. The canonical label is
  `awaitingReportLabel()` — the exact `"Played"` / `"Report incomplete"` words
  `lifecycleStatusConfigFor()` (`src/components/ui/status-badge.tsx`, ADR-0101's "User-facing
  lifecycle vocabulary") already uses for the lifecycle badge, so no new, uncoordinated term is
  introduced. A caller-supplied `reportAttention.label` (e.g. "Report missing") takes priority
  when a consumer has one.
- That label must be truthful at **every** supported width — no desktop-only qualifier hiding
  behind a bare `FT` on a narrow viewport (the original defect's mobile half, since the long-form
  qualifier was `medium:`-and-up only).
- A non-null `score` on an `awaiting_report` presentation is **not** withheld. The actual defect
  was the `FT`/final *label* implying a confirmed result, not the number's mere presence — several
  real surfaces intentionally show an in-progress score as transparent, honest feedback: the
  Post-Match Report editor's own live header (`MatchIdentityCard` inside
  `SafePostMatchReportShell`) tracks the score as the coach types it, and the AFTER tab's "Needs
  work" status pill sits next to the real current goals as a key figure
  (`AfterMatchOverview`). An initial implementation of this ADR withheld the score unconditionally
  and broke 7 already-passing tests across `gate-b/b08-information-ownership` and
  `gate-b/b05-post-match-report` that exercise exactly this editor-feedback behaviour — confirming
  it as existing, intended design, not something this correction should remove.
- **Amends ADR-0125 §1's "Final → ... `FT · Report incomplete`" line.** That wording is retired:
  `report_incomplete` (and `played`) are `awaiting_report`, never `final`, and never render `FT`.
- Issue #852's layout fix is a local styling correction to `ScorebookMatchRow`'s scheduled-row
  value lane (non-condensed typography, no fixed width for the kickoff time; the away-line date
  may wrap below the opponent name at the narrowest supported widths), not a phase-grammar change,
  and is not itself a durable architectural decision — recorded here only because it shipped in
  the same PR as the phase-grammar correction above.

## Consequences

- `src/lib/matches/match-presentation.ts` gains the `awaiting_report` phase value and the
  `awaitingReportLabel()` helper.
- Every production consumer of `matchPresentationPhase()`/`MatchPresentationPhase` was audited and
  updated to stop treating `awaiting_report` as `final`: `ScorebookMatchRow`, `MatchScoreHeader`,
  `OperationalMatchCard`, `LiveScoreStrip`, `MatchIdentityCard`, and the legacy
  `src/components/ui/match-presentation.tsx` variants (dev-only Atlas reference pages).
- One independent, pre-existing re-implementation of the same "unqualified FT" defect was found
  and corrected narrowly in place, outside the shared `MatchPresentation` contract:
  `TodayMatchday` (its own `TodayFootballMatch` type, not `MatchPresentation`) unconditionally
  rendered `FT` for its `POST_MATCH` phase, which also covers `played`/`report_incomplete`. It now
  uses the same `"Played"`/`"Report incomplete"`/`"FT"` vocabulary without adopting the shared
  contract wholesale (that migration is a larger, separate change if ever undertaken).
- No domain, lifecycle-derivation, report-persistence, or lock-semantics change.
  `deriveMatchLifecycleStatus()` (ADR-0101) is unchanged; this decision only changes how the
  already-existing lifecycle states are presented.
- Production Event Day's own lifecycle-*projection* defects (no live detection, `REPORTED`
  misclassified as `report_incomplete` instead of a completed result, unstable sort/NEXT marking,
  cancelled matches labelled `LATER` — `BLK-E02-01`, issue #851) remain explicitly out of scope;
  that is a separate, already-filed correction to `src/components/events/event-day-timeline.tsx`'s
  own lifecycle derivation, not a presentation-contract question.
- `ScorebookMatchRow` is a Visual-Authority-gated shared component (ADR-0159); the PR carrying this
  decision goes through that review process as usual.

## Related decisions

- Amends ADR-0125 (Reference Convergence — Match Presentation System) §1's final/`FT` phase rule.
- Builds on ADR-0101 (match lifecycle status vocabulary) — reuses its exact "Played"/"Report
  incomplete" labels rather than inventing new ones.
- Does not change ADR-0159/ADR-0161's Visual Authority Gate process.

## History

- 2026-11-28: Created. Fixes issues #852 and #853 (filed from Gate E W2 / PR #850 review).
