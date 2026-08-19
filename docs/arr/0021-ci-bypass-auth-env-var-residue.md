# ARR-0021: CI/test config still sets BYPASS_AUTH despite ADR-0067's removal

## State

Resolved

## Identified

2026-08-19

## Residue

Three files still set `BYPASS_AUTH: "true"` in their environment, even though ADR-0067
("BYPASS_AUTH Removal", Accepted) states the mechanism was fully removed: "No code path exists
to bypass authentication" and "`BYPASS_AUTH` environment variable is no longer consumed by any
code path."

Verified: `grep -rn "BYPASS_AUTH" src/` finds it only in `src/lib/env.ts` (the intentionally
retained production guard — `validateEnv()` rejects `BYPASS_AUTH=true` in production, per
ADR-0067's explicit "Kept BYPASS_AUTH production guard" decision) and in test files that assert
the guard exists and that no consumer remains. No code path reads `BYPASS_AUTH` to bypass
authentication. The env var set in the three files below is therefore inert — it has no effect
on behavior — but is stale, confusing residue.

## Intended architecture

Per ADR-0067: test-agent-auth (`TEST_AGENT_AUTH_ENABLED`/`TEST_AGENT_AUTH_SECRET`, the Auth.js
Credentials provider in `src/auth.ts`) is the sole test authentication mechanism.
Environment/CI configuration should reflect that — no file should set `BYPASS_AUTH=true` as if it
still did something.

## Evidence

- `.github/workflows/ci.yml:83` — `test` job env block: `BYPASS_AUTH: "true"`
- `.github/workflows/security.yml:73` — `authz-tests`-adjacent job env block: `BYPASS_AUTH: "true"`
- `vitest.config.components.ts:18` — `BYPASS_AUTH: "true"` in the test env config
- `docs/adr/0067-bypass-auth-architectural-residue.md` — states removal is complete, with no
  mention that CI/test config still sets the var

## Impact

- No functional/security impact today — the var is inert, and `src/lib/env.ts`'s production
  guard still correctly rejects it in production regardless of these test-only settings.
- **Propagation risk**: a future PR copying `ci.yml`'s `test` job env block as a template for a
  new CI job (exactly what the `feat/swamp-procedure-runner` PR's browser-acceptance-testing
  follow-up was about to do) would likely reflexively copy the dead `BYPASS_AUTH: "true"` line
  into a fourth location, extending the residue rather than shrinking it.
- Documentation/implementation mismatch: ADR-0067 is Accepted and states removal is complete,
  but 3 files contradict that stated end-state.

## Containment

- New CI jobs and test configs must NOT copy `BYPASS_AUTH: "true"` from `ci.yml`'s `test` job or
  `security.yml` as a template. Use `TEST_AGENT_AUTH_ENABLED`/`TEST_AGENT_AUTH_SECRET` instead
  where test authentication is needed.
- Do not remove `src/lib/env.ts`'s production guard — it is intentionally retained per ADR-0067
  and stays correct regardless of this residue.

## Resolution criteria

- `BYPASS_AUTH: "true"` removed from `.github/workflows/ci.yml`, `.github/workflows/security.yml`,
  and `vitest.config.components.ts`.
- CI and test suites continue to pass without it (expected, since it's already inert).
- `docs/adr/0067-bypass-auth-architectural-residue.md` needs no change — its stated end-state was
  correct; only the CI/test config lagged behind it.

## Disposition

Resolved. `BYPASS_AUTH: "true"` removed from all three files (`.github/workflows/ci.yml`,
`.github/workflows/security.yml`, `vitest.config.components.ts`). `grep -rn "BYPASS_AUTH"
.github/workflows/*.yml vitest.config*.ts` now returns nothing. CI and test suites pass without
it, as expected since it was already inert. `src/lib/env.ts`'s production guard is unchanged.

## Related decisions

- ADR-0067: BYPASS_AUTH Removal (Accepted) — states the end-state this ARR shows CI/test config
  hasn't fully caught up to.

## Related implementation

- `.github/workflows/ci.yml`
- `.github/workflows/security.yml`
- `vitest.config.components.ts`
- `src/lib/env.ts` (production guard, correctly retained, not affected by this ARR)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-19

Record created while preparing the browser-acceptance-testing (Phase 5) PR, to avoid copying
this dead env var into a new CI job's env block.

### 2026-08-19 (resolved)

Removed `BYPASS_AUTH: "true"` from all three identified files. No consumer existed, so removal
is a pure no-op behaviorally; verified via full lint/typecheck/test/build/version:verify pass.
