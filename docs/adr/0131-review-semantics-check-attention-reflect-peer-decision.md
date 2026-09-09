# ADR-0131: Review semantics — Check / Attention / Reflect / Peer review / Decision review

## Status

Accepted

## Context

The word "Review" was overloaded across Matchboard. It meant, in different places:

- **inspecting generated draft work before acting on it** (the `Populate → Review → Adjust`
  planning step, Round Board "review", `/players` "Current round attention" being mislabelled as
  review in places);
- **a coach asking another coach to look at a concrete lineup / event squad** (the
  `ReviewRequest` model, `/reviews` route, "Reviews" nav);
- **recording what was observed after a match** (team reflection, player observation, quick
  observation);
- an aspiration — not yet built — to **revisit a durable coaching decision after time has
  passed** (a DevelopmentThread's focus, a TeamFocus's statement).

One word for four distinct activities made the product harder to explain and left the
longer-loop "is this still the right call six weeks on?" coaching mechanism with nowhere to
live. The Productification & Decision Safety programme (`06_EVIDENCE_AND_REVIEW_SEMANTICS.md`)
fixes the vocabulary and adds the missing mechanism.

## Decision

Five distinct concepts, each with fixed product language:

| Concept | Meaning | Product language |
|---|---|---|
| **Check** | Inspect generated work before acting on it | Workflow step `Populate → Check → Adjust`. Replaces the generic workflow word "Review" wherever it meant plan inspection. |
| **Attention** | Current reality requires action now | "Needs attention". Unavailable selected player, uncovered opportunity, incomplete report, no safe fit, helper required, **due Decision review**. Current state, never historical judgement. Not styled as an error. |
| **Reflect** | Record what happened / was observed after play | Team reflection, player observation, quick observation. Unchanged mechanisms. |
| **Peer review** | One coach asks another to review a concrete lineup / event squad | Maps to the existing `ReviewRequest` model and `/reviews` route **unchanged**. Product title becomes "Peer reviews"; the action becomes "Request peer review". Domain semantics and statuses are untouched. |
| **Decision review** | Reconsider a durable coaching decision after time / context changes | New `DecisionReview` persistence (ADR-0132). Not an approval, has no reviewer. Actions: **Keep / Change / Complete**, plus **Later**. |

### Boundaries

- **Peer review and Decision review never share persistence.** `ReviewRequest` keeps its exact
  meaning (a reviewer, a request/approve/changes-requested lifecycle). `DecisionReview` has no
  reviewer and no approval — it is a scheduled prompt to reconsider, resolved by the owning
  coach.
- **Check is not a status.** It is a workflow step name. The underlying round/match state model
  (`RoundStatus`, plan integrity, `deriveMatchLifecycleStatus()`) is unchanged.
- **Decision review is Attention, not a blocker.** A due Decision review can never block
  generation, finalisation, or a planning boundary. It surfaces under "Needs attention" on Today
  (after immediate live/matchday items) and on the target's Player/Team detail, with the labels
  `Development focus ready to revisit` / `Team focus ready to revisit`.

### Documentation

The canonical coach workflow becomes:

`Setup → Intent → Populate → Check → Adjust → derived planning boundary → Reflect → Learn`

Peer review is optional collaboration layered on top; Decision review is a longer-loop coaching
mechanism that runs on its own cadence (ADR-0132), independent of any single round.

## Consequences

- `AGENTS.md`, `README.md`, `features/matchboard.feature`, and the public docs workflow
  descriptions replace "Review" with "Check" for the plan-inspection step.
- `/reviews` UI copy becomes "Peer reviews" / "Request peer review"; the route path is
  unchanged (no redirect churn, deep links keep working).
- A new `DecisionReview` model, cadence domain (`src/lib/review/decision-review.ts`), and
  create/update/close hooks in the DevelopmentThread and TeamFocus domains — see ADR-0132.
- No change to selection, fairness, evidence, or planning-boundary behaviour.
