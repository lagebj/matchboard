# Gate C W1 — Current State Audit

Audit of Today's actual production implementation, against the brief's required composition for
quiet day / decision day / matchday pre-live / Live Now exclusivity, performed by direct source
inspection. **Revised twice: once after an independent review of the first candidate pass found
three genuine production defects (P1-01/P1-02/P1-03), and again after a second independent review
found that the P1-03 fix itself introduced two new information-loss defects (P1-04/P1-05)** — see
"Findings from independent review" below. Classification values: `CONFIRMS_SHIPPED_BASELINE`,
`PROPOSED_REFINEMENT`, `MISSING_CAPABILITY`, `BLOCKED_BY_SOURCE_OR_AUTHORITY`.

## Architecture summary

`src/app/(app)/o/[orgSlug]/today/page.tsx` is the sole server loader. `TodaySurface`
(`src/components/touchline/today/today-surface.tsx`) is the single composition owner (ADR-0142):
it resolves one primary action via `resolveTodayPrimaryAction()`, derives Matchday's phase/action
independently, excludes whichever signal was promoted to primary or consumed by Matchday from the
secondary sections, and caps combined secondary items at 2. QUIET vs DECISION is chosen purely
from `primaryAction.kind === "NONE"` plus a due-review override — **this switch itself was, and
remains, correct and unchanged.** What the first pass got wrong was treating "QUIET vs DECISION"
as the only composition fact that mattered, when Matchday owning the primary anchor and the
context rail's own information ownership are both orthogonal facts that also need a single,
consistent owner.

## Findings from independent review (P1-01, P1-02, P1-03) — real production fixes

1. **P1-01 — contradictory Matchday/quiet-day messaging (real defect, fixed).** Before this fix,
   whenever a same-day Matchday action existed (e.g. "Prepare lineup") but no situational
   decision or due review did, `compositionState` resolved to `"QUIET"` and `TodayQuietState`
   rendered an unconditional "Nothing needs your attention." directly below Matchday's own real
   action — contradictory statements on the same screen. **Fix:** `TodayQuietState` gained a
   `showHero: boolean` prop; `today-surface.tsx` passes `showHero={!matchdayContext}`, mirroring
   the existing `showSquadReadiness={!matchdayContext}` guard exactly. Regression-tested in
   `today-surface.matchday-quiet-composition.test.tsx`.
2. **P1-02 — "Today in order" (the busy same-day chronology) never showed on a quiet-composition
   day (real defect, fixed).** `TodayOperationalTimeline` previously rendered only inside the
   `"DECISION"` branch, so a quiet day with a genuine Matchday anchor and other same-day matches
   never showed them. **Fix:** `showOperationalTimeline = compositionState === "DECISION" ||
   Boolean(matchdayContext)` — the timeline (with its existing `timelineExcludedMatchId`
   exclusion, unchanged) now renders whenever there is a decision OR a same-day Matchday object,
   never a new ranking of which match matters. Regression-tested in the same file.
3. **P1-03 — squad readiness and carry-forward could render twice (real defect, fixed, then
   over-corrected — see P1-04/P1-05).** The context rail (`TodayContextRail`) always received
   the raw `squadStatus`/`carryForwardItems` props regardless of whether the main composition
   already showed the same fact — a real duplicate on desktop and on mobile. The first candidate
   pass's own `INFORMATION_OWNERSHIP_MATRIX.md` called this "intentional," which the first
   independent review correctly disputed as insufficient justification.
4. **P1-04 — organisation-wide squad availability disappeared whenever a Matchday anchor existed
   (a defect introduced by the P1-03 fix itself, now corrected).** The P1-03 fix's condition —
   `Boolean(matchdayContext) || compositionState === "QUIET"` — wrongly treated "a Matchday
   anchor exists" as proof the org-wide fact (`TodaySquadStatus`, from
   `getOrgActivePlayerAvailability()`) was shown elsewhere. It never was: Matchday's own card only
   ever shows match-specific selected-squad readiness (`TodayMatchdayContext.readiness`), a
   different scope. The org-wide fact simply vanished from the page whenever Matchday existed.
   **Fix:** the rail now omits it only when the quiet-day hero is *actually* showing the
   identical org-wide fact inline (`compositionState === "QUIET" && !matchdayContext`); whenever
   a Matchday anchor exists, the rail keeps showing it, now with a scope label ("All active
   players", `TodayContextRail`'s existing `SquadReadinessWidget`'s own `title` override — no new
   widget) since Matchday's own card is also on the page.
5. **P1-05 — carry-forward items beyond the first were silently discarded on quiet days (a
   defect introduced by the P1-03 fix itself, now corrected).** The P1-03 fix's condition —
   `compositionState === "QUIET"` suppressing the rail's entire `carryForwardItems` array — only
   accounted for the ONE item the quiet-day hero features inline (`.slice(0, 1)`, unchanged); the
   2nd and 3rd items (the adapter returns up to three) had nowhere left to render at all. **Fix:**
   the rail now receives `carryForwardItems.slice(1)` whenever the day is quiet (the complement
   of what the hero already features), rather than an empty array — the adapter's own maximum of
   three and its own priority order are both unchanged.

All five findings (P1-01 through P1-05) are regression-tested in
`today-surface.matchday-quiet-composition.test.tsx` — 19 tests total, covering every
quiet/decision × with/without-Matchday combination for both squad availability and carry-forward,
using deliberately different organisation-wide and match-specific numbers (identical counts
could otherwise mask an ownership error) and distinct carry-forward item identities (a count-only
assertion could otherwise mask a dropped or duplicated item).

## Classification table (revised)

| File / behavior | Classification | Justification |
|---|---|---|
| `today/page.tsx` | CONFIRMS_SHIPPED_BASELINE | Parallel loaders, deterministic providers only. |
| `today-surface.tsx` | PROPOSED_REFINEMENT (implemented) | Composition-selection logic (QUIET vs DECISION) unchanged; P1-01/P1-02/P1-04/P1-05 fixes above are narrow, additive, regression-tested corrections to what renders around that switch. |
| `today-quiet-state.tsx` | PROPOSED_REFINEMENT (implemented) | New `showHero` prop (P1-01); everything else unchanged. |
| `today-context-rail.tsx` | PROPOSED_REFINEMENT (implemented) | New optional `squadStatusTitle` prop, forwarded to the existing `SquadReadinessWidget`'s own `title` override (P1-04) — no new widget, no behavior change when the prop is omitted. |
| `today-next-action.tsx` | CONFIRMS_SHIPPED_BASELINE | Renders every `TodayPrimaryAction` kind; no invented fallback. |
| `today-decision-why.tsx` | CONFIRMS_SHIPPED_BASELINE | Problem/why/consequence/caveats order, deterministic reason codes only. |
| `today-selection-decisions.tsx` | CONFIRMS_SHIPPED_BASELINE | 3-zone row; `directlyActionable`/`dependsOnPrior` come straight from the planner, never guessed. |
| `today-planning-attention.tsx` | CONFIRMS_SHIPPED_BASELINE | Real signals only; never a count aggregate; explicit exclusion by idempotency key. |
| `today-other-attention.tsx` | CONFIRMS_SHIPPED_BASELINE | Explicit category allowlist; `blocked_round`/`decision_required` never rendered here. |
| `today-matchday.tsx` | CONFIRMS_SHIPPED_BASELINE | No meters/rings/badges; phase-aware copy; no fabricated tactics action. |
| `today-live-now.tsx` | CONFIRMS_SHIPPED_BASELINE | Glance-only, no socket/poll in this component. |
| `today-operational-timeline.tsx` | CONFIRMS_SHIPPED_BASELINE | Component itself unchanged — P1-02's fix is in when `today-surface.tsx` renders it, not in the component. |
| `today-carry-forward.tsx` | CONFIRMS_SHIPPED_BASELINE | Compact adapter only. |
| `today-since-last-visit.tsx` | CONFIRMS_SHIPPED_BASELINE | Mount-only diff, fail-open storage. |
| `today-composition.ts` | CONFIRMS_SHIPPED_BASELINE | `selectTodayComposition()` itself is unchanged — still one quiet/decision switch backed by the existing primary-action result. |
| `today-primary-action.ts` | CONFIRMS_SHIPPED_BASELINE | Documented anti-fallback resolution order unchanged. |
| `today-matchday-phase.ts` | CONFIRMS_SHIPPED_BASELINE | PREPARE/VERIFY/IMMINENT/LIVE/POST_MATCH fully implemented with canonical-lifecycle-outranks-arithmetic rule. |
| `today-matchday-readiness.ts` | CONFIRMS_SHIPPED_BASELINE | 8-step fixed-priority action resolver; no invented tactics readiness. |
| `today-football-match.ts` | CONFIRMS_SHIPPED_BASELINE | Shared League/Event contract; deterministic featured-match selection; Event omits tactics/venue rather than fabricating parity. Now actually exercised end-to-end by Gate C's own busy-day fixture (P1-02), not bypassed. |
| Live Now/Matchday exclusivity | CONFIRMS_SHIPPED_BASELINE | Plain ternary on `liveNow?.primary`; dedicated regression test from a real prior production incident. |
| League/Event parity | CONFIRMS_SHIPPED_BASELINE | One `TodayFootballMatch` contract for both; dedicated parity tests exist. |
| Assistant Coach contextual synthesis in Today | MISSING_CAPABILITY | Zero AI/hypothesis wiring anywhere in Today's component or lib tree. This is C07's gap; building it is out of this wave's scope (see `BLOCKERS.md`). |

## Flagged questions, answered directly from source

- **PREPARE/VERIFY/IMMINENT implemented?** Yes — `today-matchday-phase.ts`.
- **Deterministic primary-action + Why? disclosure?** Yes — `resolveTodayPrimaryAction()` +
  `buildTodayDecisionWhyContent()`.
- **Duplicate-decision suppression?** Yes for the primary/secondary decision set (unchanged); the
  independent review's P2-03 finding added an explicit identity-collision test proving it, rather
  than only a count-cap test (see `INTERACTION_AND_STATE_AUDIT.md`).
- **League/Event parity?** Yes, structurally unified; now genuinely exercised by a real,
  multi-candidate same-day fixture (P1-02) rather than a single hand-picked featured match.
- **Live Now/Matchday exclusivity?** Yes, unchanged, still regression-tested.
- **Context rail information ownership?** Now yes — see P1-03/P1-04/P1-05 above. The first
  attempt (P1-03) was itself wrong in two ways (P1-04, P1-05); the corrected version distinguishes
  "same fact" (suppress) from "related, different-scope fact" (keep showing, both).

## No further production defect found

Beyond P1-01/P1-02/P1-03/P1-04/P1-05 (fixed, narrowly scoped, regression-tested), the audit
found nothing else requiring a production change. No ARR is warranted — these are ordinary
defects (and a defect introduced by a prior fix for one of them) in Today's own composition
logic, not competing implementations or architectural residue.
