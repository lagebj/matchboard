# ARR-0023: Dual lockfile (npm + pnpm) drifts from the actual dependency-security baseline

## State

Confirmed

## Identified

2026-08-22

## Residue

The repository tracks two lockfiles for two different package managers:
- `package-lock.json` — npm, the package manager actually used everywhere: every `npm run ...`
  command in AGENTS.md/README.md, CI (`.github/workflows/*.yml` all use `npm ci`), and this
  session's entire toolchain.
- `pnpm-lock.yaml` — added in commit `718a3614` ("fix(build): commit pnpm-lock.yaml for
  reproducible Vercel builds"), with no other reference to pnpm anywhere in the codebase or docs.

Discovered while triaging OSV dependency findings (platform-integrity-programme Phase 10): after
fixing a `nanoid` vulnerability via `npm audit fix` (which updates `package-lock.json` only),
`osv-scanner`'s scan of `pnpm-lock.yaml` still reported the vulnerable `nanoid@3.3.16` — the two
lockfiles had silently diverged. Running `pnpm install --lockfile-only` to resync
`pnpm-lock.yaml` against the *same* `package.json` did **not** eliminate the divergence: pnpm and
npm resolve the same `nanoid: ^3` transitive/peer range to different actual versions, because
their deduplication algorithms differ. This means the two lockfiles cannot be kept in guaranteed
sync even when both are freshly regenerated from the same source — it is not a "someone forgot
to update it" problem, it is structural.

## Intended architecture

One package manager, one lockfile, one dependency-resolution source of truth. Whichever tool
actually builds and deploys the app (npm, per every other signal in this repository) should be
the only one with a tracked lockfile, made explicit via `package.json`'s `packageManager` field
so tooling (Vercel, corepack) doesn't have to guess from lockfile presence.

## Evidence

- `package-lock.json`: npm, used by every documented command and CI workflow.
- `pnpm-lock.yaml`: pnpm, referenced nowhere except its own presence and one historical commit
  message.
- `git log --oneline -- pnpm-lock.yaml` → `718a3614 fix(build): commit pnpm-lock.yaml for
  reproducible Vercel builds` — the only commit that touched it before this ARR.
- `README.md` (pre-fix) told developers to run `pnpm security:review` etc. — stale, since every
  actual script/CI path uses `npm run`. Fixed as part of this same pass.
- No `packageManager` field existed in `package.json` before this ARR — Vercel/corepack had no
  explicit signal for which package manager the project intends, and had to infer from lockfile
  presence, which is ambiguous with both present.
- Reproduced the drift directly: `npm run security:deps` before vs. after `npm audit fix` shows
  `package-lock.json`'s findings shrink (nanoid/@babel/core fixed) while `pnpm-lock.yaml`'s do
  not, until manually resynced — and even after resyncing, `pnpm-lock.yaml` still reports a
  vulnerable `nanoid` that `package-lock.json` does not, due to differing resolution algorithms.

## Impact

- If Vercel's build ever uses (or has ever used) `pnpm-lock.yaml` to resolve dependencies for the
  actual deployed app, the production dependency tree could silently differ from what's
  installed, tested, and audited locally via npm — including being *more* vulnerable than the
  npm-resolved tree, as directly observed with `nanoid` above.
- Every future `npm audit fix`/dependency bump only updates `package-lock.json`; `pnpm-lock.yaml`
  will silently drift further out of date unless someone remembers to run a separate `pnpm`
  command, which nothing in the documented workflow currently prompts for.
- OSV/dependency scanning duplicates and can conflict across the two lockfiles, made findings
  triage in this pass more confusing than it needed to be (some findings only appeared under one
  lockfile).

## Containment

- Do not remove `pnpm-lock.yaml` without confirming, via the actual Vercel project configuration
  (dashboard or `vercel env pull`/CLI inspection — not accessible from this session), which
  package manager Vercel's build currently invokes for this project. Removing it blind risks
  changing what the next production deploy actually installs.
- `package.json` now declares `"packageManager": "npm@11.16.0"` (added in this pass) so that,
  regardless of the `pnpm-lock.yaml` question, corepack/Vercel have an explicit, unambiguous
  signal favoring npm rather than inferring from lockfile presence.
- `pnpm-lock.yaml` was resynced against the current `package.json` in this pass (via `pnpm
  install --lockfile-only`) so it is not left in a *worse*, silently-stale state than before this
  investigation — but this does not resolve the underlying drift risk, only resets the clock on it.

## Resolution criteria

- Maintainer confirms Vercel's actual configured install command / detected package manager for
  this project.
- Based on that, either: (a) `pnpm-lock.yaml` is removed and Vercel's project settings/`
  packageManager` field are confirmed to force npm, or (b) if pnpm genuinely is what Vercel uses
  to build, `package-lock.json`'s role is reconsidered instead (the reverse of the current
  npm-everywhere assumption) — either way, exactly one lockfile should remain tracked.
- CI or a pre-commit check ideally verifies only one lockfile is ever added going forward.

## Disposition

Confirmed, contained but not resolved — the actual fix requires a maintainer decision about live
Vercel project configuration that cannot be verified from this environment. Interim mitigation
(packageManager field added, pnpm-lock.yaml resynced, stale README pnpm command references
fixed) reduces but does not eliminate the risk.

## Related decisions

None yet — the resolution requires a new decision once Vercel's actual configuration is confirmed.

## Related implementation

- `package.json` (`packageManager` field)
- `pnpm-lock.yaml`, `package-lock.json`
- `README.md` (stale `pnpm security:...` command references, fixed)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-22

Record created. Discovered during platform-integrity-programme Phase 10 (OSV dependency finding
triage). Interim mitigation applied (packageManager field, lockfile resync, README fix); full
resolution requires maintainer confirmation of Vercel's actual build configuration.
