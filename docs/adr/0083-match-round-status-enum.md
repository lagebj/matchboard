# ADR-0083: MatchRound.status promoted to a real enum

## Status

Accepted

## Date

2026-08-21

## Context

Post-Phase-13 roadmap Group C1 (Phase 11 Sec68). Every sibling lifecycle status field in the
schema (`MatchLineupStatus`, `MatchReportStatus`, `EventSquadStatus`, `EventStatus`, `MatchStatus`,
etc.) is a real Prisma enum. `MatchRound.status` alone was `String @default("DRAFT")`. The audit
that surfaced this named a specific, confirmed consequence: `src/lib/round-status.ts`'s
`deriveRoundStatus()` has a `NOT_GENERATED` UI-derived status that was unreachable from real data,
because nothing at the type level constrained the column to the two values the application was
believed to actually persist (`DRAFT`, `FINALIZED`).

Investigating in order to write a safe migration found the belief was wrong in a more serious way
than "the type is loose." Three confirmed bugs, not one:

1. **`unfinalize-match-round.ts` / `unfinalize-single-match.ts` persisted a display-only
   value.** Both called `deriveRoundStatus()` — the function that computes a live, UI-only status
   for rendering — with `dbStatus: "DRAFT"` and `hasDraftSelections: true` hardcoded. Under
   `deriveRoundStatus()`'s logic this can only return `"BLOCKED"` or `"READY"`, never `"DRAFT"`.
   Both functions then wrote that return value directly into `MatchRound.status`. Un-finalizing a
   round could therefore persist `BLOCKED`/`READY` into the database column — never the literal
   `DRAFT` it should have written.
2. **A pre-existing `CHECK` constraint made this possible without ever failing.**
   `20260802120000_add_enum_check_constraints` added
   `CHECK (status IN ('NOT_GENERATED','DRAFT','BLOCKED','READY','FINALIZED'))` — mirroring the
   full 5-value *UI display* vocabulary rather than the 2-value *persistence* rule. It let bug (1)
   write invalid-for-persistence values without ever tripping a database constraint.
3. **`resolve-or-create-match-round-for-date.ts` explicitly wrote `status: "NOT_GENERATED"`** when
   creating a brand-new round for a rescheduled match — a second, independent write site for a
   value that was never valid to persist.

A fourth, related but non-corrupting bug was found in the same code path:
`get-assistant-command-centre.ts` branched directly on `round.status === "NOT_GENERATED"` /
`"BLOCKED"` / `"READY"` — comparisons that could never be true against real data, since the column
never actually held those values (even accounting for bugs 1-3, those wrote to `MatchRound.status`
directly via raw update calls, not through this comparison path). The practical effect: a round
with zero draft selections (truly never generated) fell through to the live plan-integrity branch,
which found zero signals against zero selections and incorrectly recommended it as
"Ready to finalize" — the opposite of correct next-action guidance for an unpopulated round.

Given all of this, the roadmap's original framing ("this is a live-column migration but existing
data is presumed clean") did not hold. The migration had to assume existing rows could genuinely
contain `BLOCKED`/`READY`/`NOT_GENERATED`, not just `DRAFT`/`FINALIZED`.

## Decision

### Schema

```prisma
enum MatchRoundStatus {
  DRAFT
  FINALIZED
}

model MatchRound {
  ...
  status MatchRoundStatus @default(DRAFT)
  ...
}
```

Only two values are ever valid to persist. `BLOCKED`, `READY`, and `NOT_GENERATED` remain
`RoundStatus` values in `src/lib/round-status.ts` (TypeScript-only, not a database enum) — they are
computed live for display and must never be written to `MatchRound.status`.

### Migration (`20260821100000_match_round_status_enum`)

1. `UPDATE "MatchRound" SET "status" = 'DRAFT' WHERE "status" NOT IN ('DRAFT', 'FINALIZED')` —
   coerces any row a confirmed bug may have corrupted back to the value the fixed code would have
   written. Run unconditionally; the migration does not depend on knowing how many rows (if any)
   are actually affected.
2. Drop the now-superseded `MatchRound_status_check` constraint and the text-literal default
   (a text default cannot be automatically cast when changing the column's type).
3. `CREATE TYPE "MatchRoundStatus"`, convert the column via `ALTER COLUMN ... TYPE ... USING
   "status"::"MatchRoundStatus"`.
4. Restore the default, now typed as the enum.

### Application-code fixes shipped in the same change

- `unfinalize-match-round.ts` / `unfinalize-single-match.ts`: write the literal `"DRAFT"` directly.
  The `computeRoundPlanIntegrity()`/`deriveRoundStatus()` call that produced the buggy value is
  removed entirely — it was pure (no side effects) and existed only to feed the incorrect write.
- `resolve-or-create-match-round-for-date.ts`: no longer passes an explicit `status` when creating
  a round — the schema default (`DRAFT`) applies, matching every other round-creation site
  (`ensure-match-round.ts`).
- `round-status.ts`: `deriveRoundStatus()`'s `dbStatus === "DRAFT"` branch now checks
  `!hasDraftSelections` first and returns `NOT_GENERATED`, instead of falling through to the
  literal `"DRAFT"` return value that made `NOT_GENERATED` unreachable. `hasMatches` — now unused
  by this function — removed from its signature and every call site
  (`rounds/page.tsx`, `round-board.tsx`, `domain/fixtures/service.ts`); the underlying concept
  remains in use elsewhere (`getRoundActions()`, `get-operational-context.ts`) independently.
- `get-assistant-command-centre.ts`: added `hasDraftSelections` (via a `selections` count) to the
  round query; replaced the `round.status === "NOT_GENERATED"` comparison (never true) with
  `round.status === "DRAFT" && !hasDraftSelections`; removed the dead `|| round.status ===
  "BLOCKED"` and the fully-unreachable `round.status === "READY"` branch (its case was already
  handled inside the `DRAFT` branch's live integrity computation).
- `round-board.tsx` / `domain/fixtures/service.ts`: both passed only `blockerCount` (not
  `blockerCount + decisionRequiredCount`) into `deriveRoundStatus()`'s `blockedSignalCount`,
  unlike `finalize-match-round.ts`'s own combined `allOverrideSignals` treatment and every other
  call site. A round with only Decision-required conditions displayed as `READY` in the round
  badge despite its own "decisions need review" banner appearing directly below it. Fixed to match
  the established combined-count pattern.
- `import-full-app-state.ts`: an export taken before this fix could contain a corrupted
  `BLOCKED`/`READY`/`NOT_GENERATED` value in its JSON. The import now coerces anything other than
  `FINALIZED` to `DRAFT` rather than letting the insert fail on an invalid enum value.
- Removed a fully dead `_roundData` object literal in `rounds/[matchRoundId]/page.tsx`
  (underscore-prefixed to suppress lint, assigned but never read) discovered while updating this
  same file's `RoundBoard` prop-passing.
- Test-only: `factories.ts`'s `createTestRound()` status override narrowed to
  `MatchRoundStatus`; `get-assistant-command-centre.test.ts` given a real baseline of draft
  selections in `beforeAll()` (the shared fixture creates none by default, which several existing
  tests were implicitly relying on a related bug to compensate for); `unfinalize.test.ts` and
  `resolve-or-create-match-round-for-date.test.ts` updated to assert the corrected behavior
  instead of the previously-buggy one.

## Consequences

- `MatchRound.status` can now only ever be `DRAFT` or `FINALIZED` at the type and database level —
  the class of bug this ADR describes is now structurally impossible to reintroduce.
- The Assistant's "populate_needed" recommendation is now reachable for real, unpopulated rounds
  for the first time — previously silently masked by the ready_to_finalize fallback.
- Every write site across `src/` and `scripts/` was audited (not assumed) before this migration
  shipped; three real corruption/miscategorization bugs were found and fixed as a result, not just
  the originally-named unreachable-`NOT_GENERATED` symptom.
- No production data check was performed before writing the migration (blocked: a direct
  production database connection was denied by the sandbox's safety classifier, consistent with
  ARR/roadmap precedent this session). The migration's coercion step is unconditional specifically
  because of this — it does not assume the actual extent of any corruption, only that the fixed
  code's own literal `DRAFT` is always a safe fallback for whatever real data contains.

## Related

- Post-Phase-13 roadmap, Group C1 (`.matchboard-work/consolidation-programme/POST-PHASE-13-ROADMAP.md`, gitignored)
- `src/lib/round-status.ts` — `deriveRoundStatus()`
- `src/lib/selection/unfinalize-match-round.ts`, `unfinalize-single-match.ts`
- `src/lib/matches/resolve-or-create-match-round-for-date.ts`
- `src/lib/assistant/get-assistant-command-centre.ts`
- `prisma/migrations/20260821100000_match_round_status_enum/`

## History

- 2026-08-21: Accepted and implemented in the same change. Full test suite (2630 tests) passing
  against local Postgres before and after the migration; typecheck, lint, build, docs/terminology/
  architecture checks, and policy verification all clean.
