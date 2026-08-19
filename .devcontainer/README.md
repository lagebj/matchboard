# Matchboard devcontainer

This configuration provides:

- Node.js 24 on Debian Bookworm
- Repository dependency installation using the committed npm lockfile
- GitHub CLI, PostgreSQL client, `jq`, `ripgrep`, `lsof`, `dig`, and process tools
- OpenCode Web on private forwarded port `4096`
- Claude Code CLI (installed via Anthropic devcontainer feature)
- Matchboard development preview on private forwarded port `3333`
- Direct Ollama Cloud access through the OpenAI-compatible API
- Automatic OpenCode startup whenever the Codespace starts and both required secrets exist
- Automatic installation and discovery of skills from:
  - `https://github.com/addyosmani/agent-skills`
  - `https://github.com/lagebj/agent-skills`
- Shared Agent Skills exposed to both OpenCode and Claude Code
- Claude.ai authentication enforcement and API credential isolation
- Operational CLIs: `neon` (Neon), `vercel` (Vercel), `brevo` (Brevo)

## Installed tools

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 24 (Bookworm) | Runtime |
| npm | bundled | Package manager |
| OpenCode | 1.18.8 | Coding agent |
| Claude Code | latest (via feature) | Coding agent (peer) |
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
| `claude` | `~/.claude/` (named volume, persisted across rebuilds; not in the repository) |

Container rebuilds remove non-persisted authentication state. Re-authenticate or re-supply environment variables after rebuild. Claude Code authentication in `~/.claude/` persists through rebuilds because of the named volume mount.

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
- Start `claude` or run `claude setup-token` or any Claude interactive authentication
- Open a browser for Claude authentication

## Agent skills

`.devcontainer/sync-agent-skills.sh` clones both repositories into:

```text
~/.local/share/matchboard-agent-skills/repositories/
```

It exposes every valid `skills/<name>/SKILL.md` through OpenCode's global discovery directory:

```text
~/.config/opencode/skills/
```

It also creates repository-relative symlinks for Claude Code's project skill directory:

```text
.claude/skills/
```

Both agents discover the same canonical skill directories. No skill content is duplicated.

The upstream `addyosmani/agent-skills` collection is installed first. The `lagebj/agent-skills` collection is installed second and overrides an identically named upstream skill. Unmanaged files already present in the OpenCode skills directory are not overwritten.

The installer also creates a dedicated OpenCode instruction file that requires automatic skill selection. OpenCode receives only skill names and descriptions initially, then loads the complete matching skill through its native `skill` tool. No user activation or command is required.

Skills are installed during container creation and refreshed on every Codespace start. A failed refresh uses the existing cached copy, so a temporary GitHub outage does not block OpenCode startup.

### Agent parity validation

Run structural validation that both agents see the same skills and instructions:

```bash
bash .devcontainer/validate-agent-parity.sh
```

This checks that:
1. `AGENTS.md` exists at the repository root
2. `CLAUDE.md` exists and imports `AGENTS.md` (single source of truth)
3. Claude managed settings enforce Claude.ai login and isolate API keys
4. Every managed skill present for OpenCode is also discoverable by Claude

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

## Agent contract

OpenCode and Claude Code are peer coding agents. They share:

| Concern | Canonical source | OpenCode mechanism | Claude Code mechanism |
|---|---|---|---|
| Repository instructions | `AGENTS.md` | Native `AGENTS.md` discovery | `CLAUDE.md` imports `@AGENTS.md` |
| Agent skills | Canonical skill directories | `~/.config/opencode/skills/` symlinks | `.claude/skills/` symlinks |
| Programme context | `.matchboard-work/` | Direct file access | Direct file access |
| Repository, dependencies, tools | Working tree | Direct access | Direct access |

They do not share:

| Concern | Scope |
|---|---|
| Conversation history | Per-agent, not interchangeable |
| Session state | Per-agent, not interchangeable |
| Authentication | OpenCode: Ollama Cloud. Claude Code: Claude.ai |
| Configuration | OpenCode: `~/.config/opencode/`. Claude Code: `~/.claude/` |

The skill parity validation script confirms that every managed skill installed for OpenCode is also discoverable by Claude Code:

```bash
bash .devcontainer/validate-agent-parity.sh
```

## Required GitHub Codespaces secrets

Create these under **GitHub account settings → Codespaces → Secrets** and grant them only to the Matchboard repository:

| Secret | Purpose |
|---|---|
| `OLLAMA_API_KEY` | Authenticates OpenCode against Ollama Cloud. |
| `OPENCODE_SERVER_PASSWORD` | Adds OpenCode authentication behind GitHub's private port authentication. |

`OPENCODE_SERVER_USERNAME` is not secret.

Optional:

| Secret | Purpose |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Carry Claude.ai authentication across new Codespaces. Reduces repeated login but is not required for provisioning. Never commit this value. |

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
4. Wait for `post-create.sh` to install skills, repository dependencies, and verify Claude Code.
5. Open the **Ports** panel and verify ports `3333` and `4096` remain **Private**.
6. Open port `4096` from smart phone and authenticate with the OpenCode username and password.
7. (Optional) Authenticate Claude Code: run `claude` and follow the browser-code flow with your Claude.ai account.

The skill repositories require no setup after the container has been created. Both OpenCode and Claude Code discover matching skills automatically.

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

Run Claude Code in the terminal:

```bash
claude
```

Validate agent parity (structural, no authentication required):

```bash
bash .devcontainer/validate-agent-parity.sh
```

List available Swamp procedures (repeatable verification/investigation commands — see
`docs/development/swamp-workflows.md` and `docs/adr/0068-swamp-procedure-runner.md`):

```bash
swamp --no-telemetry model search --json
```

Refresh agent skills:

```bash
bash .devcontainer/sync-agent-skills.sh --required
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

Claude Code is installed via the `ghcr.io/anthropics/devcontainer-features/claude-code:1.0` devcontainer feature, which installs the latest CLI and auto-updates. To pin a specific version, install it from the Dockerfile with `npm install -g @anthropic-ai/claude-code@X.Y.Z` and set `DISABLE_AUTOUPDATER=1` in `containerEnv` instead of using the feature.

Pin `ADDY_AGENT_SKILLS_REF` and `LAGE_AGENT_SKILLS_REF` to reviewed commit hashes when deterministic, supply-chain-controlled skill versions are required.

## Peer coding agents

OpenCode and Claude Code operate as peer coding agents over the same repository:

- **Canonical instructions**: `AGENTS.md` is the single source of truth. `CLAUDE.md` imports it via `@AGENTS.md`.
- **Shared Agent Skills**: Both agents discover the same canonical skill directories. OpenCode uses `~/.config/opencode/skills/`. Claude Code uses `.claude/skills/`. Both are symlinks to the same source repositories.
- **Repository context**: Both agents see the same working tree, Git state, dependencies, and `.matchboard-work/` programme context.
- **Conversation histories**: Not shared. Each agent maintains its own session state.
- **Authentication**: OpenCode uses Ollama Cloud. Claude Code uses Claude.ai (Pro subscription). Managed settings enforce `forceLoginMethod: "claudeai"` and isolate inherited API credentials.

### Starting Claude Code

After the container is running, authenticate once:

```bash
claude
```

Follow the browser-code authentication flow. Use the Claude.ai account that owns your Claude Pro subscription. Do not select Console/API billing.

### Claude Code configuration persistence

Claude Code stores authentication and configuration in `~/.claude/`. A named volume (`claude-code-config-${devcontainerId}`) persists this across container rebuilds. On a completely new Codespace, you must re-authenticate.

### Optional: carry authentication across Codespaces

Generate a long-lived OAuth token:

```bash
claude setup-token
```

Store the resulting `CLAUDE_CODE_OAUTH_TOKEN` as a GitHub Codespaces secret. The devcontainer does not require this for provisioning — it is an optional convenience that reduces repeated login across new Codespaces.

### Verification after authentication

```bash
# Check authentication method (should show Claude.ai/subscription, not API key)
claude /status

# Check instruction loading (should list CLAUDE.md and imported AGENTS.md)
claude /context

# Check skill discovery (should list all managed skills)
claude /skills
```

### Structural validation (no authentication required)

```bash
bash .devcontainer/validate-agent-parity.sh
```

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
- Claude Code uses Claude.ai authentication. Managed settings enforce `forceLoginMethod: "claudeai"` and clear inherited `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, and cloud provider environment variables. OpenCode credentials (such as `OLLAMA_API_KEY`) are not affected by this isolation.
- Claude Code configuration is persisted in a named volume at `~/.claude/`. Do not commit the contents of this volume to Git.
- `CLAUDE_CODE_OAUTH_TOKEN` is optional and must only be stored as a GitHub Codespaces secret, never in the repository.
