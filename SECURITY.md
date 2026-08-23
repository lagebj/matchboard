# Matchboard Security Development

## Philosophy

A scanner finding is evidence, not proof. For each meaningful finding:

1. **FIND** — discover potential vulnerabilities
2. **TRIAGE** — determine whether findings are relevant and reachable in Matchboard
3. **VERIFY** — reproduce credible vulnerabilities safely
4. **FIX** — implement the narrowest architectural fix
5. **RETEST** — verify the fix and rerun the originating scanner

A finding is not considered fixed because a scanner no longer reports it if the underlying vulnerability can still be reproduced.

## Local tools

All security tools are installed in the devcontainer. Verify with:

```bash
npm run security:tools
```

### Commands

| Command | Purpose |
|---------|---------|
| `npm run security:tools` | Verify all security tools and versions |
| `npm run security:semgrep` | Run SAST with custom Matchboard rules |
| `npm run security:deps` | Run OSV dependency vulnerability scan |
| `npm run security:secrets` | Run Gitleaks secret detection (working tree) |
| `npm run security:secrets:history` | Run Gitleaks on repository history |
| `npm run security:authz` | Run Matchboard authorization security test suite |
| `npm run security:sbom` | Generate a CycloneDX SBOM (software bill of materials) to `.security/results/sbom.cdx.json` |
| `npm run security:static` | Run all non-runtime security scanners (includes SBOM generation) |
| `npm run security:dast:baseline` | Passive ZAP scan (safe, non-destructive) |
| `npm run security:dast:active` | Active ZAP scan (requires explicit opt-in, isolated env) |
| `npm run security:review` | Run full non-destructive security review |
| `npm run security:check-sql` | Check for forbidden SQL methods |
| `npm run security:check-supply-chain` | Check supply chain integrity |

### Tool versions

Pinned in `.devcontainer/Dockerfile`:
- Semgrep: v1.112.0
- OSV-Scanner: v1.9.2
- Gitleaks: v8.22.1
- ZAP: via Docker container (softwaresecurityproject/zap-stable:2.16.0)

## Generated results

Scanner output goes to `.security/results/` which is gitignored. Never commit scanner reports.
This includes the generated SBOM (`sbom.cdx.json`) — regenerate it on demand via
`npm run security:sbom`, don't commit a stale copy.

## DAST and Neon

### Baseline scan

`npm run security:dast:baseline` runs a passive ZAP scan against the local Matchboard instance. It does not mutate application state.

### Active scan

`npm run security:dast:active` runs an active ZAP scan against an isolated security environment. It:

- Requires `MATCHBOARD_ALLOW_ACTIVE_SECURITY_SCAN=1`
- Refuses production URLs and production databases
- Requires a Neon security branch (name containing "security")
- Requires explicit confirmation
- Creates and cleans up an isolated database branch

### Production safety

**Never** run active security scans against `app.matchboard.football` or any production URL. The safety gates will refuse production targets.

## CodeQL

CodeQL is **active** on this repository via GitHub's repository-settings-level default setup
(Settings → Code security → Code scanning → Default setup) — not an in-repo `codeql.yml`
workflow. Matchboard is licensed under Elastic License 2.0 (source-available, not OSI Open
Source), which would block use of the standalone, redistributed CodeQL CLI under GitHub's CodeQL
Terms and Conditions. That restriction is distinct from GitHub's own hosted code-scanning product,
which GitHub offers at no additional cost to public repositories on GitHub.com regardless of the
repository's own license. Matchboard's repository is public.

The maintainer reviewed this distinction and elected to keep CodeQL's default setup enabled,
relying on the public-repository entitlement. See ADR-0070 for the full decision record.

Therefore:
- CodeQL findings surface via the repository's Security tab and PR checks (`Analyze
  (actions/javascript-typescript/python)`, `CodeQL`), alongside the local security workflow below
- The CodeQL CLI remains not installed in the devcontainer — GitHub's hosted default setup does
  not run locally and no `npm run security:*` script depends on it
- No in-repo `codeql.yml` workflow exists or should be added — it would conflict with default
  setup, which is a repository setting, not code
- If the repository's visibility ever changes to private, this decision must be revisited (see
  ADR-0070)

## Matchboard-specific Semgrep rules

Custom rules are in `security/semgrep/matchboard-rules.yml`:

- **matchboard-missing-require-coach-access** — flags server actions that may be missing authorization
- **matchboard-unsafe-raw-sql** — flags `$queryRawUnsafe` and `$executeRawUnsafe` (forbidden per AGENTS.md)
- **matchboard-auth-secret-in-frontend** — flags `NEXT_PUBLIC_AUTH_SECRET`
- **matchboard-database-url-in-frontend** — flags `NEXT_PUBLIC_DATABASE_URL`
- **matchboard-object-id-without-auth-check** — flags direct Prisma `findUnique` by ID without auth context
- **matchboard-player-name-in-assistant-payload** — flags player names stored in assistant payloads
- **matchboard-next-public-secret-env** — flags sensitive env vars with NEXT_PUBLIC_ prefix

## Authorization security test suite

Run with `npm run security:authz`.

Tests cover:
- Cross-tenant data isolation (organisation A cannot access organisation B data)
- Object ID substitution attacks (foreign IDs return empty results)
- Role escalation prevention (VIEWER < COACH < ADMIN < OWNER)
- Input validation (CUID schema)
- Forbidden SQL methods
- Secret exposure prevention

## Dependency vulnerability policy

OSV findings require triage:

| Severity | Available fix | Action |
|----------|--------------|--------|
| Critical/High | Yes | Blocking unless explicitly reviewed |
| Critical/High | No | Documented review/mitigation required |
| Medium | — | Visible and triaged |
| Low | — | Informational unless Matchboard context increases risk |

Do not blindly upgrade dependencies across major versions to silence scanner output.

**Current automation state**: the table above is the triage policy applied by human/agent
review, not (yet) an automated CI gate. `.github/workflows/security.yml`'s OSV and Semgrep jobs
run non-blocking (`|| true`) and cannot fail a PR based on findings today — this is a known,
tracked gap (consolidation programme Phase 10 §56), not a claim that severity-based blocking is
currently enforced in CI.

### Current OSV triage (2026-08-22)

All transitive; none are direct dependencies.

| Package | Advisory | Severity | Disposition |
|---------|----------|----------|--------------|
| `@babel/core` (dev, via `eslint-config-next`) | GHSA-4x5r-pxfx-6jf8 | Low | **Fixed** — `npm audit fix` bumped it to a patched version; dev-only, never runs in production. |
| `nanoid` (via `postcss`) | GHSA-2v37-7h3g-55p8 | High | **Fixed** — `npm audit fix` bumped it to a patched version; build-tool-only, never processes runtime/user input. |
| `deepmerge-ts` (via `@prisma/config`, transitively via `prisma`) | GHSA-ggr8-5vv4-36mx | High | **Accepted risk.** No fix exists without downgrading `prisma` to 6.12.0 (a major downgrade from the current 7.9.1, itself the latest stable release). The advisory is a stack-exhaustion DoS when merging recursive/circular object graphs — `@prisma/config` only merges the project's own version-controlled `prisma.config.ts`, never externally-supplied or user input, so the realistic exploitability in this app's threat model is effectively nil. Revisit when prisma ships a release with an updated `deepmerge-ts`. |
| `uuid` (via `exceljs`, used at runtime for season export) | GHSA-w5hq-g745-h8pq | Moderate | **Accepted risk, verified not reachable.** No fix exists without downgrading `exceljs` to 3.4.0 (a major downgrade from the current 4.4.0, itself the latest stable release, which still depends on the same vulnerable `uuid` range upstream). The advisory requires calling `uuid.v3()`/`v5()`/`v6()` with an attacker-influenced `buf` parameter; `exceljs`'s only use of `uuid` (`node_modules/exceljs/lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js`) calls `uuid.v4()` with no arguments at all, so the vulnerable code path is never exercised through this app's actual usage. |

See ARR-0023 for a related, separate finding surfaced during this triage: a stale, drifting
second lockfile (`pnpm-lock.yaml`) that under- or over-reports findings relative to the actually-
used `package-lock.json`.

## Secret policy

Gitleaks configuration (`security/gitleaks.toml`) recognizes:
- Neon connection strings
- Auth.js secrets
- Google OAuth secrets
- Brevo API keys

Actual discovered secrets must be treated as compromised and reported for rotation, not suppressed.

## Security review workflow

```bash
npm run security:review
```

Runs: static checks, Semgrep, OSV, Gitleaks, authorization tests. Does NOT run active ZAP.

## Finding classification

| Classification | Meaning |
|---------------|---------|
| Confirmed vulnerability | Exploitable, reachable, requires fix |
| Hardening opportunity | Improves security posture, not currently exploitable |
| Not applicable | Finding does not apply to Matchboard's context |
| False positive | Scanner error, not a real issue |

## Responsible disclosure

Report security vulnerabilities to the repository maintainer. Do not file public issues for confirmed vulnerabilities until a fix is available.

## CodeQL status

- Repository license: Elastic License 2.0 (source-available, not OSI-approved)
- Repository visibility: Public
- CodeQL eligibility: Active via GitHub's public-repository code-scanning default setup (see
  ADR-0070) — distinct from the standalone CodeQL CLI Terms, which the maintainer has not
  separately licensed
- CodeQL CLI: Not installed (not required by GitHub's hosted default setup)
- GitHub CodeQL scanning: Configured at the repository-settings level (default setup), not via
  an in-repo workflow
- Local workflow: Complete without the CodeQL CLI; GitHub-hosted CodeQL is an additional,
  separate finding source