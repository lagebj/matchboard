# ADR-0072: TRUNCATE-first test database cleanup

## Status

Accepted

## Date

2026-08-19

## Context

`cleanTestDb()` (`src/test/test-db.ts`) wipes every application table before tests run, using
one `deleteMany()` call per table (~80 tables) in dependency-safe order. Many test files call it
in `beforeEach`, not just `beforeAll`, so this sequence runs before nearly every individual test
across the ~2,600-test suite.

Each `deleteMany()` call is a separate network round trip. Against `localhost` (the Docker
Compose Postgres CI uses, and `.env.example`'s documented default), that round trip is
sub-millisecond and the cost is negligible. Against a remote Neon branch — a supported,
documented alternative for environments where local Docker isn't available, including this
repository's sandboxed Claude Code devcontainer, which has no Docker at all — the same round
trip costs ~30-40ms (measured directly against this repository's Neon `test` branch,
`eu-central-1`). Multiplied by ~80 tables and thousands of test-level cleanups, this is the
dominant cost of a full local `npm test` run: measured at ~26 minutes locally against Neon,
versus ~2-3 minutes in CI against local Postgres. `sec3-assurance.test.ts` alone (31 tests, each
calling `cleanTestDb()` in `beforeEach`) took ~109s.

Local Docker Postgres is the primary recommended fix for this on any machine where Docker is
available — it eliminates the network round trip entirely, matching CI. But some environments
(notably this repository's own Claude Code devcontainer, and any contributor who deliberately
targets a Neon branch, e.g. to test against production-like latency/behavior) cannot or do not
use local Docker, and for them the round-trip count itself remains the bottleneck regardless of
target database. Reducing the round-trip count is a universal win — even against `localhost`, 80
round trips per test is unnecessary overhead compared to one.

## Decision

`cleanTestDb()` now tries a single dynamic `TRUNCATE TABLE ... CASCADE` statement first — one
round trip, discovers every table in the `public` schema at runtime (excluding
`_prisma_migrations`) rather than hardcoding a table list, so it never drifts out of sync with
schema changes. If that statement fails for any reason, it falls back to the original per-table
`deleteMany()` sequence unchanged — this is a silent, safe degradation, not a hard requirement.

The most common failure mode is a missing `TRUNCATE` privilege: Postgres treats `TRUNCATE` as a
separate grantable privilege from `DELETE`/`INSERT`/`UPDATE`/`SELECT`, and the `TEST_DATABASE_URL`
role on this repository's Neon `test` branch only had the latter. Granted once (see
`docs/development/test-architecture.md`'s "cleanTestDb() performance" section for the exact
statements, including `ALTER DEFAULT PRIVILEGES` so future migrations' tables are covered too).
Local Docker's default role already owns its tables and needs no such grant.

This requires `$executeRawUnsafe()` — forbidden in application code by both
`scripts/check-forbidden-sql.ts` (`npm run security:check-sql`, part of `npm run validate`) and
`src/test/security-audit.test.ts`'s equivalent vitest check. `src/test/test-db.ts` is added to
both files' narrow allowlists, alongside the existing `src/lib/tenancy/tenant-client.ts`
precedent. This is judged safe and proportionate because:

- The SQL string is fully static — no interpolation of any external, user-controlled, or
  per-request value. The only "dynamic" part (the discovered table list) comes from
  `pg_tables`/`quote_ident()` inside the same statement, not from application input.
- `src/test/test-db.ts` is test-only infrastructure, never imported by application code, never
  reachable from a request path.
- The existing fallback means a failed or blocked TRUNCATE never breaks test setup — it just
  loses the speed benefit.

## Consequences

- `npm run policy:verify`-style "does this actually work" verification: confirmed empirically,
  not just in theory — `sec3-assurance.test.ts` dropped from ~109s to ~28s (~4x) with the
  privilege granted on this repository's Neon `test` branch.
- Anyone standing up a fresh Neon branch for `TEST_DATABASE_URL` should run the one-time grant
  documented in `docs/development/test-architecture.md`, or accept the original (safe, just
  slower) sequential-delete behavior.
- `src/test/test-db.ts` joins a narrow, explicit, two-place allowlist for raw SQL — any future
  addition to that allowlist should meet the same bar (static SQL, test-only, no external input)
  and be called out explicitly, not treated as precedent for loosening the rule generally.
- Local Docker Postgres remains the primary recommendation for anyone who can use it; this
  change specifically helps environments (like this repository's own Claude Code devcontainer)
  that cannot.

## Related decisions

- None — first ADR covering test-database cleanup strategy.

## History

- 2026-08-19: Accepted. TRUNCATE-first `cleanTestDb()` with sequential-delete fallback; one-time
  `TRUNCATE` grant applied to this repository's Neon `test` branch; `src/test/test-db.ts` added
  to the raw-SQL allowlist in both enforcement points.
