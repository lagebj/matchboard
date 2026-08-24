# ARR-0026: Migration verification only tests from-zero, never a populated previous state

## State

Confirmed

## Identified

2026-08-24 (Architecture Integrity Programme, AIP-0 baseline)

## Residue

Every automated migration check in this repository applies the full migration chain to a freshly
created, empty PostgreSQL database and stops there:

- `scripts/verify-migration-from-zero.sh` (wrapped by the swamp `verify-database-change`
  procedure) creates a new empty database, runs `prisma migrate deploy`, and validates the
  resulting schema — no rows exist at any point.
- `.github/workflows/ci-checks.yml`'s `migration-from-zero` job does the same thing in CI: create
  an empty `matchboard_migrate_verify_<timestamp>` database, `prisma migrate deploy`, drop it.
  The name states the scope precisely.
- `scripts/check-pending-migrations.mjs` (the production pipeline's `check` job, ADR-0084) does
  not apply migrations to any database at all — it uses `prisma migrate status`'s exit code to
  detect pending migrations and a static text scan of the pending migration's SQL for
  destructive keywords (`DROP`/`TRUNCATE`/etc., see `docs/adr/0084-...md:11-19`).

No script or CI job applies a pending migration to a database that already has realistic
populated data from the prior migration state — i.e., no genuine "upgrade path" test. 86
migrations currently exist in `prisma/migrations/`, all of which have only ever been proven safe
against an empty schema.

This matters because "from zero" and "destructive-keyword scan" both miss a real, common failure
class: a migration that is syntactically fine and non-"destructive" by keyword (e.g. `ALTER TABLE
... ADD COLUMN "x" TEXT NOT NULL` with no default, or a new unique constraint that already has
duplicate data) succeeds instantly against an empty table in the from-zero test, but fails or
corrupts data the moment it runs against a table that already has rows — exactly the situation
`production-db-migrate.yml` applies it to. The production pipeline's compensating controls
(human-required-reviewer approval gate, destructive-keyword scan) are real, but neither one
actually replays the migration against production-shaped data before it runs for real.

## Intended architecture

Programme outcome #7 (`.matchboard-work/matchboard-architecture-integrity/PROGRAMME.md` §2):
"Database migration verification tests the upgrade path from a realistic previous populated
state, not only migration from zero."

## Evidence

- `scripts/verify-migration-from-zero.sh:1-13,44-52` — creates an empty database, no seed step.
- `.github/workflows/ci-checks.yml`'s `migration-from-zero` job — empty `CREATE DATABASE`, no
  seed step, drops the database immediately after.
- `scripts/check-pending-migrations.mjs:5-19` — docblock explicitly states it "scans any pending
  migration's SQL for destructive operations"; no database is created or migrated by this script.
- `docs/adr/0084-automate-production-migration-pipeline.md` — describes the `check`/`migrate` job
  split; no mention of testing against populated data anywhere in the ADR.
- `prisma/migrations/` — 86 migration directories, none exercised against non-empty tables by any
  repository automation.

## Impact

- A migration that is safe against an empty schema but unsafe against real data (missing
  backfill for a new `NOT NULL` column, a new unique/foreign-key constraint conflicting with
  existing rows, a column type narrowing that truncates existing values) can pass every
  automated check in this repository and reach the human-approval step in
  `production-db-migrate.yml` with no automated signal that it is unsafe — the reviewer is the
  only check, and the tooling gives them no better evidence than "not obviously destructive by
  keyword."
- This is exactly the failure mode ADR-0084's History entry already documents happening once in
  production (a migration's own SQL failed partway through applying, requiring
  `resolve_migration`) — the incident that added FAILED-state detection to
  `check-pending-migrations.mjs`. That fix detects a mid-apply failure after the fact; it does not
  prevent one.

## Containment

- Do not treat a green `migration-from-zero` CI job as evidence a migration is safe to apply to
  production — it only proves the migration chain is internally consistent against an empty
  schema, not that it is safe against existing data.
- Before merging a migration that alters an existing column's nullability, type, or adds a new
  constraint on a table with production rows, manually verify against a populated copy (e.g. a
  Neon branch forked from the production or test branch) until an automated upgrade-path check
  exists.

## Resolution criteria

- A new or extended check applies each pending migration to a database seeded with realistic
  populated data (e.g. a fork/copy of the `test` Neon branch, or the demo seed dataset) before
  it is treated as verified — not just an empty schema.
- The check runs as part of CI or the production migration pipeline's `check` job, with clear
  pass/fail signal distinct from the existing destructive-keyword scan.
- Assigned to AIP-5 (Migration upgrade safety) in the Architecture Integrity Programme.

## Disposition

Open. Scoped to AIP-5.

## Related decisions

- ADR-0084: Automate production migration pipeline (Accepted) — establishes the current
  check/approve/apply pipeline this ARR's gap sits inside.

## Related implementation

- `scripts/verify-migration-from-zero.sh`
- `scripts/check-pending-migrations.mjs`
- `.github/workflows/ci-checks.yml` (`migration-from-zero` job)
- `.github/workflows/production-db-migrate.yml`
- `prisma/migrations/`

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-24

Identified during AIP-0 baseline verification of the Architecture Integrity Programme's starting
hypothesis F-005. Confirmed by direct inspection of every migration-related script and CI job in
the repository — none applies a pending migration to a database with existing rows.
