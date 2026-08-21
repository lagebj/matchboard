# ADR-0084: Automate the production database migration pipeline

## Status

Accepted

## Date

2026-08-21

## Context

Production schema migrations were previously a two-step manual process: a `production-db-audit.yml`
workflow (manual `workflow_dispatch`) to check migration status, then a separate
`production-db-migrate.yml` workflow (manual `workflow_dispatch`, requiring a typed confirmation
string `MIGRATE_PRODUCTION`) to apply pending migrations. Both required the coach to remember to
trigger them after merging a schema-affecting PR — nothing detected that a migration was pending or
prompted the action. In practice this created a real gap: ADR-0083's `MatchRoundStatus` migration
merged to `main` via PR #322 and sat unapplied against the production database while the
already-deployed app code depended on the fixed behavior it enabled (harmlessly, in this case,
because the existing `MatchRound_status_check` CHECK constraint already permitted both enum
values — but this was luck, not a guarantee the pipeline provided).

The request was to automate the full flow into production, contingent on preserving the right
quality/safety gates — not to remove human oversight from production schema changes.

Two things were verified empirically before designing the new pipeline, not assumed:

1. **The `production-db` GitHub Environment's `required_reviewers` protection rule applies
   regardless of trigger type.** Confirmed via `gh api repos/lagebj/matchboard/environments/
   production-db` — a job targeting this environment pauses for approval whether it was started by
   `workflow_dispatch` or by an automatic event like `workflow_run`. This is what makes automating
   the *trigger* safe: the human approval checkpoint is a property of the environment, not the
   trigger mechanism, so removing manual `workflow_dispatch` as the only way to start the job does
   not remove the gate.
2. **`prisma migrate diff --exit-code --from-config-datasource --to-schema=prisma/schema.prisma`
   — the command both old workflows used as their final "is everything applied correctly"
   check — is not a reliable pending/up-to-date signal.** It was run against a freshly reset,
   fully-migrated local database (83 migrations applied, zero pending) and still reported a large,
   pre-existing, unrelated diff: numerous "Added index on columns (organisationId)" entries, index
   renames, and FK differences between the declarative `schema.prisma` and the actual migration
   history (most likely from earlier raw-SQL RLS/index migrations that do not perfectly mirror the
   Prisma schema model). This means the old `production-db-migrate.yml`'s final verification step
   has likely shown a non-zero exit code on every run, including fully successful ones — a
   pre-existing, previously-undiagnosed reliability gap in the old tooling. It is not something this
   ADR fixes (the drift itself is out of scope), but it must not be used as a gate in the new
   pipeline. `prisma migrate status`'s exit code (0 = up to date, 1 = pending) was confirmed
   reliable by direct comparison against the same databases and is used instead.

## Decision

### Trigger: automatic after CI, with manual fallback

The two old workflows are consolidated into one: `.github/workflows/production-db-migrate.yml`,
triggered by:

- `workflow_run` on the `CI` workflow (`ci-checks.yml`), `types: [completed]`, filtered to
  `branches: [main]` and additionally guarded in the job's `if:` by
  `github.event.workflow_run.head_branch == 'main'` and `.conclusion == 'success'` — belt-and-lease
  defense in depth beyond the trigger-level filter alone. This means the pipeline only ever runs
  after CI has actually passed on a push to `main` (a squash-merge), never on a PR branch's CI run,
  and never when CI itself failed. A red `main` never reaches the approval gate.
- `workflow_dispatch` — kept as a manual fallback for re-running after a missed/expired approval
  window, or triggering ad hoc without waiting for a new CI event.

### Two-job structure: unattended check, gated migrate

1. **`check`** (no environment, runs unattended): resolves the correct ref to check (the
   triggering workflow's `head_sha` for `workflow_run`, or `main` for manual dispatch), then runs
   `scripts/check-pending-migrations.mjs` against the production datasource. This script:
   - Uses `prisma migrate status`'s exit code as the pending/not-pending signal (see Context above
     for why `migrate diff --exit-code` was rejected).
   - Parses pending migration names out of `migrate status`'s text output when migrations are
     pending.
   - Scans each pending migration's `migration.sql` for destructive SQL patterns (`DROP TABLE`,
     `DROP COLUMN`, `TRUNCATE`, `DELETE FROM ... ;` with no `WHERE`, `DROP TYPE`) via case-
     insensitive regex.
   - Writes `has_pending` / `has_destructive` job outputs and a markdown job-summary table so an
     approver sees exactly what is pending and whether anything destructive was flagged, before
     they approve.
   - Exits non-zero only on a genuine unexpected failure (e.g. a migration stuck in a failed
     state, or output in a format it can't parse) — a pending migration is not treated as a script
     failure.
2. **`migrate`** (targets the `production-db` GitHub Environment, so `required_reviewers` gates
   it): only runs when `check` reports `has_pending == 'true'`. Applies migrations via
   `npm run db:migrate` (`prisma migrate deploy`), then re-verifies via `prisma migrate status`
   (the same reliable exit-code check, not `migrate diff --exit-code`), then records — for
   informational purposes only, not as a pass/fail gate — the resulting `migrate diff` output,
   since it is expected to be non-zero even on success per the Context finding above.

No destructive-operation hard-block was added beyond the job-summary warning: the user's own
design decision (via AskUserQuestion) was to scan and flag, not to block, since CI's existing
"Migration from Zero" check already covers full-history migration safety independently, and a hard
block would need to distinguish "destructive but intentional and reviewed" from "destructive by
mistake" — a distinction the approval gate itself already exists to make. The flag surfaces the
information the approver needs; it does not pre-empt their judgment.

`production-db-audit.yml` is deleted — its only function (checking migration status) is now the
first half of every `production-db-migrate.yml` run, and its own final verification step used the
same now-rejected `migrate diff --exit-code` command.

### What did not change

- The `production-db` GitHub Environment and its `required_reviewers` protection rule are reused
  as-is — no new approval mechanism was introduced.
- `npm run db:migrate` (`prisma migrate deploy`) remains the actual migration command.
- Migrations are still never run as part of the Vercel build process.
- `prisma migrate dev` against production remains forbidden (unchanged; this pipeline only ever
  runs `migrate deploy`, never `migrate dev`).

## Consequences

- The coach no longer needs to remember to manually trigger two separate workflows after merging a
  schema-affecting PR. CI passing on `main` is now sufficient to reach the approval gate
  automatically; the coach's only remaining action is to approve (or not) the `migrate` job via
  the existing GitHub Environment review UI.
- The previously-undiagnosed `migrate diff --exit-code` unreliability is now documented and no
  longer used anywhere in the production migration pipeline. The underlying schema/migration-
  history drift it was reporting is unresolved and out of scope for this ADR; if it needs fixing,
  that is separate future work.
- A destructive-operation flag now surfaces directly in the approver's job summary before they
  approve a migration, for every future production migration — not just this one.
- The outstanding ADR-0083 (`MatchRoundStatus`) migration was not yet applied to production as of
  this change. Once this pipeline merges to `main`, its own CI run will be the first real trigger:
  the `check` job will detect that migration as pending and the `migrate` job will wait for
  approval — the first live use of this new pipeline, not a special case handled separately.

## Related

- ADR-0083 (`docs/adr/0083-match-round-status-enum.md`) — the pending migration that motivated
  this request
- `.github/workflows/production-db-migrate.yml`
- `scripts/check-pending-migrations.mjs`
- `AGENTS.md` — "Production migrations" section, updated in the same change

## History

- 2026-08-21: Accepted and implemented in the same change.
