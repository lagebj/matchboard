# ADR-0127: Post-match learning has an authoritative, observable run result

## Status

Accepted

## Context

`runPostMatchLearning(ref)` (ADR-0104) is the one shared post-match learning orchestrator —
rebuild actual timeline → opponent sporting evidence → player evidence → combination evidence.
It is called from League's `completeReport()` and Event's `completeEventReport()` and is
deliberately **non-blocking**: report completion must succeed even if evidence processing fails
(coach-workflow resilience — PRINCIPLES.md #6, ADR-0104).

Consolidation Programme re-verification (F5) confirmed the non-blocking behaviour was correctly
implemented but **nothing else was**:

- Both callers `await runPostMatchLearning(...)` inside `try { } catch {}` and **discard the
  returned `PostMatchLearningResult`**. The completion return type carried no learning
  information.
- The result was **never persisted**. There was no `LearningRun` model and no field on either
  report model. The only trace of a run was one `pino` line to stdout (silenced under the test
  runner).
- The integrity audit had no evidence check; `reconcile` covered only the narrow "actual
  timeline present, combination evidence missing" case.
- Every test that asserts evidence was produced calls the orchestrator (or an algorithm)
  **directly**; every test that goes through `completeReport()` / `completeEventReport()`
  asserts **only** that the report reached `LOCKED`. "Report completed" and "evidence produced"
  were proven by different tests against different entry points. There was no forced-failure
  test proving completion succeeds while a run is marked failed.

The Evidence rule for this programme: keep learning non-blocking for coaches, **but** its
success/failure must be authoritative and observable, retry must be safe, and evidence-specific
tests must assert evidence-specific output.

## Decision

**One row per learning run: `PostMatchLearningRun`.**

```prisma
model PostMatchLearningRun {
  id             String   @id @default(cuid())
  organisationId String
  matchId        String?           // League
  eventMatchId   String?           // Event   (CHECK: exactly one of the two)
  trigger        PostMatchLearningTrigger    // REPORT_COMPLETION | REPLAY | RECONCILE
  runAt          DateTime @default(now())
  overallOutcome LearningRunOutcome          // APPLIED | SKIPPED | FAILED
  steps          Json                        // the PostMatchLearningResult per-step shape
}
```

Dual nullable FK + discriminator + hand-added `CHECK`, matching `ActualPositionInterval` /
`CombinationEvidence` / `OpponentSportingEvidence` (ADR-0104). Additive + nullable → ADR-0105
expand-safe; no code assumes the table exists before the migration lands.

- `runPostMatchLearning(ref, orgFilter, trigger = "REPORT_COMPLETION")` computes
  `overallOutcome = summariseLearningOutcome(result)` (FAILED if any step failed, else APPLIED
  if any applied, else SKIPPED) and **best-effort** writes one `PostMatchLearningRun`. The write
  is in its own `try/catch` — a persistence failure is logged and dropped, never propagated, so
  it can never convert a swallowed learning failure into a completion failure. The row is the
  newest = current learning state for that match.
- `completeReport()` / `completeEventReport()` now capture the result they already `await` and
  return it as an optional `learning` field on their success result (`undefined` = not run,
  not = failed). Still non-blocking; the `try/catch` is unchanged.
- `replayPostMatchLearningHistory()` tags its runs `trigger: "REPLAY"` and gains a
  `{ matchId } | { eventMatchId } | { failedOnly }` option — `failedOnly` reprocesses only
  matches whose latest run is `FAILED` or missing (the retry-the-broken-ones mode).
- Integrity audit: new `POST_MATCH_LEARNING` domain check — a LOCKED report whose latest run is
  `FAILED` or absent is a `REVIEW` finding (`AUTO_SAFE`: re-run `replayPostMatchLearningHistory`
  with `failedOnly: true`). Not corrupt data — a retry signal.
- `RECONCILE` is reserved for a future reconcile-path caller; nothing writes it yet.

### Observability, not coach-facing errors

The failure signal is the `PostMatchLearningRun` row + the `pino` warn line + the audit
finding — all operator surfaces. A learning failure still never reaches a coach as an error
(ADR-0104). This matches the programme's "keep evidence derived work behind, not in front of,
coach workflows."

## Consequences

- F5 is resolved: an operator can query `PostMatchLearningRun` (or run the audit) to find failed
  runs, and re-run exactly those idempotently.
- Tests: `post-match-learning-pipeline.test.ts` asserts the run row + per-step outcomes (not
  just `!== FAILED`); `event-report-mutations.test.ts` asserts the returned `learning` + the
  persisted run; new `complete-report-learning-failure.test.ts` forces an opponent-evidence
  step to throw and proves the report still completes `LOCKED` while the run is `FAILED` and
  other steps still ran; `bundle2-historical-evidence.test.ts` asserts the `REPLAY`-tagged run.
- The `post-match-evidence-parity.spec.ts` E2E keeps its `LOCKED`-pill assertion (its job is the
  real UI path) but its comment now points at the deterministic integration tests and the run
  record instead of rationalising "completion is the only signal."

## References

- ADR-0104 (canonical post-match learning pipeline — non-blocking)
- ADR-0105 (expand/contract migration safety)
- PRINCIPLES.md #6/#7, Consolidation Programme C5 / F5
