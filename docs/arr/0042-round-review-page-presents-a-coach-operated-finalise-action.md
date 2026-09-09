# ARR-0042: The Round Review page presents a coach-operated "Finalise round" action that ADR-0109 removed

## State

Resolved — Consolidation Programme C1b, 2026-09-09. Implements ADR-0109 (no new ADR needed — the
decision already exists; this is unfinished implementation of it). See "Resolution".

## Identified

2026-09-08, during the ADR-0124 Phase 9 consistency review's search for `Finali[sz]e round` /
`Finali[sz]e match` across mutable guidance and active code.

## Intended architecture

ADR-0109 ("Derived coach workflow lifecycle") is explicit: **round/match finalization is not a
coach action.** "There is no `finalizeRoundAction`/`finalizeSingleMatchFromBoardAction`/
`unfinalizeRoundAction`/etc., no 'Finalize round'/'Un-finalize round' UI, and no
`/api/finalize-round` route — all removed." A round becomes `FINALIZED` automatically via
`ensureMatchPlanningBaselineCaptured()` when every constituent match's planning boundary closes.
A coach who wants to consciously accept a Blocked/Decision-required condition before the boundary
closes does so via a manual edit's own override reason, not a finalization-time prompt.

## Residue

`src/components/assistant/round-review-page.tsx` (rendered by
`src/app/(app)/o/[orgSlug]/rounds/[matchRoundId]/review/page.tsx`) still renders a coach-facing
finalization block:

- when `review.finalizeable` (no Blocked/Decision-required signals): a `DecisionPanel` with
  `action="FINALIZE"` and `actionLabel="Finalise round"`;
- otherwise: a disabled `Finalize (conditions require review)` button plus an
  `Override and finalize with reason` button opening an override-reason modal.

`review.finalizeable` comes from `getRoundReview()`
(`src/domain/assistant-manager/service.ts:183`): `blockedConditions.length === 0 &&
decisionRequiredConditions.length === 0`.

Crucially, the button **does not finalize anything**. `DecisionPanel` → `createDecision()` →
`recordDecision()` (`src/domain/assistant-manager/service.ts:349`) only writes a `DecisionRecord`
audit row (`action: "FINALIZE"`). It never touches `MatchRound.status`, `Selection.status`,
`planningClosedAt`, or any capture path. The round still only becomes `FINALIZED` at the planning
boundary. So the UI presents a primary "Finalise round" action that is, functionally, a no-op
audit log — misleading to a coach, and a direct contradiction of ADR-0109's "no coach-operated
finalize" doctrine and the vocabulary in `AGENTS.md` ("Derived coach workflow lifecycle") and
`docs/product/adaptive-interaction-design.md` (anti-pattern: "reintroducing a coach-operated
Finalise round / Finalise match action").

Related unswept residue in the same area (lower priority, same root cause): the `/rounds/[id]/
review` route and `round-review-page.tsx`'s framing as a "finalize gate" rather than a plan-
integrity review surface; `DecisionPanel`'s `FINALIZE` `DecisionAction` value and the
`getRoundReview()` `finalizeable` field, which exist only to feed this UI.

## Why not fixed here

Removing the finalize block from `round-review-page.tsx` is a coach-workflow change (what should
the Round Review page show and do instead?), and it reaches into `getRoundReview()`, the
`DecisionAction` enum, and the assistant-manager decision-audit surface. That is out of scope for
a UX-composition programme and deserves its own change under `adr-governance` (an amendment to /
implementation-completion of ADR-0109), not an inline edit in an ADR-0124 PR.

## Resolution criteria

- `round-review-page.tsx` no longer renders any coach-operated finalize/override-and-finalize
  control; the page is either removed or repurposed as a read-only plan-integrity review surface.
- `getRoundReview().finalizeable` and `DecisionAction`'s `FINALIZE` value are removed or
  repurposed, with no remaining caller implying a coach finalizes a round.
- An ADR entry (amending ADR-0109) records the decision about the Round Review route's fate.

## Resolution

`round-review-page.tsx` is now a **read-only plan-integrity review surface**. Removed: the
`DecisionPanel action="FINALIZE"` ("Finalise round") block, the disabled "Finalize (conditions
require review)" button, the "Override and finalize with reason" button, and the entire
override-reason modal (which called `createDecision({ action: "OVERRIDE_BLOCKER" })` — a no-op
audit write dressed as finalization). The page keeps team readiness + live plan-integrity
signals, and its summary line now states plainly that the round becomes historical automatically
at the planning boundary with no finalise step; when conditions remain it links to the Round
Board (where the ADR-0109 path — a manual edit's own override reason — actually lives).

- `RoundReview.finalizeable` removed from `src/domain/assistant-manager/types.ts` and both
  `getRoundReview()` return sites in `service.ts`. `blockedConditionCount` /
  `decisionRequiredCount` already carried the same information.
- `DecisionAction`'s `"FINALIZE"` removed from the union (nothing emits it after this change; a
  comment notes historical `DecisionRecord.action` string rows may still carry it — the column
  is a plain string, so old data is unaffected).
- `service.test.ts` updated (the `recordDecision` persistence test now uses `"OVERRIDE_BLOCKER"`;
  the `getRoundReview` default test asserts `decisionRequiredCount` instead of `finalizeable`).
- `AGENTS.md`'s Workflow overview ("finalizes one round at a time") corrected to the ADR-0109
  boundary-close wording. `features/matchboard.feature` and `docs/product/glossary.md` already
  asserted the *absence* of a coach finalise action — the code now matches them.

No new ADR: ADR-0109 already decided "round/match finalization is not a coach action"; this
completes its implementation. `docs/product/adaptive-interaction-design.md` already lists
"reintroducing a coach-operated Finalise round / Finalise match action" as an anti-pattern —
unchanged.
