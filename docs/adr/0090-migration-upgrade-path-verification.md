# ADR-0090: Migration upgrade-path verification against a populated Neon branch

## Status

Accepted

## Date

2026-08-24

## Decision owners

- Matchboard engineering

## Context

ARR-0026 (Architecture Integrity Programme, AIP-0 baseline) found that every migration check in
this repository — `scripts/verify-migration-from-zero.sh`, `ci-checks.yml`'s
`migration-from-zero` job, and `scripts/check-pending-migrations.mjs` (the production pipeline's
`check` job, ADR-0084) — only ever proves a migration is safe against an **empty** database, or
scans its SQL text for destructive keywords. None of them apply a pending migration to a database
that already has rows. This already caused a real production incident (2026-08-22/23, the
`enum_fields_native_postgres_enums` migration — passed from-zero CI, failed against populated
production data, documented in ADR-0084's History).

## Decision

A new check, `scripts/verify-migration-upgrade.sh` (wired to a new `migration-upgrade-from-populated-state`
CI job in `ci-checks.yml`, and a new `verify-migration-upgrade` swamp `command/shell` model), forks
a **disposable Neon branch from the persistent `test` branch** — which already carries real,
ongoing test/CI data at its current migration state, the exact same populated-copy-branch pattern
`scripts/test-acceptance/deploy.sh` already uses for per-PR isolation (`neonctl branches create
--parent test`) — applies whatever migrations are pending relative to that branch, verifies a set
of invariants (below), then always deletes the branch.

### Why forking the persistent "test" branch, not a synthetic fixture

- No production data is ever touched or copied into the repository — the check only ever forks
  the already-separate `test` Neon branch, never `production`.
- It requires no new seed/fixture maintenance: the `test` branch is kept realistic and current by
  the *existing* `test-db-migrate.yml` workflow (which migrates it after every merge to `main`)
  and by ongoing Playwright/manual use of `test.matchboard.football` — this check rides on data
  that already exists and is already trusted for another purpose, rather than inventing a second,
  parallel "representative dataset" concept to keep in sync with schema changes over time.
- It naturally produces the exact "populated previous state -> pending migrations" scenario for
  any PR that adds a new migration: the `test` branch is only as current as the last
  `test-db-migrate.yml` run (which fires post-merge), so a PR containing a new migration is
  expected to show up as "pending" relative to it — no separate baseline-selection logic needed.

### What is verified

1. `prisma migrate status` against the forked branch — if nothing is pending, the check passes
   trivially (nothing new to verify) rather than forcing an artificial migration.
2. Row counts for a representative cross-section of tables (`Organisation`, `Team`, `Player`,
   `Match`, `MatchRound`, `Selection`, `PostMatchReport`, `Goal` — tenant root, core setup,
   planning, and Learn-phase output) captured before `prisma migrate deploy`, then re-checked
   after — any decrease fails the check, catching silent data loss a schema-only check would miss.
3. `prisma migrate deploy` itself succeeding is the primary signal for constraint/enum/data
   conversion problems: a `NOT NULL` column added without a default, a new unique constraint
   violated by existing duplicate rows, or an enum value removed while still referenced all fail
   at this step against populated data, exactly the failure class the from-zero check cannot see.
4. A post-migration application-level read (`organisation.count()` + a sample `findFirst`) —
   proving the application can actually read expected records afterward, not just that the SQL
   applied without a database-level error.

### Where it runs: CI only, not also `production-db-migrate.yml`

Wired into `ci-checks.yml` as a new job (`migration-upgrade-from-populated-state`), gated on
`NEON_API_KEY`/`NEON_PROJECT_ID` being configured (skips cleanly otherwise, same pattern as the
`e2e` job's `TEST_AGENT_AUTH_SECRET` gate) — **not** duplicated into
`production-db-migrate.yml`'s `check` job. Running in CI catches a bad migration before merge
(ARR-0026's acceptance criterion: "A bad migration ordering/conversion can fail before production
deployment"), which is strictly earlier and more useful than only catching it at the production
deploy gate. Adding a second, redundant Neon branch fork+delete cycle to every production deploy
attempt would slow that pipeline down and consume Neon branch-creation quota for a check CI
already performed on the same commit.

## Rationale

- Reusing the exact `neonctl branches create --parent test` / `connection-string
  --role-name matchboard_admin_migration` pattern `test-acceptance/deploy.sh` already established
  means no new Neon interaction pattern, no new secret, and no new failure mode to reason about —
  the same repo secrets (`NEON_API_KEY`, `NEON_PROJECT_ID`) already power this exact operation
  elsewhere.
- A representative-table row-count check is cheap, fast, and catches the single most common
  silent-failure shape (a migration that "succeeds" but drops or orphans rows) without requiring
  per-migration custom assertions — the check is generic and applies to every future migration
  automatically, not just the one that prompted this ADR.
- Per AGENTS.md's swamp-procedure rule, the shell logic is wrapped in a `command/shell` swamp
  model (`verify-migration-upgrade`) alongside the pre-existing `verify-database-change`, so a
  future coding-agent session can discover and reuse it via `swamp model search` rather than
  re-deriving the same Neon-branch-fork logic.

## Alternatives considered

### Reconstruct a historical schema snapshot + seed with raw SQL

- Benefits: fully deterministic, no dependency on the live `test` branch's current state
- Costs: Prisma Client is generated from the *current* `schema.prisma` — it cannot correctly
  read/write a database missing later migrations' columns/tables, so seeding an intermediate
  schema state would require either raw SQL (bypassing all of Prisma's type safety and this
  script's own maintainability) or checking out and generating a second, historical Prisma Client
  — meaningfully more complexity for a check that needs to stay simple enough to run on every PR
- Reason not selected: the persistent `test` branch already *is* a populated previous state,
  current by construction; reusing it is strictly simpler and equally valid evidence

### A committed, versioned seed fixture representative of "typical populated data"

- Benefits: fully deterministic and repo-visible
- Costs: a second dataset to keep schema-compatible over time, on top of the existing seed
  scripts (`seed-test-dataset.ts`, `seed-demo.cjs`) and the live `test` branch — three sources of
  "what representative data looks like" instead of one
- Reason not selected: the `test` branch is already the project's actual standard populated-state
  reference (per the AIP-5 spec's own allowance: "isolated Neon branch if that is already the
  project-standard safe path")

### Duplicate the check into `production-db-migrate.yml` as well

- Benefits: defense-in-depth at the final gate
- Costs: redundant Neon branch fork/delete cycle on every production deploy attempt for a
  check that already ran on the same commit in CI; slower pipeline, more Neon API usage
- Reason not selected: CI already covers the same commit earlier; not selected now, but nothing
  prevents adding it later if evidence shows CI coverage is being bypassed somehow

## Consequences

### Positive

- Every future migration is automatically tested against a populated database in CI, closing the
  exact gap that caused the 2026-08-23 production incident.
- No new dataset to maintain — rides on already-current, already-trusted `test` branch data.
- Discoverable via `swamp model search` for future sessions.

### Negative

- The check is only as good as how current/representative the `test` branch's data actually is —
  if it happens to be nearly empty for some table, this check provides weaker evidence for that
  table specifically. Accepted: it is still strictly more evidence than an empty-database check
  provides today, and the `test` branch's population only grows with ongoing use.
- Requires Neon secrets to run; a fork/agent session without them (or a fully local-only CI
  environment) gets a clean skip rather than coverage. Documented, matching the same trade-off
  already accepted for the `e2e` job.

### Risks and mitigations

- Risk: the ephemeral branch fails to delete on an unexpected script crash, leaking Neon branches
  over time. Mitigation: `trap cleanup EXIT` in `verify-migration-upgrade.sh` runs on any exit
  path (success, failure, or signal), matching the same pattern `deploy.sh`'s `on_failure` trap
  uses; a leaked branch is also easy to spot and manually delete via `neonctl branches list` if
  it ever does happen.
- Risk: representative-table row counts don't catch every possible migration defect (e.g. a
  subtle value-level corruption that doesn't change row count). Mitigation: this check is
  additive evidence, not a claim of exhaustive verification — `check-pending-migrations.mjs`'s
  destructive-keyword scan and the required human-reviewer approval in `production-db-migrate.yml`
  remain in place as further layers.

## Migration and compatibility

- No schema or data migration required — this is tooling/CI only.
- `scripts/verify-migration-from-zero.sh` and the `migration-from-zero` CI job are unchanged and
  remain the from-zero check; this is purely additive.
- Rollback: remove the new CI job, script, and swamp model; no other component depends on them.

## Related records

- ARRs: ARR-0026 (resolved by this ADR)
- ADRs: ADR-0084 (automate production migration pipeline — the pipeline this ADR's check feeds
  evidence into, at the CI stage rather than the deploy stage), ADR-0075 (per-PR feature
  acceptance pipeline — origin of the `neonctl branches create --parent test` pattern this ADR
  reuses)
- Implementation: `scripts/verify-migration-upgrade.sh`, `scripts/verify-migration-upgrade.ts`,
  `.github/workflows/ci-checks.yml` (`migration-upgrade-from-populated-state` job),
  `models/command/shell/verify-migration-upgrade.yaml`,
  `docs/development/swamp-workflows.md`

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-24

Record created. Architecture Integrity Programme AIP-5 (Migration upgrade safety). Resolves
ARR-0026.
