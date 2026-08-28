# ARR-0023: Dual lockfile (npm + pnpm) drifts from the actual dependency-security baseline

## State

Resolved 2026-08-28 (pending final real-deployment confirmation via this fix's own PR — see
History). Confirmed directly via the Vercel Projects API that `installCommand` was `null` on
both `matchboard` and `matchboard-test` — pnpm was never a deliberate choice, only Vercel's
lockfile-presence auto-detection (the open question the 2026-08-22/23 passes below could not
settle from this environment). Fixed at the actual root cause: both projects' Install Command is
now explicitly `npm ci`, and `pnpm-lock.yaml`/`pnpm-workspace.yaml` are removed from the
repository and gitignored again, so there is exactly one lockfile and one dependency-resolution
source of truth.

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

- Do not add a `packageManager` field pinning npm, and do not remove `pnpm-lock.yaml` — both were
  tried in this pass and the former was directly proven wrong by two failed Vercel deployments
  (see History 2026-08-23). Vercel auto-detects `pnpm-lock.yaml`'s presence and runs `pnpm
  install` for the actual production/preview build; an explicit `packageManager: npm` field makes
  corepack refuse that with `ERROR This project is configured to use npm`, hard-failing the build.
- `pnpm-lock.yaml` was resynced against the current `package.json` in this pass (via `pnpm
  install --lockfile-only`) so it is not left in a worse, silently-stale state than before this
  investigation — this remains a correct, safe interim step regardless of which lockfile ends up
  authoritative.
- Local development tooling (every `npm run ...` script, this repository's own AGENTS.md/README)
  genuinely does use npm — that part of the original assumption was correct. What was wrong was
  concluding that npm must therefore also be what Vercel builds with. **Local dev and Vercel's
  build can use two different package managers today, and currently do.**

## Resolution criteria (all satisfied 2026-08-28)

- ~~Maintainer confirms, from the Vercel dashboard (Project Settings → General → Install Command /
  detected framework), whether pnpm is the deliberately chosen build tool or an accidental
  side-effect of `pnpm-lock.yaml`'s presence dating back to commit `718a3614`.~~ Confirmed
  directly via the Vercel Projects API (`GET /v9/projects/{id}`): `installCommand: null` on both
  `matchboard` and `matchboard-test` — accidental, not deliberate. The 2026-08-23 attempt below
  had no way to check this from this environment; this pass did.
- ~~If pnpm was accidental: switch Vercel's project settings to force npm explicitly..., then
  remove `pnpm-lock.yaml` and re-verify with a real deployment before considering it safe.~~ Done:
  `installCommand` set to `npm ci` via `PATCH /v9/projects/{id}` on both projects (a live
  Vercel-side change, not a repo file — the 2026-08-23 attempt's mistake was pinning
  `packageManager` in `package.json` alone, which corepack then enforced *against* pnpm without
  Vercel's own install step knowing to stop using pnpm first). `pnpm-lock.yaml` and
  `pnpm-workspace.yaml` removed from the repository and re-added to `.gitignore`.
- Exactly one lockfile is now tracked (`package-lock.json`). `pnpm-lock.yaml` is gitignored, so a
  local `pnpm install` run by habit or accident cannot silently recreate this problem.

## Disposition

Resolved. Root cause confirmed and fixed rather than guessed at: pnpm was never a deliberate
Vercel choice, only lockfile-presence auto-detection with `installCommand` unset on both
projects. Setting `installCommand: "npm ci"` explicitly (Vercel Projects API) removes pnpm from
the build regardless of which lockfiles are present in the repo, then `pnpm-lock.yaml`/
`pnpm-workspace.yaml` were deleted and gitignored so the underlying ambiguity (two lockfiles, two
resolution algorithms, silent drift) cannot recur. Verification: full `npm run validate` passes
locally with `pnpm-lock.yaml` absent; a real Vercel deployment from this fix's own PR is the
final proof this session can observe — see History for the outcome once that deployment
completes.

## Related decisions

None — a live provider (Vercel) project-settings change, not a repository architecture decision;
no ADR governs Vercel Install Command configuration today.

## Related implementation

- `package-lock.json` (sole tracked lockfile)
- `.gitignore` (`pnpm-lock.yaml`, `pnpm-workspace.yaml` re-ignored)
- `scripts/check-supply-chain.ts` (unrelated to this ARR directly, but fixed in the same pass —
  see its own history note for why)
- `README.md` (stale `pnpm security:...` command references, fixed in the original 2026-08-22
  pass — this part remains correct regardless of the build-tool question, since it's about
  documented developer commands)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-22

Record created. Discovered during platform-integrity-programme Phase 10 (OSV dependency finding
triage). Interim mitigation applied (packageManager field, lockfile resync, README fix); full
resolution requires maintainer confirmation of Vercel's actual build configuration.

### 2026-08-23

The `packageManager: "npm@11.16.0"` field added the day before was directly proven wrong: PR
#337's two Vercel deployment checks (`matchboard` and `matchboard-test`) both failed within
seconds with `ERROR This project is configured to use npm` / `Command "pnpm install" exited with
1`. Vercel's build log explicitly showed it detecting `pnpm-lock.yaml` and running `pnpm
install`, which corepack then refused because of the conflicting `packageManager` field. This is
direct, empirical proof that Vercel's real build uses pnpm today — reverted the field
immediately (removed, not repointed to pnpm, since the exact previously-working pnpm version
wasn't verified and guessing again after just being proven wrong once was not warranted).
Updated Containment/Resolution criteria/Disposition above to reflect that local-dev-uses-npm and
Vercel-builds-with-pnpm currently coexist, and that this is exactly the kind of live provider
configuration this session cannot safely guess at — confirmed by getting it wrong once already.

### 2026-08-28

Resolved. This session had direct Vercel API access (not available in the 2026-08-22/23 passes),
so instead of guessing, checked `GET /v9/projects/{id}` for both `matchboard` and
`matchboard-test`: `installCommand: null` on both — settling the open question definitively.
pnpm was always accidental, driven purely by `pnpm-lock.yaml`'s presence.

Fixed the actual root cause: `PATCH /v9/projects/{id}` with `{"installCommand": "npm ci"}` on
both projects (live Vercel-side change, done with explicit user authorization given the
production-affecting nature of the change — a first attempt to make this change via a raw
project-settings API call was blocked by the session's own auto-mode safety classifier, which
correctly treated it as needing explicit sign-off rather than proceeding unattended). This is
different from 2026-08-23's failed attempt: that one added a `packageManager` field to
`package.json` (a repo file) while Vercel's own install step still auto-detected pnpm from
`pnpm-lock.yaml` and tried to run it, so corepack rejected the mismatch. Setting Vercel's own
Install Command removes the auto-detection entirely, regardless of which lockfiles the repo
carries.

Then removed `pnpm-lock.yaml` and `pnpm-workspace.yaml` from the repository and re-added both to
`.gitignore` (they had been an unusual carve-out from `.gitignore`'s otherwise-consistent
lockfile handling). Verified locally: `npm run validate` passes in full with `pnpm-lock.yaml`
absent, and `npm run security:deps` (OSV) reports 0 findings against the sole remaining
`package-lock.json` — also picking up durable fixes for the `deepmerge-ts`/`nanoid`/`uuid`
vulnerabilities from SECURITY.md's 2026-08-22 triage via `package.json` `overrides` (see
SECURITY.md's 2026-08-28 entry for detail; that fix predated and is independent of this ARR, but
landed in the same pass while re-verifying the dependency tree).

Final confirmation is this fix's own PR: a real Vercel preview deployment either shows the build
log running `npm ci` and succeeding, or it doesn't — that observation is the last open item
before this ARR can be considered fully closed rather than resolved-pending-verification.
