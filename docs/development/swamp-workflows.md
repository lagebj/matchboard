# Swamp workflows

Matchboard uses [Swamp Club](https://swamp-club.com) as its repeatable coding-agent/developer
procedure runner. See `docs/adr/0068-swamp-procedure-runner.md` for why, including the accepted
licensing/telemetry risk and the `command/shell`-for-CLI-wrapping deviation from Swamp's own
house rule — read that ADR before adding a new procedure here.

## Setup

The repository is already initialized (`.swamp.yaml`, the managed `CLAUDE.md` section,
`.opencode/plugins/swamp-audit.ts`). If the `swamp` CLI isn't on `PATH` in a fresh environment,
install it:

```bash
curl -fsSL https://swamp-club.com/install.sh | sh
```

**Always pass `--no-telemetry`.** Per ADR-0068, every invocation documented here includes it.
This is a per-invocation flag, not a persistent setting — there is no config key or environment
variable that disables telemetry globally (checked `swamp config list` and the installed binary;
neither exists as of 2026-08-19).

## Usage

```bash
swamp --no-telemetry model search --json                              # list available procedures
swamp --no-telemetry model method run <name> execute                  # run one
swamp --no-telemetry model method run <name> execute --input env.KEY=value  # with parameters
```

## Procedures

| Model | What it wraps | Status |
|---|---|---|
| `verify-repository` | `npm run validate` | Implemented |
| `verify-security` | `bash scripts/security-review.sh` | Implemented |
| `verify-database-change` | `bash scripts/verify-migration-from-zero.sh` | Implemented |
| `investigate-ci-failure` | `gh run list`, points at `gh run view --log-failed` | Implemented |
| `inspect-deployment` | `curl .../api/meta` + `vercel project inspect` | Implemented — takes `--input env.TARGET=test\|production` (defaults to `test`) |
| `verify-test-candidate` | Compares the deployed Test slot's commit against local `HEAD` | Implemented, read-only |
| `deploy-test-candidate` | Informational | See "Test-slot procedures" below |
| `release-test-candidate` | Informational | See "Test-slot procedures" below |
| `restore-test-baseline` | Wipes and re-seeds the Test database from the canonical seed | Implemented, gated (destructive) |
| `verify-browser-acceptance` | Runs Playwright browser acceptance tests (`npm run test:e2e`) against the live Test slot | Implemented — takes `--input env.TEST_AGENT_AUTH_SECRET=<secret>` |

Model definitions live in `models/command/shell/*.yaml`. Each is a `command/shell` model — see
ADR-0068 for why that's used even for the CLI-wrapping procedures, as a documented deviation from
Swamp's usual guidance to prefer typed extensions.

## Test-slot procedures

A persistent Test environment exists and is verified live: the Vercel project `matchboard-test`
deployed at `https://test.matchboard.football`, backed by a dedicated Neon `test` branch. Both
this Test project and the Production project deploy automatically from `main` via Vercel's Git
integration — there is no separate, agent-triggerable "deploy this PR to Test" step today.

Because of that, `deploy-test-candidate` and `release-test-candidate` are **informational**: they
explain that Test updates automatically on merge and print the current Test slot state (the same
check `verify-test-candidate` performs), rather than pretending to trigger a promotion mechanism
that doesn't exist. Building a real per-PR candidate slot (ephemeral Neon child branches, a
movable Test-slot alias, exact-commit deploy automation) is separately-scoped future work — see
`.matchboard-work/consolidation-programme/EXTERNAL-STATE.md` for what has and hasn't been
verified about that infrastructure.

`restore-test-baseline` genuinely mutates the shared Test database. It refuses to run without:

```bash
swamp --no-telemetry model method run restore-test-baseline execute \
  --input env.CONFIRM=yes \
  --input env.MATCHBOARD_ENV=test \
  --input env.TEST_DATABASE_URL='<test-branch-connection-string>'
```

It never falls back to `DATABASE_URL` — a destructive operation must never guess which database
it's pointed at.

`verify-browser-acceptance` also exercises the Test slot directly (real HTTP requests against
`https://test.matchboard.football`) — see `docs/development/browser-acceptance-testing.md` and
`docs/adr/0069-browser-acceptance-testing-layer2.md` for the full Playwright/Auth.js setup.

## Adding a new procedure

When a task requires the same multi-step command sequence more than once, or produces a sequence
a future agent session would plausibly need again, add it here rather than leaving it as one-off
shell commands in a transcript:

```bash
swamp --no-telemetry model create command/shell <name> --json
```

Then hand-edit the generated `models/command/shell/<name>.yaml`:
- `run:` must be POSIX `/bin/sh`-compatible (Swamp executes via `sh -c`, not bash) — no `[[ ]]`,
  no `&>`, no `set -o pipefail`, no bash-only `${VAR:-default}` (Swamp's CEL-expression parser
  reserves single-brace `${...}`; use `if [ -z "$VAR" ]; then VAR=default; fi` instead)
- start the script with `set -e`
- prefer wrapping an *existing* npm/bash script over reimplementing logic (mirrors every current
  procedure — see the table above)
- if the procedure wraps an external CLI (`gh`, `vercel`, `curl`, etc.), that's a documented
  deviation from Swamp's own house rule per ADR-0068 — acceptable here, don't re-litigate it
- gate any destructive procedure the same way `restore-test-baseline` is gated: require explicit
  `env.CONFIRM=yes` plus an explicit target, never fall back to a guessed/default database or
  environment

Validate with `swamp --no-telemetry model validate <name>`, then add a row to the "Procedures"
table above and update `docs/development/coding-agent-working-session.md`/`AGENTS.md` if the new
procedure changes the mandatory verification flow.

## Safety

Swamp procedures are opt-in and human/agent-invoked only. They are never run automatically —
not from `.devcontainer/post-create.sh`, not from CI — and no procedure targets production. This
mirrors `.devcontainer/README.md`'s "Prohibited automatic operations" list; consult that list
directly rather than this document restating it.
