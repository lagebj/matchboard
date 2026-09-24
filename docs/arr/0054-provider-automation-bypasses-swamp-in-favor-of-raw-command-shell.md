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
`command/shell` `env` value. Recurring multi-step provider sequences (deploy → verify →
restore-baseline, etc.) are expressed as swamp workflows, not as a naming convention
(`swamp-procedure` tags) layered on top of independent shell-command models.

**Correction (2026-09-24, see History):** the "use `command/shell` for these twelve procedures at
all" question is *not* open — ADR-0068 already decided it explicitly, as "a known, documented
deviation from Swamp's own house rule, not an oversight," specifically because no official
`@swamp/*` extension existed for GitHub, Vercel, or Neon/Postgres at the time, and a
Matchboard-owned extension was "disproportionate effort for thin wrappers around CLIs... already
installed, authenticated, and documented as sanctioned." ADR-0069, ADR-0090, and ADR-0076 each
extended three more procedures under that same accepted decision. What none of those four ADRs
address, and what remains genuinely undecided, is narrower: **how a secret is passed into one of
these `command/shell` invocations** — that's the actual, sole cause of the demonstrated leak (see
Evidence/Impact), not the choice of `command/shell` itself.

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
- Never pass a real credential as a literal `command/shell` `env` value, for any of the twelve
  procedures — use a `${{ vault.get(provider-secrets, KEY) }}` expression instead (confirmed
  working, see History), regardless of whether that provider also has a typed extension.
- Do not silently leave a newly-pulled extension unused across a session boundary again without
  either creating a model from it in the same change or explicitly noting the follow-up.

## Resolution criteria

- ~~Every `command/shell` model in the list above is reviewed and either migrated or deliberately
  kept~~ — **satisfied for nine of the twelve by ADR-0068 already, and for the remaining three by
  ADR-0069/0090/0076 each individually** (see History, 2026-09-24 correction). No further review
  of *whether* these should be `command/shell` is required.
- No provider credential is persisted in plaintext in swamp report/data for any model invocation
  after this ARR is dispositioned — either via a vault-backed typed extension, or, for
  `command/shell`, via a vault-referenced `--input 'env.KEY=${{ vault.get(...) }}'` expression
  rather than a raw value. Confirmed working and documented (`docs/development/swamp-workflows.md`
  "Passing secrets") for all six secret-bearing procedures — but this criterion is only durably
  satisfied once every *future* invocation actually follows it; no enforcement mechanism exists
  beyond the documentation itself (see Containment).
- A decision is made and recorded (ADR or explicit disposition here) on whether Neon and Brevo
  automation — which currently have no available swamp extension at all — get a custom
  `extensions/models/` build (rule 1(e), last resort but justified here given no alternative
  exists) or stay as contained, vault-secured `command/shell` exceptions. Given ADR-0068 already
  accepted `command/shell` for exactly this reason (no extension existed) and the vault gap is now
  closed, the practical default is the latter unless a future task's complexity outgrows it — per
  ADR-0068's own stated revisit trigger.
- The `@swamp/vercel/deployments`/`@swamp/vercel/projects` extensions are either backing at least
  one real model, or explicitly removed from `extensions/models/upstream_extensions.json` — not
  left pulled-and-unused. `projects` now backs `vercel-project-matchboard`; `deployments` still
  does not (see History) — partially satisfied.

## Disposition

Pending, but narrower than originally scoped. The "should these twelve procedures be
`command/shell`" question is not open — already decided across ADR-0068/0069/0090/0076 (see
History correction). This ARR's own investigation directly resolved the actual open gap those
ADRs left — a `provider-secrets` vault now exists, all six secret-bearing procedures' credentials
are in it, the vault-expression invocation pattern is proven and documented
(`docs/development/swamp-workflows.md`), and two real typed models (Vercel, Cloudflare) prove the
same pattern for extension-backed providers. What remains: whether Neon/Brevo get a custom
extension or stay a documented vault-secured `command/shell` exception (leaning exception, not
yet formally recorded as such); `@swamp/vercel/deployments` still backing no model; and whether a
real swamp workflow should replace the ad-hoc `swamp-procedure` tagging convention for sequencing
these procedures. None of these blocks closing this ARR as *substantially* resolved — they're
follow-up scope, not the residue itself.

## Related decisions

- AGENTS.md rules 1 and 10 — the standing instruction this residue's narrower, vault-related
  remainder diverges from.
- **ADR-0068** (`docs/adr/0068-swamp-procedure-runner.md`) — already, explicitly decided that
  `command/shell` is acceptable for the original nine procedures, as a documented deviation from
  Swamp's own house rule, with a stated revisit trigger ("if these procedures grow beyond thin
  wrapping"). This ARR does not reopen that decision.
- **ADR-0069** (browser acceptance testing), **ADR-0090** (migration upgrade-path verification) —
  each individually extended a further procedure under ADR-0068's same accepted pattern.
- **ADR-0076** (test email correlation tags) — introduced `verify-invitation-email-flow` under the
  same pattern; the ADR itself never discusses secret/vault handling for the swamp model it
  introduces (checked directly) — the leak this ARR documents is a gap in a *later* addition to an
  established pattern, not a first violation of it.
- ADR-0150 — Scaleway as the credential broker's deployment target, relevant to the Scaleway
  coverage gap noted above.

## Related implementation

- `docs/agents/issue-and-arr-workflow.md` — the issue/ARR decision-guide this record itself
  follows.
- `docs/development/swamp-workflows.md` — the canonical, actively-referenced doc for how to
  invoke every one of the twelve `command/shell` procedures; now documents the vault-expression
  pattern for all six secret-bearing ones ("Passing secrets" section), the actual behavior change
  this ARR produced.

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

### 2026-09-24 (continued) — correction: the command/shell choice was already decided; closed the actual vault gap

Reviewing the twelve `command/shell` models' own scripts (via `swamp report get` for the nine
with recent report data, and direct script inspection for the three without) found `docs/adr/
0068-swamp-procedure-runner.md` — an existing, accepted ADR that **already** explicitly decided
`command/shell` is acceptable for nine of these twelve procedures, as a documented deviation from
Swamp's own house rule, reasoned through (no official extension existed for GitHub/Vercel/Neon at
the time; a custom extension was disproportionate for thin CLI wrappers), with a stated revisit
trigger. ADR-0069, ADR-0090, and ADR-0076 each individually extended a further procedure under
that same accepted pattern. This ARR's original framing — treating "should these be
`command/shell`" as open architectural residue requiring a new decision — was wrong; corrected
above ("Intended architecture", "Resolution criteria", "Related decisions"). The credential-leak
finding itself, and the real security consequence, are unaffected by this correction — only which
question is actually still open.

Re-classified all twelve by whether they pass a secret via `env` (checked every script directly,
not just the one with a cached leak): six do — `verify-migration-upgrade` (`NEON_API_KEY`),
`restore-test-baseline`/`verify-security`/`verify-database-change` (`TEST_DATABASE_URL`),
`verify-browser-acceptance`/`verify-invitation-email-flow` (`TEST_AGENT_AUTH_SECRET`, the latter
also `BREVO_API_KEY`) — three more than the single demonstrated case originally found. The other
six (`verify-repository`, `deploy-test-candidate`, `release-test-candidate`,
`investigate-ci-failure`, `inspect-deployment`, `verify-test-candidate`) rely on ambient `gh`/
`vercel` CLI sessions or hit public endpoints — no secret passed, no exposure.

Proved the actual fix empirically rather than asserting it: created a throwaway `command/shell`
model, passed a vault expression as a *method* argument (`--arg
env.PROBE='${{ vault.get(provider-secrets, VERCEL_TOKEN) }}'` — command/shell's `env` is a
per-invocation method input, not a model-level global argument, so there is no model file to
edit; the fix is entirely about how a future invocation is written) — confirmed the shell script
received the real value (without exposing it: printed only `resolved: yes, length=60`), and
confirmed the persisted `@swamp/method-summary` report stored the CEL expression string itself,
never the resolved value. Deleted the throwaway model afterward (`swamp model delete --force`,
confirmed no leftover file).

Added `TEST_DATABASE_URL` and `TEST_AGENT_AUTH_SECRET` to the `provider-secrets` vault (same
user-run seed-script pattern as before — see the prior entry) — all six secret-bearing
procedures' credentials now live in the vault. Rewrote every relevant example in
`docs/development/swamp-workflows.md` (the canonical, actively-read doc for invoking these
procedures) to use the vault-expression pattern instead of a raw placeholder value, and added a
"Passing secrets" section explaining why and pointing back to this ARR.

Note: this session's own throwaway-model test above was run without `--no-telemetry`, which
ADR-0068 requires on every invocation documented in this repository — an honest process slip
during ad-hoc verification, not a documented invocation pattern; nothing durable was produced
without it.

Still open: the Neon/Brevo custom-extension-vs-vault-exception decision (leaning toward the
latter per the updated Resolution criteria, not yet formally recorded as such); `@swamp/vercel/
deployments` still backs no model; no real swamp workflow exists to replace the ad-hoc
`swamp-procedure` tagging convention for sequencing these procedures.
