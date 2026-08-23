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

### Secret scoping: a separate read-only role for the unattended check

The first real run of this pipeline (triggered by the merge that shipped it) failed immediately:
the `check` job's `DATABASE_URL`/`DIRECT_URL` came through empty, and `prisma generate` (run by
`npm ci`'s `postinstall` hook) crashed validating its config. Root cause: `PRODUCTION_DATABASE_URL`
is a secret scoped to the `production-db` GitHub Environment (both old workflows' single job
always declared that environment, which is why this was never visible before). A job only sees an
environment-scoped secret if it declares that `environment:` — and `check` deliberately does not,
specifically so it can run unattended without waiting for approval. The two requirements
(unattended check, environment-scoped credential) are mutually exclusive for the same secret.

The fix is a second, narrower credential: `matchboard_migration_status`, a Postgres role granted
only `CONNECT` on the database and `SELECT` on `_prisma_migrations` — nothing else. It cannot read
any application table (verified directly: querying `"Organisation"` with this role returns
`permission denied for table Organisation`), so exposing it as a plain repo-level secret
(`PRODUCTION_DATABASE_URL_STATUS_CHECK`, not environment-scoped) carries none of the risk that
justified gating `PRODUCTION_DATABASE_URL` behind an environment in the first place. Confirmed by
direct test that this role is sufficient to run `prisma migrate status` and
`scripts/check-pending-migrations.mjs` successfully end-to-end against the real production
database.

Creating this role surfaced a second, Neon-specific pitfall, now documented in
`scripts/create-migration-status-role.sh`'s own header comment: a role created through Neon's
control-plane API (`neonctl roles create`) is automatically added to the `neon_superuser` group
role, and that membership cannot be revoked afterward by `neondb_owner` alone (`neondb_owner` has
`CREATEROLE` but not `ADMIN OPTION` on a role it did not itself create) — confirmed by hitting
exactly that error live. The role had to be deleted and recreated via direct SQL
(`CREATE ROLE ... NOBYPASSRLS`, matching `scripts/create-rls-roles.sh`'s existing convention for
`matchboard_app_runtime`/`matchboard_admin_migration`) to avoid the automatic membership entirely.
This is the same caveat that script's own header comment already named for Neon Console-created
roles; it turns out to apply equally to API-created ones.

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
- `scripts/create-migration-status-role.sh`
- `scripts/create-rls-roles.sh` — established the NOBYPASSRLS/direct-SQL role-creation convention
  this ADR's read-only role follows
- `AGENTS.md` — "Production migrations" section, updated in the same change

## History

- 2026-08-21: Accepted and implemented.
- 2026-08-21: First live run failed on secret scoping (see "Secret scoping" above). Fixed same day
  by provisioning `matchboard_migration_status`, a minimal read-only role, and a new repo-level
  `PRODUCTION_DATABASE_URL_STATUS_CHECK` secret for the `check` job specifically.
- 2026-08-23: The pipeline's first real FAILED-migration incident. `platform-integrity-programme`'s
  closure PR (#337) shipped `20260822160000_enum_fields_native_postgres_enums`, which renames
  `EventMatchSupportAssignment.plannedRole` values from human-readable labels ('GK cover', ...)
  to SCREAMING_SNAKE_CASE enum keys ('GK_COVER', ...) via `UPDATE` statements, then converts the
  column to a real Postgres enum. The migration dropped the OLD check constraint (added in
  `20260802120000_add_enum_check_constraints`, which only allows the human-readable labels) *after*
  those `UPDATE` statements instead of before. Locally and in CI this was invisible — neither
  database had a row with `plannedRole = 'General cover'` to exercise the bug — but production did,
  and the `migrate` job failed with `P3018`: `new row for relation "EventMatchSupportAssignment"
  violates check constraint "EventMatchSupportAssignment_plannedRole_check"`. Prisma then marked
  the migration FAILED in its bookkeeping (`_prisma_migrations`), which blocks `migrate deploy`
  from attempting anything else until explicitly resolved (`prisma migrate resolve`) — exactly the
  "migration stuck in a failed state" case this ADR's `check` job design already anticipated
  (see "Decision" above, item 1's bullet on `check`'s exit-non-zero conditions) but never built a
  recovery path for.

  Fixed the migration file itself (reordered: `DROP CONSTRAINT` now runs before the value-renaming
  `UPDATE`s) and added the actual missing recovery path: `production-db-migrate.yml` gained a
  `workflow_dispatch` `resolve_migration`/`resolve_mode` input pair and a new
  `resolve-failed-migration` job (gated by the same `production-db` environment approval as every
  other production-touching job — no new approval mechanism, reusing the existing one per this
  ADR's "What did not change" section) that runs `prisma migrate resolve` on demand.
  `check-pending-migrations.mjs` also gained explicit detection of Prisma's "Following migration
  have failed:" output format (previously fell through to a generic "could not parse output"
  failure, which was safe — it still refused to proceed blind — but didn't tell the approver what
  was actually wrong or how to fix it).

  This does not change any earlier consequence of this ADR: the `migrate` job is still the only
  job that ever mutates production, still requires the same human approval, and `prisma migrate
  dev` is still never run anywhere near production. It only adds a way to clear Prisma's own
  failed-migration bookkeeping — a metadata operation, not a schema/data change — through the same
  authenticated, approval-gated pipeline instead of requiring an out-of-band manual command against
  production credentials this pipeline was specifically built to avoid.

- 2026-08-23 (same day, second finding): resolving the FAILED bookkeeping above and re-running
  `migrate deploy` failed again, differently: `Error: P1... type "PostMatchAttendanceStatus"
  already exists` (Postgres code 42710) on the very *first* statement in the migration file. This
  disproved an assumption made while writing the first fix: that Prisma wraps an entire
  `migration.sql` file in one all-or-nothing transaction, so a mid-file failure would leave the
  database exactly as it was before the attempt. It does not. Confirmed directly: every `CREATE
  TYPE` and every field conversion before the `EventMatchSupportAssignment.plannedRole` block (the
  last block in the file, where the original bug lived) had already committed successfully during
  the *first* failed attempt — only the final block never got a chance to run. Prisma's own
  `migrate resolve --rolled-back` vs `--applied` choice was itself the tell this was missed the
  first time: Prisma cannot know whether a failed migration's DDL actually rolled back, which is
  exactly why it asks the operator to say which happened, rather than checking automatically.

  Fixed by making the migration file idempotent/resumable from any partial-failure point rather
  than assuming a clean slate: each `CREATE TYPE` wrapped in a `DO $$ ... EXCEPTION WHEN
  duplicate_object THEN NULL; END $$;` guard, and the two blocks with value-*rewriting* `UPDATE`s
  (`EventPostMatchPlayer.attendanceStatus`'s `'ABSENT'` → `'NO_SHOW'` fix, and
  `EventMatchSupportAssignment.plannedRole`'s five label renames) guarded to only run while their
  column is still `text` — re-running either after the column is already the target enum type
  would itself error (`invalid input value for enum`), since the old string values are not valid
  labels of the new enum. Every other statement in the file (`DROP CONSTRAINT IF EXISTS`, `DROP
  DEFAULT`, `ALTER COLUMN TYPE ... USING` as a same-type self-cast, `SET DEFAULT`) was already
  naturally idempotent and needed no change — verified by re-deriving, from the exact error message
  and the file's linear top-to-bottom statement order, precisely which statements the first failed
  attempt reached and which it did not, rather than guessing.

  Verified locally before touching production again, against two disposable scratch databases (not
  the shared Neon branches): (1) the corrected file applies cleanly from a fully fresh
  86-migration-from-zero state, and (2) applying only the first 85 migrations, then manually
  reproducing the exact partial-commit state the first failed attempt left behind (all six enum
  types plus all seven other field conversions applied, `plannedRole` still original text with a
  real `'General cover'` row and the old check constraint), the corrected migration completes
  cleanly and the row correctly ends up as `'GENERAL_COVER'`.
