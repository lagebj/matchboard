# ARR-0023: Dual lockfile (npm + pnpm) drifts from the actual dependency-security baseline

## State

Confirmed — and the initial fix attempt in this same pass was empirically proven wrong by CI
(see History 2026-08-23). Vercel's actual production build uses **pnpm**, not npm, contradicting
every local dev script/doc signal.

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

## Resolution criteria

- Maintainer confirms, from the Vercel dashboard (Project Settings → General → Install Command /
  detected framework), whether pnpm is the deliberately chosen build tool or an accidental
  side-effect of `pnpm-lock.yaml`'s presence dating back to commit `718a3614`.
- If pnpm is deliberate: align local dev docs/scripts to pnpm (or accept the split deliberately
  and document it), and stop treating `package-lock.json` as if it were the deployed
  dependency tree for OSV/security triage purposes — `pnpm-lock.yaml` is what actually ships.
- If pnpm was accidental: switch Vercel's project settings to force npm explicitly (Vercel
  Project Settings, not just a repo file — a `packageManager` field alone was proven
  insufficient/actively harmful without a matching Vercel-side change), then remove
  `pnpm-lock.yaml` and re-verify with a real deployment before considering it safe.
- Either way, exactly one lockfile should remain tracked once the decision is made — the
  interim state (both present, resynced) is deliberately conservative, not a stopping point.

## Disposition

Confirmed, contained but not resolved — worse, the natural-seeming interim fix (pin npm
explicitly) was tried in this same pass and directly broke both Vercel deployments (`matchboard`
and `matchboard-test`), proving pnpm is what Vercel's build actually uses today. Reverted the
`packageManager` field immediately. The actual resolution still requires a maintainer decision
about live Vercel project configuration that cannot be verified or safely guessed at from this
environment — this pass proved that guessing is actively dangerous here, not just unresolved.

## Related decisions

None yet — the resolution requires a new decision once Vercel's actual configuration is confirmed.

## Related implementation

- `pnpm-lock.yaml`, `package-lock.json`
- `README.md` (stale `pnpm security:...` command references, fixed — this part remains correct
  regardless of the build-tool question, since it's about documented developer commands)

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

Recurred exactly as predicted: PR #365 (`user-documentation-experience`) added
`fumadocs-core`/`fumadocs-mdx`/`fumadocs-ui` via `npm install`, updating `package-lock.json`
only. Both Vercel preview checks (`matchboard`, `matchboard-test`) failed with
`ERR_PNPM_OUTDATED_LOCKFILE` under `--frozen-lockfile`. Contained the same way as before —
`pnpm install --lockfile-only` to resync `pnpm-lock.yaml` against the current `package.json`,
committed separately from the dependency-adding commit for a clear, revertible diff. No new
containment technique was needed; this simply confirms the ARR's own prediction that nothing in
the documented `npm run ...` workflow prompts for this step, so it will keep recurring on every
PR that changes dependencies until the underlying resolution criteria are actually decided.
