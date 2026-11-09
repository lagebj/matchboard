# Gate C W1 — Current State Audit

Audit of Today's actual production implementation, against the brief's required composition for
quiet day / decision day / matchday pre-live / Live Now exclusivity, performed by direct source
inspection (not by assuming an older UI Lab demo is authoritative). Classification values:
`CONFIRMS_SHIPPED_BASELINE`, `PROPOSED_REFINEMENT`, `MISSING_CAPABILITY`,
`BLOCKED_BY_SOURCE_OR_AUTHORITY`.

## Architecture summary

`src/app/(app)/o/[orgSlug]/today/page.tsx` is the sole server loader: it builds a
`CoachSituationProjection` from deterministic `DecisionCandidateProvider`s, then loads recent
matches, squad availability, selection recommendations, Live Now, Matchday (League/Event
unified), and a bounded upcoming-week list, in parallel. `TodaySurface`
(`src/components/touchline/today/today-surface.tsx`) is the single composition owner (ADR-0142):
it resolves one primary action via `resolveTodayPrimaryAction()` (the projection's top decision
only — never a second ranking, never an unrelated `actionable[0]` fallback), derives Matchday's
phase/action independently, excludes whichever signal was promoted to primary or consumed by
Matchday from the secondary sections, and caps combined secondary items at 2
(`MAX_DECISION_DAY_SECONDARY_ITEMS`). QUIET vs DECISION is chosen purely from
`primaryAction.kind === "NONE"` plus a due-review override. No AI/LLM involvement exists
anywhere in this path.

## Classification table

| File / behavior | Classification | Justification |
|---|---|---|
| `today/page.tsx` | CONFIRMS_SHIPPED_BASELINE | Parallel loaders, deterministic providers only. |
| `today-surface.tsx` | CONFIRMS_SHIPPED_BASELINE | Single composition owner; dedup via excluded sets (lines 190-226). |
| `today-quiet-state.tsx` | CONFIRMS_SHIPPED_BASELINE | Calm hero → readiness (conditional) → bounded week chronology → ≤1 carry-forward. |
| `today-next-action.tsx` | CONFIRMS_SHIPPED_BASELINE | Renders every `TodayPrimaryAction` kind; no invented fallback. |
| `today-decision-why.tsx` | CONFIRMS_SHIPPED_BASELINE | Problem/why/consequence/caveats order, deterministic reason codes only. |
| `today-selection-decisions.tsx` | CONFIRMS_SHIPPED_BASELINE | 3-zone row; `directlyActionable`/`dependsOnPrior` come straight from the planner, never guessed. |
| `today-planning-attention.tsx` | CONFIRMS_SHIPPED_BASELINE | Real signals only; never a count aggregate; explicit exclusion by idempotency key. |
| `today-other-attention.tsx` | CONFIRMS_SHIPPED_BASELINE | Explicit category allowlist; `blocked_round`/`decision_required` never rendered here. |
| `today-matchday.tsx` | CONFIRMS_SHIPPED_BASELINE | No meters/rings/badges; phase-aware copy; no fabricated tactics action. |
| `today-live-now.tsx` | CONFIRMS_SHIPPED_BASELINE | Glance-only, no socket/poll in this component. |
| `today-operational-timeline.tsx` | CONFIRMS_SHIPPED_BASELINE | Excludes whichever match Live Now/Matchday already owns. |
| `today-context-rail.tsx` | CONFIRMS_SHIPPED_BASELINE | Fixed order, content-gated rendering. |
| `today-carry-forward.tsx` | CONFIRMS_SHIPPED_BASELINE | Compact adapter only. |
| `today-since-last-visit.tsx` | CONFIRMS_SHIPPED_BASELINE | Mount-only diff, fail-open storage. |
| `today-composition.ts` | CONFIRMS_SHIPPED_BASELINE | One quiet/decision switch backed by the existing primary-action result — no second relevance system. |
| `today-primary-action.ts` | CONFIRMS_SHIPPED_BASELINE | Documented anti-fallback resolution order (1 selection → 2 plan-integrity → 3 live/imminent match → 4 generic → 5 none). |
| `today-matchday-phase.ts` | CONFIRMS_SHIPPED_BASELINE | PREPARE/VERIFY/IMMINENT/LIVE/POST_MATCH fully implemented with canonical-lifecycle-outranks-arithmetic rule. |
| `today-matchday-readiness.ts` | CONFIRMS_SHIPPED_BASELINE | 8-step fixed-priority action resolver; no invented tactics readiness. |
| `today-football-match.ts` | CONFIRMS_SHIPPED_BASELINE | Shared League/Event contract; deterministic featured-match selection; Event omits tactics/venue rather than fabricating parity. |
| Live Now/Matchday exclusivity | CONFIRMS_SHIPPED_BASELINE | Plain ternary on `liveNow?.primary` (`today-surface.tsx`); dedicated regression test from a real prior production incident. |
| League/Event parity | CONFIRMS_SHIPPED_BASELINE | One `TodayFootballMatch` contract for both; dedicated parity tests exist. |
| Assistant Coach contextual synthesis in Today | MISSING_CAPABILITY | Zero AI/hypothesis wiring anywhere in Today's component or lib tree (confirmed by direct inspection; no `hypothesis`/advisor import exists in this tree). The deterministic OFF-equivalent baseline is fully correct — there is simply no ON-state synthesis to compare it against yet. This is C07's gap; building it is out of this wave's scope (see `BLOCKERS.md`). |

No `PROPOSED_REFINEMENT` was found: this wave's candidates confirm the shipped baseline rather
than proposing a visual change, consistent with the brief's own instruction not to invent an
improvement where none is needed.

## Flagged questions, answered directly from source

- **PREPARE/VERIFY/IMMINENT implemented?** Yes — `today-matchday-phase.ts`, plus LIVE/POST_MATCH
  beyond what this wave's scope needs.
- **Deterministic primary-action + Why? disclosure?** Yes — `resolveTodayPrimaryAction()` +
  `buildTodayDecisionWhyContent()`.
- **Duplicate-decision suppression?** Yes — `today-surface.tsx` excludes the promoted
  signal/work-item from every secondary section, plus Matchday's own consumed-signal exclusion.
- **League/Event parity?** Yes, structurally unified; Matchday omits Event-only tactics rather
  than fabricating parity.
- **Live Now/Matchday exclusivity?** Yes, and specifically regression-tested because a prior
  production incident violated it (see `today-surface.matchday-livenow-gate.test.tsx`'s own doc
  comment).

## Genuine production defects found

None. The audit surfaced no defect requiring a "strictly necessary shared-component correction"
(brief §12's narrow exception) — no ARR or issue is filed from this wave.
