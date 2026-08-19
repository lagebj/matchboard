# ADR-0074: Native Postgres in the sandboxed devcontainer, pinned to Neon's version

## Status

Accepted

## Date

2026-08-19

## Context

ADR-0072 fixed `cleanTestDb()`'s round-trip count, but that alone didn't close the gap to CI's
test speed for this repository's sandboxed Claude Code devcontainer — that devcontainer has no
Docker at all (confirmed: `unshare()` returns `EPERM`, `cgroup2` is mounted read-only and can't
be remounted even as root — a hard sandbox restriction, not a missing package), so it couldn't
use `docker-compose.yml`'s local Postgres the way a real Docker-capable devcontainer or CI can,
and was left pointing `TEST_DATABASE_URL`/`DATABASE_URL` at remote Neon branches as the only
option.

Separately, while confirming Neon's actual Postgres version to align local tooling with it
(`SELECT version()` against a live Neon branch), a pre-existing three-way version mismatch
surfaced: Neon runs PostgreSQL 17.11, `docker-compose.yml` pinned `postgres:18-alpine`, and
`.github/workflows/ci.yml`/`security.yml`'s service containers pinned `postgres:16` — three
different major versions, none matching each other or the actual production/test database
engine.

## Decision

1. **Install a native `postgresql-17` server in the devcontainer** (`.devcontainer/Dockerfile`,
   via the official PGDG apt repository since Debian bookworm's own repo only carries 15) —
   no containerization needed, since a plain server process doesn't require `unshare()`,
   cgroups, or any other capability the sandbox blocks. `.devcontainer/setup-local-postgres.sh`
   idempotently creates the cluster if missing, starts the service, creates the `matchboard`
   role and `matchboard`/`matchboard_test` databases (matching `docker-compose.yml` and
   `.env.example`'s documented local-dev defaults exactly), and applies migrations. Runs on
   every `post-create.sh` (full setup) and `post-start.sh` (ensure running after a container
   restart) — every step no-ops cleanly if already done.
2. **Pin all local/CI Postgres targets to major version 17**, matching Neon exactly:
   `docker-compose.yml`'s `postgres:18-alpine` → `postgres:17-alpine`;
   `ci.yml`/`security.yml`'s `postgres:16` service containers → `postgres:17`. The devcontainer's
   `postgresql-17` install uses the same pin (`ARG POSTGRES_VERSION=17` in the Dockerfile) so all
   four (Neon, devcontainer, docker-compose, CI) now agree.

## Consequences

- This repository's sandboxed Claude Code devcontainer can point `DATABASE_URL`/`DIRECT_URL`
  (interactive `npm run dev`) and `TEST_DATABASE_URL`/`TEST_DATABASE_DIRECT_URL` (`npm test`) at
  `localhost:5432` without needing Docker, matching what a Docker-capable devcontainer or CI
  already does. The Neon `dev` branch this devcontainer previously depended on for interactive
  local development is no longer needed from it.
- `vitest.config.ts`'s `fileParallelism: false` was tested directly against local Postgres, not
  just left alone out of caution: enabling it produced real, reproducible test failures within
  minutes (`clear-draft-selection.test.ts` failing 8/8 assertions it normally passes) —
  `cleanTestDb()` unconditionally truncates every table, so any two files running concurrently
  against the same database race regardless of whether that database is local or remote. Safe
  parallelism would need per-worker database/schema isolation, a separate restructuring project,
  not a config flag. It stays disabled.
- Whether local Postgres actually closes the wall-clock gap to CI is **not settled by this ADR**
  — see `docs/development/test-architecture.md`'s "Local Postgres latency is not stable in this
  sandboxed devcontainer" section. Local round-trip latency here was measured degrading from
  genuinely sub-millisecond to ~28-32ms after sustained heavy I/O, persisting through a Postgres
  service restart, and affecting raw `pg` exactly as much as Prisma-wrapped queries — the leading
  suspect is Docker Desktop's virtualized network path under this devcontainer's sandbox, not
  anything in this repository's code. Do not treat a same-session timing comparison as
  conclusive; the TRUNCATE fix (ADR-0072) is the one independently-verified, unconditional win
  regardless of this open question.
- Schema/migration behavior now runs against the same major Postgres version everywhere
  (Neon, this devcontainer, `docker-compose.yml`, CI), removing a source of "works in one
  environment, subtly differs in another" risk from version drift.
- `.devcontainer/setup-local-postgres.sh` detects the installed server's major version at
  runtime (checking for an actual `initdb` binary, not just a `postgresql-client-<N>`-created
  directory) rather than hardcoding it, so it doesn't need editing if the Dockerfile's pinned
  version changes later.
- The Neon `test` branch is unaffected and still required — it's what backs the deployed Vercel
  Test app (`test.matchboard.football`) and Playwright browser-acceptance tests, a different
  concern from local `vitest` runs.

## Related decisions

- `docs/adr/0072-truncate-based-test-cleanup.md` — the round-trip-count fix this builds on.
- `docs/adr/0057-prisma-where-clause-injection-for-tenant-isolation.md` (tenant isolation / Neon
  adapter notes) — unaffected; this ADR doesn't change the runtime Neon adapter behavior, only
  local/CI Postgres targets and version.

## History

- 2026-08-19: Accepted. Native Postgres installed in the devcontainer; version pinned to 17
  across devcontainer, `docker-compose.yml`, and CI to match Neon.
