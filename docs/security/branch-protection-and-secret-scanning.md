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
- Tests (with isolated TEST_DATABASE_URL)
- Production build

All CI jobs use `permissions: contents: read, pull-requests: read` (least privilege).

## Production Deployment

- **Never push directly to main** — all changes go through branches and PRs
- **Never run `prisma migrate dev` against production** — use `prisma migrate deploy` with DIRECT_URL
- **Production secrets belong only in Vercel environment variables and local .env**
- **Never prefix secrets with `NEXT_PUBLIC_`** — they would be exposed to the browser