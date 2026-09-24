# ARR-0054: Recurring Vercel/Neon/Cloudflare/Brevo automation goes through raw `command/shell` models instead of typed swamp extensions, leaking a real credential into swamp data as a direct consequence

## State

Confirmed

## Identified

2026-09-24

## Residue

AGENTS.md rule 1 states the `command/shell` model type "is ONLY for ad-hoc one-off shell
commands, NEVER for wrapping CLI tools or building integrations," and rule 10 requires all
external-service work to go through swamp rather than around it. In practice, this repository's
own swamp state does not follow that rule for its own recurring provider automation:

- `swamp model list` returns exactly one typed provider model — `github-issues`
  (`@webframp/github`) — and twelve `command/shell` models, each tagged `swamp-procedure`:
  `verify-repository`, `release-test-candidate`, `deploy-test-candidate`,
  `verify-browser-acceptance`, `verify-migration-upgrade`, `verify-security`,
  `restore-test-baseline`, `verify-database-change`, `investigate-ci-failure`,
  `inspect-deployment`, `verify-test-candidate`, `verify-invitation-email-flow`. These are not
  one-off commands; they are the repository's standing, repeatedly-invoked deploy/verify/restore
  procedures for the Test-slot Vercel deployment and its Neon database branch, and for a Brevo
  email-sending flow.
- `swamp workflow list` returns zero results. None of these procedures are wired into an actual
  swamp workflow DAG despite the `swamp-procedure` tagging convention suggesting they were meant
  to be — there is no dependency/guard/assert structure, no `swamp workflow validate` safety net,
  and no idempotent re-entry for a sequence like deploy → verify → restore-baseline.
- `swamp vault list` returns zero results. No vault exists in this repository at all.
- As a direct, demonstrated consequence: `verify-invitation-email-flow`'s most recent run
  (2026-08-20) persisted its `BREVO_API_KEY` and `TEST_AGENT_AUTH_SECRET` values in plaintext in
  `methodArgs.env`, retrievable via `swamp report get @swamp/method-summary --model
  verify-invitation-email-flow --json` over a month later. `command/shell` has no vault
  integration and no redaction — whatever is passed as `env` is persisted verbatim in the
  model's report/data history for as long as that data exists. A typed extension model backed by
  a vault (rule 1's own documented pattern: `swamp vault create` + a CEL vault reference) never
  exposes a raw secret value this way.
- Extension coverage is uneven across the providers AGENTS.md rule 1 actually names:
  - **GitHub**: `@webframp/github` — installed and in active use (`github-issues` model).
  - **Vercel**: official `@swamp/vercel/deployments` and `@swamp/vercel/projects` extensions
    exist and were pulled into this repo (`extensions/models/upstream_extensions.json`) on
    2026-09-24, but no model was ever created from them — the pull was left incomplete mid-task
    in an earlier agent session. All actual Vercel interaction in this repository (deployment
    checks, env inspection, this session's own CI-gating work) goes through the raw `vercel` CLI
    or the Vercel MCP plugin, not swamp.
  - **Cloudflare**: two community, repository-verified extensions exist
    (`@webframp/cloudflare` — zones/DNS/WAF/Workers/cache; `@mccormick/cloudflare` — Zero
    Trust/Access) but neither was installed until this ARR's own investigation pulled
    `@webframp/cloudflare` on 2026-09-24. Prior Cloudflare work in this repository (e.g. the
    2026-09-24 Follow Live incident investigation, per this session's own record) went through
    the Cloudflare GraphQL Analytics API and runtime-log tooling directly, not swamp.
  - **Neon**: `swamp extension search neon` returns zero results — no swamp extension exists in
    the registry at all for Neon. Every Neon interaction in this repository (migrations,
    production diagnostics) goes through the raw `neon`/`psql` CLI.
  - **Brevo**: `swamp extension search brevo` returns zero results — no swamp extension exists
    for Brevo either. The only Brevo interaction in this repository is the
    `verify-invitation-email-flow` `command/shell` model described above.
  - **Scaleway**: hosts the AI credential broker's serverless functions (ADR-0150). The only
    community Scaleway extensions found (`@sntxrr/scaleway-webhosting`,
    `@sntxrr/scaleway-mongodb`) do not cover Serverless Functions, so there is currently no
    extension to adopt for this specific need even if one were sought.

## Intended architecture

Per AGENTS.md rules 1 and 10: recurring automation against an external service goes through a
typed swamp model (an official `@swamp/*` extension where one exists, a community extension
otherwise, or a custom `extensions/models/` extension only as a last resort), with any credential
the model needs supplied through a swamp vault and referenced by CEL — never passed as a raw
`command/shell` `env` value. `command/shell` is reserved for genuinely ad-hoc, one-off commands,
not a standing "procedure" invoked repeatedly across sessions. Recurring multi-step provider
sequences (deploy → verify → restore-baseline, etc.) are expressed as swamp workflows, not as a
naming convention (`swamp-procedure` tags) layered on top of independent shell-command models.

## Evidence

- `swamp model list --json` — one typed model (`github-issues`), twelve `command/shell` models
  tagged `swamp-procedure`.
- `swamp workflow list --json` — `{"results": []}`.
- `swamp vault list --json` — `{"results": []}`.
- `swamp report get @swamp/method-summary --model verify-invitation-email-flow --json` —
  `methodArgs.env` containing a live `BREVO_API_KEY` and `TEST_AGENT_AUTH_SECRET` from the
  2026-08-20 run, still retrievable in full on 2026-09-24.
- `swamp extension search neon` / `swamp extension search brevo` — both `{"extensions": [], ...
  "total": 0}`.
- `swamp extension search cloudflare` — `@webframp/cloudflare` and `@mccormick/cloudflare`,
  neither installed as of 2026-09-24 (before this ARR's own investigation pulled the former).
- `swamp extension list --json` (before this ARR) — `@webframp/github`, `@swamp/vercel/deployments`,
  `@swamp/vercel/projects` pulled; none of the two Vercel ones backing any model.
- `extensions/models/upstream_extensions.json` — tracks the pulled extensions; the two
  `@swamp/vercel/*` entries were added 2026-09-24 with no corresponding model ever created in
  the same or a later session, until this ARR's own remediation.
- AGENTS.md / CLAUDE.md, rules 1 and 10 — the standing instruction this residue diverges from.
- ADR-0150 (`docs/adr/0150-converge-matchboard-security-repository-into-matchboard.md`) — Scaleway
  Serverless Functions as the AI credential broker's deployment target.
- This session's own memory record (`project_incident_investigation_toolkit`) — confirms recent,
  real Cloudflare/Neon investigative work went through raw CLI/API tooling, not swamp, even after
  AGENTS.md rules 1/10 were in force.

## Impact

- **Demonstrated security consequence, not theoretical**: a real Brevo API key and a real
  authentication secret sat in plaintext, retrievable swamp report data for over a month, purely
  because the model wrapping that call was `command/shell` rather than a vault-backed typed
  extension. Any credential passed to any of the twelve `command/shell` procedure models via
  `env` carries the same exposure.
- **No operational safety net for standing procedures**: with zero swamp workflows, the
  deploy/verify/restore-baseline sequence these `command/shell` models exist for has no DAG
  ordering, no guard expressions, no `swamp workflow validate`, and no idempotent resume — each
  step is only as safe as whatever ordering an agent happens to invoke them in that session.
- **Duplicated, silently-abandoned setup work**: the `@swamp/vercel/*` extensions were pulled and
  then never used — a concrete instance of exactly the risk rule 1's "search before you build"
  discipline exists to prevent (an agent either re-pulling them again later, unaware they're
  already present, or never noticing they're available and reaching for raw `vercel` CLI/MCP
  calls instead, as has in fact happened repeatedly).
- This is architectural residue, not an isolated bug: AGENTS.md already states the intended
  architecture in rules 1 and 10, and every `command/shell` model listed above is independently,
  correctly-scoped for its own narrow verification purpose — the mismatch is systemic (the
  documented rule and the repository's actual swamp state have simply never been reconciled),
  not something fixable by changing one call site.

## Containment

- Do not add a new `command/shell` model for a *new* recurring provider automation without first
  running `swamp extension search`/`swamp model type search` for that provider, per rule 1 —
  this already applies going forward; this ARR does not change that.
- Do not pass a real provider credential as a `command/shell` `env` argument for any provider
  that has a typed extension available (Vercel, GitHub, Cloudflare) — use the typed model instead.
- Do not silently leave a newly-pulled extension unused across a session boundary again without
  either creating a model from it in the same change or explicitly noting the follow-up.

## Resolution criteria

- Every `command/shell` model in the list above is reviewed and either: (a) migrated to a typed
  extension model where one exists and the operation is genuinely recurring provider automation,
  or (b) deliberately kept as `command/shell` with a documented reason (e.g. it only orchestrates
  this repository's own `npm`/`npx` scripts, not a third-party provider API) — the blanket
  current state (twelve procedures, all `command/shell`, no review) is what must not remain.
- No provider credential is persisted in plaintext in swamp report/data for any model created or
  modified after this ARR is dispositioned — either via a vault-backed typed extension, or, where
  `command/shell` is deliberately kept, via a vault-referenced value rather than a raw `env`
  string.
- A decision is made and recorded (ADR or explicit disposition here) on whether Neon and Brevo
  automation — which currently have no available swamp extension at all — get a custom
  `extensions/models/` build (rule 1(e), last resort but justified here given no alternative
  exists) or stay as contained, vault-secured `command/shell` exceptions.
- The `@swamp/vercel/deployments`/`@swamp/vercel/projects` extensions are either backing at least
  one real model, or explicitly removed from `extensions/models/upstream_extensions.json` — not
  left pulled-and-unused.

## Disposition

Pending. This ARR's own investigation resolved several of its smaller symptoms directly (pulling
`@webframp/cloudflare`; creating a `provider-secrets` vault and a first real, vault-backed Vercel
and Cloudflare model each — see History) but leaves the larger questions open: which of the
twelve `command/shell` procedures should migrate, whether Neon/Brevo warrant a custom extension
build, and whether a real swamp workflow should replace the ad-hoc `swamp-procedure` tagging
convention. These require scoping decisions beyond what this audit alone can responsibly commit
to.

## Related decisions

- AGENTS.md rules 1 and 10 — the standing instruction this residue diverges from (not itself an
  ADR, but the closest thing to a durable decision already on record for this question).
- ADR-0150 — Scaleway as the credential broker's deployment target, relevant to the Scaleway
  coverage gap noted above.

## Related implementation

- `docs/agents/issue-and-arr-workflow.md` — the issue/ARR decision-guide this record itself
  follows.

## Supersedes

None.

## Superseded by

None.

## History

### 2026-09-24

Record created, following a user-requested audit of whether this repository's agent instructions
and existing swamp state consistently drive Vercel/Neon/Cloudflare/Brevo/Scaleway/GitHub work
through swamp per AGENTS.md rules 1/10. Found the credential-exposure consequence directly while
inspecting an existing `command/shell` model's report history — confirmed the secret never left
this machine (swamp data is local-only in this repository; no `.swamp-sources.yaml`, never
committed to git) but recommended rotation regardless, out of band from this record.

Same-day remediation, scoped narrowly (not a resolution of this ARR): pulled the
`@webframp/cloudflare` extension (previously not installed at all). The two already-pulled
`@swamp/vercel/deployments`/`@swamp/vercel/projects` extensions were deliberately **not** used to
create a model in this pass — doing so would require a Vercel API token as a global argument, and
with no vault yet configured in this repository (`swamp vault list` → empty), creating that model
now would mean passing the token some other, unsafe way, repeating the exact pattern this ARR
documents rather than fixing it. The pull itself is kept (legitimate, reusable state for whoever
sets up the vault), but building a real Vercel model is left as explicit follow-up work, gated on
a vault existing first — not silently abandoned, and not resolved either. Neither action resolves
this ARR's core finding — the twelve-model `command/shell` review, the Neon/Brevo
extension-vs-vault decision, and the missing-workflow question all remain open.

### 2026-09-24 (continued) — vault created, first Vercel and Cloudflare models wired

Follow-up in the same session: created a `provider-secrets` `local_encryption` vault and seeded
it with `NEON_API_KEY`, `VERCEL_TOKEN`, `CLOUDFLARE_API_TOKEN`, and `BREVO_API_KEY` (the user
added the last one to `.env` specifically for this). Seeding used a one-off script the user ran
themselves (`! node ...` in Claude Code) that pipes each value from `.env` straight into
`swamp vault put` via stdin, printing only `STORED`/`SKIP`/`FAILED` per key — per the swamp-vault
skill's own guidance, the agent never read a secret value directly at any point.

Created `vercel-project-matchboard` (`@swamp/vercel/projects/projects`, `token` global argument
set to `${{ vault.get(provider-secrets, VERCEL_TOKEN) }}`) and ran `lookup` — succeeded,
importing the real `matchboard` project's live state. Created `cloudflare-zone-matchboard`
(`@webframp/cloudflare/zone`, same vault-reference pattern for `apiToken`) and ran `get` against
the real `matchboard.football` zone — also succeeded. Both models' persisted
`@swamp/method-summary` reports show the credential redacted (`"apiToken": "***"`) rather than
the plaintext exposure `command/shell` produced — direct, concrete confirmation that the typed
extension + vault pattern actually closes the gap this ARR documents, not just in theory.

Not yet done: `@swamp/vercel/deployments` (the other pulled-but-unused Vercel extension) still
backs no model — left that way deliberately rather than building an unneeded deploy-creation
model just to close the resolution criterion's letter; still open. Neon and Brevo now have their
credentials sitting in the vault, ready for whenever an extension exists (or a documented
vault-referenced `command/shell` exception is chosen) — but no model was created for either, since
no swamp extension exists for either provider. The twelve-model `command/shell` review and the
missing-workflow question remain untouched.
