# Security: Branch Protection and Secret Scanning

## Branch Protection Requirements

The `main` branch must have the following GitHub branch protection rules enabled:

1. **Require pull request before merging** — no direct pushes to main
2. **Require approvals** — at least 1 approving review before merge
3. **Require status checks** — CI workflow must pass. As of AIP-1 (Architecture Integrity
   Programme), the required check names should be: `TypeScript Check`, `Lint`,
   `TypeScript Check (Workers)`, `Tests (Workers)`, `Forbidden SQL Methods`,
   `Supply Chain Integrity`, `Version Verify`, `Tests`, `Migration from Zero`, `Build` — the full,
   current job list in `.github/workflows/ci-checks.yml`, not only the four historically listed
   here. This list was stale (missing `Lint`, `Version Verify`, `Migration from Zero`) before this
   update, and branch protection itself is **not currently configured on `main` at all**
   (confirmed via `gh api repos/.../branches/main/protection` returning 404 "Branch not
   protected") — see `state/EXTERNAL-ACTIONS.md` in the local Architecture Integrity Programme
   state and AIP-6's scope for the decision on whether/how to enable it.
4. **Require linear history** — no merge commits
5. **Include administrators** — branch protection applies to admins too

These settings must be configured in the GitHub repository Settings > Branches > Branch protection rules.

## Secret Scanning Requirements

GitHub secret scanning must be enabled:

1. **Secret scanning** — enabled in repository Settings > Code security
2. **Push protection** — enabled to block pushes containing secrets
3. **Custom patterns** — add these patterns:
   - `AUTH_SECRET` values (JWT secret format)
   - Real email addresses in `PREVIEW_ALLOWLIST_EMAILS`

## Verification

Run `git ls-files | xargs grep -l "postgresql://\|neon.tech\|client_secret\|PRIVATE KEY" 2>/dev/null` — should return no production secrets (demo/local connection strings in README.md and .env.example are acceptable).

Run `npm run security:check-sql` — should report zero violations.

## CI Pipeline

The CI workflow (`.github/workflows/ci-checks.yml`) enforces:
- TypeScript type checking (main app and, separately, `workers/live-match/` — ARR-0025/AIP-1: the
  Worker has its own tsconfig due to `@cloudflare/workers-types` incompatibility with the main
  app's `dom` lib, so it is a dedicated job rather than folded into the main one)
- Linting
- Tests (main app, with isolated TEST_DATABASE_URL, and `workers/live-match/` separately — same
  reasoning as typecheck)
- Forbidden SQL methods check
- Supply chain integrity check (GitHub Actions pinned by SHA)
- Version verify
- Migration from zero (applies every migration to a freshly created empty database)
- Production build

`.github/workflows/deploy-live-match-worker.yml` deploys `workers/live-match/` to Cloudflare only
after this workflow's overall run `conclusion == 'success'` — since the Worker's own typecheck/test
jobs are part of this same workflow, a Worker regression blocks its own deploy without requiring
any change to the deploy workflow itself.

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