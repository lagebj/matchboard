# Matchboard devcontainer

This configuration provides:

- Node.js 24 on Debian Bookworm
- Repository dependency installation using the committed npm lockfile
- GitHub CLI, PostgreSQL client, `jq`, `ripgrep`, `lsof`, `dig`, and process tools
- OpenCode Web on private forwarded port `4096`
- Matchboard development preview on private forwarded port `3333`
- Direct Ollama Cloud access through the OpenAI-compatible API
- Automatic OpenCode startup whenever the Codespace starts and both required secrets exist
- Automatic installation and discovery of skills from:
  - `https://github.com/addyosmani/agent-skills`
  - `https://github.com/lagebj/agent-skills`
- Operational CLIs: `neon` (Neon), `vercel` (Vercel), `brevo` (Brevo)

## Installed tools

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 24 (Bookworm) | Runtime |
| npm | bundled | Package manager |
| OpenCode | 1.18.8 | Coding agent |
| PostgreSQL client | 15 | `psql`, `pg_dump`, `pg_restore`, `pg_isready`, `createdb`, `dropdb` |
| Neon CLI | 2.38.5 | `neon` — branch management and operational queries |
| Vercel CLI | 58.4.4 | `vercel` — deployment inspection and previews |
| Brevo CLI | 2.0.1 | `brevo` — transactional email and account management |
| GitHub CLI | latest feature | `gh` — repository operations |
| curl, jq, dig, openssl | Debian Bookworm | Cloudflare DNS inspection and API queries |

### Tools deliberately not installed

| Tool | Reason |
|---|---|
| Wrangler | Matchboard uses Cloudflare DNS only, not Workers, Pages, R2, KV, D1, Queues, Workflows, or Durable Objects |
| cloudflared | Matchboard has no Cloudflare Tunnel or Access requirement |
| General-purpose Cloudflare CLI | No official general-purpose CLI exists; `curl` + `jq` + `dig` cover DNS administration |

## Authentication variables

All variables are documented in `.env.example` without values. Supply real values through the local `.env` file (gitignored) or Codespaces secrets.

### Secrets — never commit

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Development database connection (default target) |
| `DIRECT_URL` | Development database direct connection for Prisma migrations |
| `PRODUCTION_DATABASE_URL` | Production database connection — requires explicit selection, never the default |
| `AUTH_SECRET` | Auth.js session secret |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `BREVO_API_KEY` | Brevo API key for transactional email |
| `BREVO_WEBHOOK_SECRET` | Brevo webhook signature verification key |
| `CRON_SECRET` | Vercel Cron request authentication |
| `NEON_API_KEY` | Neon project API key |
| `VERCEL_TOKEN` | Vercel deployment token |

### Identifiers — not secrets, but internal

| Variable | Purpose |
|---|---|
| `VERCEL_ORG_ID` | Vercel organisation identifier |
| `VERCEL_PROJECT_ID` | Vercel project identifier |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account identifier |
| `CLOUDFLARE_ZONE_ID` | Cloudflare DNS zone identifier |

### Where each CLI stores interactive authentication state

| CLI | State location |
|---|---|
| `neon` | `~/.config/neon/` (not in the repository) |
| `vercel` | `~/.vercel/` (gitignored, not in the repository) |
| `brevo` | `~/.brevo/credentials.json` (gitignored, not in the repository) |

Container rebuilds remove non-persisted authentication state. Re-authenticate or re-supply environment variables after rebuild.

### Supplying secrets

- **Local containers**: `.env` file (gitignored, loaded by `.devcontainer/load-local-env.sh`)
- **Codespaces**: GitHub Codespaces secrets (injected automatically, never loaded from `.env`)
- **Never**: `devcontainer.json`, shell scripts committed to Git, or `.env.example`

Check whether a variable is set without printing its value:

```bash
test -n "${NEON_API_KEY:-}" && echo "NEON_API_KEY is set"
```

## Database selection

`DATABASE_URL` is the ordinary default development target.

`PRODUCTION_DATABASE_URL` requires explicit selection. It must never become the implicit default.

Never run destructive commands against production:

```bash
prisma migrate reset
prisma db push
dropdb
DROP DATABASE
DROP SCHEMA
TRUNCATE
```

Production operations must explicitly identify the target and use the repository's existing safety contracts.

## Safe read-only examples

These commands contact remote services. Run them manually, not during container startup.

```bash
# PostgreSQL — development database
psql "$DATABASE_URL" -c 'select current_database(), current_user;'
pg_isready -d "$DATABASE_URL"

# Neon — project information
neon projects list
neon branches list

# Vercel — deployment inspection
vercel whoami --token "$VERCEL_TOKEN"
vercel ls --token "$VERCEL_TOKEN"

# Cloudflare — DNS zone inspection
curl \
  --request GET \
  "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  | jq

# Brevo — account verification
curl \
  "https://api.brevo.com/v3/account" \
  --header "api-key: $BREVO_API_KEY" \
  | jq
```

## Prohibited automatic operations

The devcontainer must not automatically:

- Target the production database
- Copy `PRODUCTION_DATABASE_URL` into `DATABASE_URL`
- Run database migrations against production
- Deploy to Vercel
- Mutate Cloudflare DNS
- Change Brevo senders, templates, or webhooks
- Create, reset, or delete Neon branches
- Run `neon auth`, `neon init`, or `npx neonctl init`
- Run `vercel login`, `vercel link`, `vercel env pull`, or `vercel deploy`
- Run `brevo login` or `brevo app create`
- Pull production environment variables
- Validate tools by performing remote mutations

## Agent skills

`.devcontainer/sync-agent-skills.sh` clones both repositories into:

```text
~/.local/share/matchboard-agent-skills/repositories/
```

It exposes every valid `skills/<name>/SKILL.md` through OpenCode's global discovery directory:

```text
~/.config/opencode/skills/
```

The upstream `addyosmani/agent-skills` collection is installed first. The `lagebj/agent-skills` collection is installed second and overrides an identically named upstream skill. Unmanaged files already present in the OpenCode skills directory are not overwritten.

The installer also creates a dedicated OpenCode instruction file that requires automatic skill selection. OpenCode receives only skill names and descriptions initially, then loads the complete matching skill through its native `skill` tool. No user activation or command is required.

Skills are installed during container creation and refreshed on every Codespace start. A failed refresh uses the existing cached copy, so a temporary GitHub outage does not block OpenCode startup.

Optional version controls:

| Variable | Default | Purpose |
|---|---|---|
| `ADDY_AGENT_SKILLS_REF` | `main` | Branch, tag, or commit fetched from `addyosmani/agent-skills`. |
| `LAGE_AGENT_SKILLS_REF` | `main` | Branch, tag, or commit fetched from `lagebj/agent-skills`. |
| `ADDY_AGENT_SKILLS_REPOSITORY` | Official HTTPS URL | Override the upstream clone URL. |
| `LAGE_AGENT_SKILLS_REPOSITORY` | Official HTTPS URL | Override the personal clone URL. |

To refresh manually:

```bash
bash .devcontainer/sync-agent-skills.sh --required
```

To inspect installed skills:

```bash
find ~/.config/opencode/skills -mindepth 1 -maxdepth 1 -type l -printf '%f -> %l\n' | sort
```

## Worktree integrity

Lifecycle scripts must not modify tracked repository files.

- Shell scripts are committed with executable permission (`git update-index --chmod=+x`)
- Line endings are enforced by `.gitattributes`: `.devcontainer/**/*.sh text eol=lf`
- `npm ci` is used for deterministic installation (no lockfile mutation)
- Runtime state is written outside the Git worktree (`~/.config/`, `~/.local/state/`, `~/.cache/`)
- No lifecycle hook reverts, conceals, or normalizes tracked content

After container creation, startup, attachment, and restart, the Git worktree must remain identical.

## Required GitHub Codespaces secrets

Create these under **GitHub account settings → Codespaces → Secrets** and grant them only to the Matchboard repository:

| Secret | Purpose |
|---|---|
| `OLLAMA_API_KEY` | Authenticates OpenCode against Ollama Cloud. |
| `OPENCODE_SERVER_PASSWORD` | Adds OpenCode authentication behind GitHub's private port authentication. |

`OPENCODE_SERVER_USERNAME` is not secret.

Optional environment overrides:

| Variable | Default |
|---|---|
| `OLLAMA_MODEL` | `glm5.1:cloud` |
| `OPENCODE_MODEL_CONTEXT` | `202752` |
| `OPENCODE_MODEL_OUTPUT` | `32768` |

Do not commit any secret value or put it in `devcontainer.json`.

## First use

1. Commit this directory to the repository.
2. Create a new Codespace from the commit containing it, or rebuild an existing Codespace.
3. Authorise the dev-container configuration when GitHub asks.
4. Wait for `post-create.sh` to install skills and repository dependencies.
5. Open the **Ports** panel and verify ports `3333` and `4096` remain **Private**.
6. Open port `4096` from smart phone and authenticate with the OpenCode username and password.

The skill repositories require no setup after the container has been created. OpenCode discovers and invokes matching skills automatically.

Both configured skill repositories are public, so no additional GitHub credential is required for installation.

## Commands

Start or restart OpenCode Web:

```bash
bash .devcontainer/post-start.sh
```

Inspect its log:

```bash
tail -f "${XDG_STATE_HOME:-$HOME/.local/state}/matchboard-codespace/opencode-web.log"
```

Stop it:

```bash
bash .devcontainer/stop-opencode.sh
```

Start Matchboard:

```bash
bash .devcontainer/start-matchboard.sh
```

Run OpenCode in the terminal instead of the browser:

```bash
bash .devcontainer/stop-opencode.sh
bash .devcontainer/start-opencode.sh
```

## Version maintenance

Tool versions are pinned as Docker build arguments in `devcontainer.json` and `Dockerfile`. Update both values together and rebuild the container.

| Build argument | Default | Purpose |
|---|---|---|
| `NODE_VARIANT` | `24-bookworm` | Node.js base image variant |
| `OPENCODE_VERSION` | `1.18.8` | OpenCode CLI version |
| `NEONCLI_VERSION` | `2.38.5` | Neon CLI version |
| `VERCEL_VERSION` | `58.4.4` | Vercel CLI version |
| `BREVO_VERSION` | `2.0.1` | Brevo CLI version |

Pin `ADDY_AGENT_SKILLS_REF` and `LAGE_AGENT_SKILLS_REF` to reviewed commit hashes when deterministic, supply-chain-controlled skill versions are required.

## Security boundaries

- Keep both forwarded ports private.
- Skill loading is automatically allowed, but external filesystem access is limited to the managed skill repository directory.
- Agent edits to the managed skill repositories are denied by OpenCode configuration.
- The skill repositories are trusted operational instructions. Review changes before moving a pinned reference.
- Use development or preview credentials, not unrestricted production credentials.
- Use a dedicated Neon development branch where database access is required.
- Rotate the Ollama API key and OpenCode password if either appears in logs, shell history, screenshots, or repository content.
- Do not place secrets in `.env.example`, `devcontainer.json`, shell scripts, or OpenCode configuration committed to Git.
- The Neon CLI must not automatically create projects, branches, or retrieve production connection strings.
- The Vercel CLI must not automatically deploy or download environment variables.
- The Brevo CLI must not automatically create OAuth applications, API keys, senders, templates, or webhooks.
