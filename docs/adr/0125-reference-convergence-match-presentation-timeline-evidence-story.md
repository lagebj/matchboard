# ADR-0125: Reference Convergence — Match Presentation variants, Operational Timeline, Evidence Story primitives

## Status

Accepted

## Context

ADR-0124 established adaptive contextual UI composition and named three reference
influences (chronological planners, NBA-style score apps, data-story apps) as *principles*.
A maintainer-approved follow-up bundle
(`.matchboard-work/matchboard-reference-convergence-programme/`) makes those influences
concrete enough that implementation does not have to finish the design:

- **Structured → Operational Timeline.** Today and event-day surfaces should present work
  on a single chronological rail (time column, rail, nodes, now/next/later/earlier
  treatment), not as a stack of dashboard cards.
- **NBA app → Match Presentation System.** One normalized display projection
  (`MatchPresentation`) rendered through exactly three variants — a dense divider-based
  scan row, a match-as-primary-object card, and a match-page header — with a stable
  right-aligned score/time value lane so a list of matches scans in ~2 seconds.
- **The Outsiders → Evidence Story System.** Each visualization answers one question with
  a primary fact, a comparator, a small visual, one neutral interpretation, evidence
  access, and an explicit insufficient-evidence state. Fixed story→primitive mappings.

ADR-0124 §5 said the canonical match grammar was "one canonical representation evolved
from the existing canonical component" without fixing its variant set or value-lane
geometry. ADR-0124 §7 fixed the evidence-visualization primitive set at **exactly six**
(`TrendSpark`, `DistributionBar`, `PeriodBars`, `RangeBand`, `DeltaMetric`, `MetricStory`)
and required an ADR amendment to add a seventh. The follow-up bundle's on-field
combination-evidence story requires a **paired factual outcome** encoding (goals-for vs
goals-against on the same scale, no ranking) that none of the six primitives provides.

## Decision

### 1. Match Presentation System

- **One projection.** `MatchPresentation` (`src/lib/matches/match-presentation.ts`)
  normalizes canonical match facts into display fields once: `homeTeam`, `awayTeam`,
  `ownTeamSide`, `kickoffDate`, `kickoffTime`, `lifecycle`, `score` (home/away oriented),
  `clockLabel`, `resultOutcomeForOwnTeam`, `outcomeLabel`, `planningAttention`,
  `reportAttention`, `cancelledReason`. `buildMatchPresentation()` re-orients
  our-team-relative facts into football home/away order. It changes no domain truth —
  lifecycle is still `deriveMatchLifecycleStatus()`, scores are still whatever canonical
  post-match/live data produced.
- **Exactly three variants** (`src/components/ui/match-presentation.tsx`), all rendering
  from `MatchPresentation`:
  - `MatchScoreRow` — dense, divider-based, no card border. League/Fixtures, the Today
    operational timeline, event-day timelines, results/history.
  - `MatchCard` — the match as the primary object with page context around it, one
    bordered card, date/time eyebrow above teams, one dominant action slot. Today
    next-action hero, Round Board / event selected-match summary.
  - `MatchHeader` — match-page identity; state readable before page-specific controls;
    compact stacks home/away with per-line value, expanded shows one inline
    `home  N : M  away` line.
- **Football order is always home then away.** The own team is never reordered to the
  front; it is marked only subtly (accent weight on its name). No team logo is required or
  shown — Matchboard has no canonical team-logo asset.
- **Stable value lane.** Score and kickoff time occupy the same right-aligned,
  fixed-width, tabular-numeral lane so a vertical list of matches aligns.
- Scheduled → kickoff time in the value lane, date subordinate, planning attention on the
  status line. Live → score in the value lane, `LIVE · <clock>`, no mutating controls in a
  list row. Final → final score, `FT` + optional `WON/DRAW/LOST`; `FT · Report incomplete`
  when the report is not yet complete. Cancelled → em dash, `CANCELLED`, never `0-0`.
- `MatchTicket` (`src/components/ui/match-ticket.tsx`) is removed. It was the score-row
  concept only, took our-team-centric props instead of the projection, and used a centre
  score lane and an always-on card border. `MatchScoreRow` replaces it.

### 2. Operational Timeline

- **One timeline system** (`src/components/ui/operational-timeline.tsx`):
  `OperationalTimeline` + `TimelineItem`, a structural time column + 2px rail + nodes, not
  a calendar product and not a task manager.
- Used on **Today** and **Event detail** (event-day flow). Match items inside the timeline
  render `MatchScoreRow`; the timeline owns time position, the match component owns
  teams/score/state.
- Temporal treatment: current/live item strongest with a filled node and its primary
  action available; `NEXT` normal with a hollow node; `LATER` quieter; earlier completed
  items muted and collapsible (at most two shown inline on compact Today, remainder behind
  an `Earlier today (N)` disclosure); an incomplete required follow-up (e.g. a missing
  post-match report) stays visible and is never auto-collapsed.
- Untimed work is never given a fake clock time — it is attached under its owning timed
  object or placed in a `Needs attention` block before `LATER`. No `--:--` in the time
  axis.
- Today compact order: title → context strip → dominant Next Action → `OperationalTimeline`
  → secondary weekly/coaching context → distant/upcoming. No detached metric grid ahead of
  Next Action (the "At a glance" tile row stays demoted below the operational flow,
  unchanged from ADR-0124 §6).
- Event detail leads with the event-day match timeline; squad/helper administration
  follows the temporal flow (or a secondary tab) unless it blocks the event.

### 3. Evidence Story System — seventh primitive and fixed mappings

- **`PairedOutcomeBar` is added as a seventh evidence-visualization primitive**
  (`src/components/viz/paired-outcome-bar.tsx`): two horizontal rows on the same scale,
  direct numeric labels, neutral semantic tokens, no red/green good-bad treatment, no
  ranking, required `question` prop and hidden text equivalent like every other primitive.
  It renders two canonical factual outcome measures for a combination/pattern (e.g. goals
  for vs goals against while a combination was on the field).
- The primitive set is now **seven**: `TrendSpark`, `DistributionBar`, `PeriodBars`,
  `RangeBand`, `DeltaMetric`, `MetricStory`, `PairedOutcomeBar`. A large chart dependency
  is still not added; an eighth primitive still needs an ADR amendment.
- **Fixed story→primitive mappings** (implementation must not substitute a different chart
  because another component is convenient; if canonical data is unavailable the story is
  omitted and the missing source recorded):
  | Story | Primitive |
  |-------|-----------|
  | Player recent opportunity | `MetricStory` + `TrendSpark` |
  | Player position exposure | `MetricStory` + `DistributionBar` |
  | Team match-phase pattern | `MetricStory` + `PeriodBars` |
  | On-field combination pattern | `MetricStory` + `PairedOutcomeBar` |
  | Planned rotation evidence | `MetricStory`, with `DeltaMetric` only when the engine supplies a comparator |
  | Position-pattern evidence | `MetricStory` + a supported small visual (`PeriodBars`/`PairedOutcomeBar`) |
- Every story: primary fact readable without the chart; comparator/sample context visible;
  one short neutral interpretation (`appeared` / `observed` / `more frequent in this
  sample`, never causal); `View evidence` access to existing provenance; explicit
  insufficient-evidence state using the engine's own confidence/sample rules. No player
  ranking, no radar charts, no overall player score, no good/bad colour scale.
- Player detail leads with identity → availability/attention → recent-opportunity story →
  position-exposure story → recent matches → observations → secondary attributes. It does
  not lead with an overall rating.

### 4. Visual grammar precision

The `.matchboard-work/matchboard-reference-convergence-programme/06_VISUAL_GRAMMAR.md`
values are folded into `docs/product/adaptive-interaction-design.md`: 4px spacing rhythm;
16px compact page padding; divider-based scan lists with reduced card chrome; minimal
shadows; primary score/value 24–32px; object names 15–17px; short status labels 11–13px;
no routine 9px UI text; icons only where they speed recognition; ~44×44px compact touch
targets; three timing classes (80–120 / 140–180 / ≤240ms); no perpetual animation; respect
reduced motion. Existing Matchboard colour tokens only — no reference-app colours.

## Superseded / amended prior decisions

- **Amends ADR-0124 §5.** The canonical match grammar is now the `MatchPresentation`
  projection plus exactly the three variants above, with a fixed right-aligned value lane
  and an explicit no-logo / subtle-own-team-marker rule. ADR-0124 §5's truthfulness rules
  are unchanged.
- **Amends ADR-0124 §6 (Today).** A single chronological `OperationalTimeline` is now a
  required structural element of Today and event detail, not an optional framing.
- **Amends ADR-0124 §7.** The evidence-visualization primitive set is seven, not six;
  `PairedOutcomeBar` is added under the same constraints. The fixed story→primitive
  mappings above are now normative.
- **Builds on** ADR-0101/ADR-0109 (no finalize action, `deriveMatchLifecycleStatus()` is
  the lifecycle source) and ADR-0123 (PWA safe-area/standalone behaviour preserved).

## Consequences

- One match projection and three variants replace per-surface match rows (Fixtures
  `MatchTicket`, Today's bespoke `TodayMatchRow`, Events' bespoke `EventMatchCard`),
  reducing drift and screenshot churn. `MatchHeader` is used on League match detail and
  Follow Live; Live Reporting keeps a compact one-row sticky scoreboard (an explicit
  operational-focus density exception) that still follows football home→away order.
- `TodayMatch` gains `homeScore`/`awayScore` (home/away oriented, from the post-match
  report) so the Today timeline shows a scoreline + W/D/L for a played match. There is no
  server-side live-score aggregation, so a live match with no report row shows state + the
  "Follow live" action instead.
- `docs/product/adaptive-interaction-design.md` gains the precise timeline anatomy, the
  three match variants, the seven-primitive set, the fixed story mappings, and the visual
  grammar values. `AGENTS.md`'s "Adaptive interaction design" section is updated to match.
- Public docs (`content/docs/**`) and their screenshots are regenerated for changed
  primary surfaces via the existing pipeline.
- No domain, selection, fairness, evidence, lifecycle, auth, tenancy or persistence
  semantics change. No new route tree, no schema change, no chart dependency.
