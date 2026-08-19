# ADR-0068: Adopt Swamp Club as the procedure runner

## Status

Accepted

## Date

2026-08-19

## Context

`package.json` has 54 scripts and `scripts/` has 29 files, with no discoverable index. Coding
agents (and human developers) repeatedly rediscover the same verification and investigation
commands each session. The consolidation programme's internal planning document (gitignored,
not repo-tracked) named this gap "Swamp" and specified an initial procedure set:
`verify-repository`, `verify-security`, `verify-database-change`, `deploy-test-candidate`,
`verify-test-candidate`, `release-test-candidate`, `restore-test-baseline`,
`investigate-ci-failure`, `inspect-deployment`.

An initial implementation in this branch built a custom `scripts/swamp.sh` bash dispatcher
before discovering that "Swamp" is an actual product — [Swamp
Club](https://swamp-club.com) (source at
[github.com/systeminit/swamp](https://github.com/systeminit/swamp)) — explicitly designed to
give AI coding agents (Claude Code, Cursor, OpenCode, Codex) a deterministic, repeatable
procedure layer (models, workflows, vaults, extensions) matching the internal planning
document's description almost exactly. Given Matchboard's devcontainer already runs both Claude
Code and OpenCode side by side, this is a strong fit rather than a coincidence. The custom
dispatcher was discarded in favor of adopting the real product.

### Licensing and telemetry (accepted risk)

The `swamp-club/swamp` source repository is AGPLv3 (with a COPYING-EXCEPTION file). The
officially distributed CLI binary (installed via `swamp-club.com/install.sh`) is governed by a
**separate, proprietary Software License Agreement**: closed-source terms, no reverse
engineering, no redistribution, and telemetry described as mandatory — "automation event logs,
workflow execution records, agent activity data" sent to swamp-club.com, with EULA language that
users "agree not to disable, circumvent, or interfere" with that collection. A `--no-telemetry`
CLI flag exists per-invocation, which is in direct tension with that EULA language; this
tension is not resolved here.

**Decision (explicit, user-authorized):** use the official binary, pass `--no-telemetry` on
every invocation this repository authors (the 9 models below, and any future ones). Two residual
gaps are accepted rather than silently assumed away:

1. No persistent/global telemetry-disable configuration exists (checked `swamp config list` —
   only `update.auto`/`update.cadence` are configurable; checked the binary for a
   `DO_NOT_TRACK`-style environment variable — none found). Telemetry can only be suppressed
   per-invocation.
2. `swamp repo init` auto-generated `.opencode/plugins/swamp-audit.ts`, a managed file (marked
   "will be overwritten on swamp upgrade") that calls `swamp audit record --from-hook` after
   every OpenCode Bash tool invocation, without a `--no-telemetry` flag. Whether `audit record`
   is purely a local `.swamp/audit/` write or also feeds the OpenTelemetry-based usage pipeline
   was not conclusively determined. This file is Swamp-managed, not repository-owned, so it was
   not hand-edited.

This is a deliberate, documented risk acceptance, not an oversight. Licensing/vendor decisions
belong to the Matchboard maintainer per `AGENTS.md`; the maintainer made this call directly.

### command/shell for CLI-wrapping procedures (accepted deviation)

Swamp's own managed `CLAUDE.md` section states: "The `command/shell` model is ONLY for ad-hoc
one-off shell commands, NEVER for wrapping CLI tools or building integrations," and instructs
searching `swamp extension search`/`swamp model type search` first. No official `@swamp/*`
extension exists for GitHub, Vercel, or Postgres/Neon — only third-party community extensions
from individual, unverified-trust maintainers (`@webframp/github`, `@goodcraft/vercel`,
`@thomas/postgres-admin`). Writing a Matchboard-owned typed extension was considered and rejected
for this first packet as disproportionate effort for thin wrappers around CLIs (`gh`, `vercel`,
`curl`) that are already installed, authenticated, and documented as sanctioned in
`.devcontainer/README.md`.

**Decision (explicit, user-authorized):** use `command/shell` for all 9 procedures, including
the 3 that wrap `gh`/`vercel`/`curl` (`investigate-ci-failure`, `inspect-deployment`,
`verify-test-candidate`). This is a known, documented deviation from Swamp's own house rule, not
an oversight. Revisit if these procedures grow beyond thin wrapping (more methods, structured
typed output, reuse across many workflows) — at that point a Matchboard-owned extension under
`extensions/models/` becomes the correct choice per the same rule.

## Decision

Adopt Swamp Club. Repository initialized via `swamp repo init --tool claude --tool opencode`
(see `.swamp.yaml`, the managed `CLAUDE.md` section, `.opencode/plugins/swamp-audit.ts`, and the
`.gitignore` additions it made). Nine `command/shell` models under `models/command/shell/`
implement the procedure set:

| Model | What it wraps | Notes |
|---|---|---|
| `verify-repository` | `npm run validate` | unchanged composite |
| `verify-security` | `bash scripts/security-review.sh` | unchanged |
| `verify-database-change` | `bash scripts/verify-migration-from-zero.sh` | unchanged |
| `investigate-ci-failure` | `gh run list` / points at `gh run view --log-failed` | triage aid, not full automation |
| `inspect-deployment` | `curl .../api/meta` + `vercel project inspect` | takes `env.TARGET` = `test` (default) or `production` |
| `verify-test-candidate` | `curl .../api/meta` + `git rev-parse HEAD` comparison | read-only drift check against the persistent Test slot (verified live — see `EXTERNAL-STATE.md`) |
| `deploy-test-candidate`, `release-test-candidate` | informational only | Test deploys automatically from `main` via Vercel's Git integration; no separate agent-triggered step exists to wrap. Both print that fact plus the current Test slot state. |
| `restore-test-baseline` | `npx tsx scripts/seed-test-dataset.ts` | destructive — gated behind `env.CONFIRM=yes`, `env.MATCHBOARD_ENV=test`, and an explicit `env.TEST_DATABASE_URL` (never falls back to `DATABASE_URL`) |

Model scripts are POSIX `/bin/sh`-compatible (Swamp's `command/shell` executes via `sh -c`, not
bash) — no `[[ ]]`, no `&>`, no `set -o pipefail`, no unescaped `${VAR:-default}` (Swamp's own
CEL-expression parser reserves single-brace `${...}` and rejects it unless doubled to `${{...}}`,
so bash parameter-expansion defaults were rewritten as explicit `if [ -z ... ]` checks).

All 9 models pass `swamp model validate`; the 4 read-only/informational ones
(`verify-test-candidate`, `inspect-deployment`, `investigate-ci-failure`, `deploy-test-candidate`)
were executed end-to-end against the live Test slot and real `gh`/`vercel` CLIs.
`restore-test-baseline` was negative-tested (confirmed it refuses without confirmation) but not
executed destructively during this work.

## Consequences

- Future procedures follow the same `swamp model create command/shell <name>` pattern, or
  graduate to a Matchboard-owned extension once complexity justifies it (see the command/shell
  deviation note above).
- `AGENTS.md` gains one discoverability pointer: `swamp model search --json` /
  `swamp model method run <name> execute`.
- The `--no-telemetry` flag is mandatory in every invocation this repository documents or
  scripts; the two residual telemetry gaps above (no persistent disable; the auto-generated
  OpenCode audit hook) are accepted, not resolved.
- `deploy-test-candidate`/`release-test-candidate` remain informational until a real per-PR
  candidate deploy mechanism exists (ephemeral Neon branches, movable Test-slot alias) — separate,
  larger infrastructure work, not part of this decision.
- `restore-test-baseline` is the only model that mutates shared state; it is gated and documented
  as such in `docs/development/swamp-workflows.md`.
