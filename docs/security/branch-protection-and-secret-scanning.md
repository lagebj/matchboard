# Security: Branch Protection and Secret Scanning

## Branch Protection Requirements

The `main` branch must have the following GitHub branch protection rules enabled:

1. **Require pull request before merging** — no direct pushes to main
2. **Require approvals** — at least 1 approving review before merge
3. **Require status checks** — CI workflow must pass (typecheck, test, build, security:check-sql)
4. **Require linear history** — no merge commits
5. **Include administrators** — branch protection applies to admins too

These settings must be configured in the GitHub repository Settings > Branches > Branch protection rules.

## Secret Scanning Requirements

GitHub secret scanning must be enabled:

1. **Secret scanning** — enabled in repository Settings > Code security
2. **Push protection** — enabled to block pushes containing secrets
3. **Custom patterns** — add these patterns:
   - `AUTH_SECRET` values (JWT secret format)
   - `ALLOWED_COACH_EMAILS` when containing real email addresses

## Verification

Run `git ls-files | xargs grep -l "postgresql://\|neon.tech\|client_secret\|PRIVATE KEY" 2>/dev/null` — should return no production secrets (demo/local connection strings in README.md and .env.example are acceptable).

Run `npm run security:check-sql` — should report zero violations.

## CI Pipeline

The CI workflow (`.github/workflows/ci.yml`) enforces:
- TypeScript type checking
- Linting
- Forbidden SQL methods check
- Supply chain integrity check (GitHub Actions pinned by SHA)
- Tests (with isolated TEST_DATABASE_URL)
- Production build

All CI jobs use `permissions: contents: read, pull-requests: read` (least privilege).

All GitHub Actions are pinned by commit SHA with version comments:
- `actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.2.2`
- `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.1.5`

The supply chain integrity check (`npm run security:check-supply-chain`) verifies that all actions remain pinned to the expected SHA and flags any unpinlocked or unknown actions.

## Production Deployment

- **Never push directly to main** — all changes go through branches and PRs
- **Never run `prisma migrate dev` against production** — use `prisma migrate deploy` with DIRECT_URL
- **Production secrets belong only in Vercel environment variables and local .env**
- **Never prefix secrets with `NEXT_PUBLIC_`** — they would be exposed to the browser