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
pnpm security:tools
```

### Commands

| Command | Purpose |
|---------|---------|
| `pnpm security:tools` | Verify all security tools and versions |
| `pnpm security:semgrep` | Run SAST with custom Matchboard rules |
| `pnpm security:deps` | Run OSV dependency vulnerability scan |
| `pnpm security:secrets` | Run Gitleaks secret detection (working tree) |
| `pnpm security:secrets:history` | Run Gitleaks on repository history |
| `pnpm security:authz` | Run Matchboard authorization security test suite |
| `pnpm security:static` | Run all non-runtime security scanners |
| `pnpm security:dast:baseline` | Passive ZAP scan (safe, non-destructive) |
| `pnpm security:dast:active` | Active ZAP scan (requires explicit opt-in, isolated env) |
| `pnpm security:review` | Run full non-destructive security review |
| `pnpm security:check-sql` | Check for forbidden SQL methods |
| `pnpm security:check-supply-chain` | Check supply chain integrity |

### Tool versions

Pinned in `.devcontainer/Dockerfile`:
- Semgrep: v1.112.0
- OSV-Scanner: v1.9.2
- Gitleaks: v8.22.1
- ZAP: via Docker container (softwaresecurityproject/zap-stable:2.16.0)

## Generated results

Scanner output goes to `.security/results/` which is gitignored. Never commit scanner reports.

## DAST and Neon

### Baseline scan

`pnpm security:dast:baseline` runs a passive ZAP scan against the local Matchboard instance. It does not mutate application state.

### Active scan

`pnpm security:dast:active` runs an active ZAP scan against an isolated security environment. It:

- Requires `MATCHBOARD_ALLOW_ACTIVE_SECURITY_SCAN=1`
- Refuses production URLs and production databases
- Requires a Neon security branch (name containing "security")
- Requires explicit confirmation
- Creates and cleans up an isolated database branch

### Production safety

**Never** run active security scans against `app.matchboard.football` or any production URL. The safety gates will refuse production targets.

## CodeQL

CodeQL is **not included** in the local security workflow. Matchboard is licensed under Elastic License 2.0 (source-available, not OSI Open Source). GitHub CodeQL's Terms of Service require repositories to be "Open Source Software" as defined by OSI for free use. ELv2 is not an OSI-approved license.

Therefore:
- The CodeQL CLI is not installed in the devcontainer
- GitHub-hosted CodeQL scanning is not configured
- The local workflow remains complete without CodeQL

If CodeQL eligibility changes (e.g., through a paid GitHub Advanced Security entitlement), it can be added as an additional finding source.

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

Run with `pnpm security:authz`.

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

## Secret policy

Gitleaks configuration (`security/gitleaks.toml`) recognizes:
- Neon connection strings
- Auth.js secrets
- Google OAuth secrets
- Brevo API keys

Actual discovered secrets must be treated as compromised and reported for rotation, not suppressed.

## Security review workflow

```bash
pnpm security:review
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

- Repository license: Elastic License 2.0
- CodeQL eligibility: **Not permitted** under current CodeQL Terms for non-OSI-licensed repositories
- CodeQL CLI: Not installed
- GitHub CodeQL scanning: Not configured
- Local workflow: Complete without CodeQL