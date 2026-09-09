# ADR-0132: DecisionReview persistence and cadence

## Status

Accepted

## Context

ADR-0131 introduces **Decision review** — a scheduled prompt to reconsider a durable coaching
decision after time and context have moved on. It needs its own persistence (it is deliberately
*not* `ReviewRequest`, which is a reviewer-driven approval flow) and a defined lifecycle so the
behaviour is predictable and testable.

The two initial target types are the two durable, coach-authored "this is our current plan for
this player / this team" records that already exist:

- `DevelopmentThread` — a per-player development focus.
- `TeamFocus` — a per-team focus statement.

## Decision

### Model

`src/lib/review/decision-review.ts` owns the domain; `prisma/schema.prisma` adds:

```prisma
enum DecisionReviewTargetType { DEVELOPMENT_THREAD  TEAM_FOCUS }
enum DecisionReviewStatus     { PENDING  COMPLETED  SUPERSEDED }
enum DecisionReviewOutcome    { KEEP  CHANGE  COMPLETE }

model DecisionReview {
  id             String  @id @default(cuid())
  organisationId String
  targetType     DecisionReviewTargetType
  targetId       String
  targetRevision String
  dueAt          DateTime
  status         DecisionReviewStatus @default(PENDING)
  outcome        DecisionReviewOutcome?
  reviewNote     String?
  createdBy      String?
  resolvedBy     String?
  resolvedAt     DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  organisation   Organisation? @relation(fields: [organisationId], references: [id], onDelete: Cascade)

  @@index([targetType, targetId, status])
  @@index([status, dueAt])
  @@index([organisationId])
}
```

Tenancy follows the existing convention: `organisationId` column + relation, RLS-scoped via the
`db.ts` `tenantRLS` where-clause injection, and every domain function requires an `org`-typed
`OrgFilterMode` (`requireOrg()` throws otherwise). Migration
`20260909200400_add_decision_review` is additive (new enums + new table + indexes + FK), so it
is safe under ADR-0105 expand/contract regardless of deploy ordering.

`targetRevision` is a 16-hex fingerprint of the target's **material** fields only —
`focus + category + rationale` for a DevelopmentThread, `statement + context` for a TeamFocus.
Metadata-only edits do not change it, so they do not reset the cadence.

### Cadence

- **On target creation**, a review is prefilled **42 days** out
  (`DECISION_REVIEW_CADENCE_DAYS`). 42 days is a product cadence, **not** an evidence threshold.
  The coach may change the date, or choose "No scheduled review" (`dueAt: null` → nothing is
  created).
- **On a material change** before the review resolves, the pending review is set to
  `SUPERSEDED` and a fresh `PENDING` review is scheduled 42 days from the change (unless the
  coach sets another date). A metadata-only save passes an unchanged `targetRevision` and is a
  no-op.
- **On the target closing / completing outside a review**, the pending review becomes
  `SUPERSEDED` with **no** replacement.
- **Nothing auto-resolves.** A past `dueAt` only makes the review *due*, i.e. surfaced under
  "Needs attention".

### Resolution

A due review is resolved by the owning coach — there is no reviewer:

| Action | Effect |
|---|---|
| **Keep** | `status=COMPLETED`, `outcome=KEEP`, optional note. Schedules the next review 42 days out. |
| **Change** | Opens the target's normal edit. After a material save, the review resolves `outcome=CHANGE` (via the same supersede-on-change path) and the fresh review is scheduled. |
| **Complete** | `status=COMPLETED`, `outcome=COMPLETE`. Closes the target. **Stops** the cadence — no next review. |
| **Later** | `dueAt += 7 days` (`DECISION_REVIEW_DEFER_DAYS`). Stays `PENDING`. |

### Surfacing

`getDueDecisionReviews(orgFilter)` returns `PENDING` reviews with `dueAt <= now`, soonest first.
Consumed by:

1. Today, under "Needs attention", after immediate live/matchday items — labels
   `Development focus ready to revisit` / `Team focus ready to revisit`, styled as attention
   (not error).
2. The target's Player / Team detail context, alongside a compact
   date / outcome / note / resolver history (`getDecisionReviewHistoryForTarget()`). No
   leaderboard, no count judgement, no invented "success score".

## Consequences

- Best-effort hooks in `createThread`/`updateThread` (`development-thread.ts`) and
  `createTeamFocus`/`updateTeamFocus`/`reopenTeamFocus` (`team-focus.ts`): a review-scheduling
  failure is swallowed and never fails the underlying coaching write.
- New server actions + minimal Today / target-detail UI for the four resolution actions
  (delivered incrementally after the model + cadence land).
- No impact on selection, fairness, evidence, exports, or planning-boundary behaviour.
