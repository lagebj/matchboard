# ADR-0150: Converge `matchboard-security` repository ownership into `matchboard` (`security/`)

## Status

Accepted (2026-09-22).

## Context

ADR-0148 established the AI credential custody boundary: tenant/provider AI credentials never
touch Matchboard's own Neon database or application configuration; a separate service,
`matchboard-security` (repository `lagebj/matchboard-security`), owns credential storage
(Scaleway Secret Manager + KMS) and just-in-time credential brokering (enrollment + runtime Go
functions), deployed via its own OpenTofu configuration against Scaleway serverless functions.
ADR-0148 explicitly states: "any future material change to this architecture requires an ADR
amendment or supersession per this repository's ADR governance rules, not a silent deviation."

Operating `matchboard-security` as a second repository had accumulated friction unrelated to the
security boundary itself: separate repository governance, separate coding-agent context, separate
CI/CD conventions, separate dependency maintenance (Dependabot), and a separate review process —
all for a subsystem whose actual security requirement is a **runtime trust boundary**, not a
**repository boundary**. Nothing about ADR-0148's credential-custody decision requires the broker
source code to live in a different Git repository from Matchboard's own source.

This ADR records the decision to converge `matchboard-security`'s source, infrastructure-as-code,
and CI/CD into `lagebj/matchboard` as a new top-level `security/` directory, while leaving every
runtime trust-boundary decision from ADR-0148 unchanged.

## Decision

### Repository convergence, not runtime convergence

`matchboard-security`'s complete implementation (both Go broker modules, the OpenTofu
configuration, and its CI/CD behaviour) is copied as-is into `lagebj/matchboard` under `security/`:

```
security/
  README.md
  broker/
    enrollment/   (Go module, unchanged package/function/behaviour)
    runtime/      (Go module, unchanged package/function/behaviour)
  infra/
    prod/         (OpenTofu, same resource addresses, same remote state)
```

Git history was not preserved (a straight content copy, not `git subtree`/`filter-repo`) — this is
a source-ownership convergence, not a history-preservation exercise. Existing files in this
repository's own `security/` directory (Semgrep/OSV/Gitleaks/ZAP scanner configuration used by
`.github/workflows/security.yml`) already established `security/` as this repository's root for
security tooling; `broker/` and `infra/` sit alongside them without collision.

### What did not change

- **Enrollment/runtime split**: still two independent Go modules, two independent trust surfaces,
  two independent Scaleway functions. Not merged.
- **Token model**: Ed25519/EdDSA short-lived (≤2 minute) signed tokens, issuer/audience/operation/
  timing/claim validation, distinct enrollment vs. runtime audiences. Unchanged.
- **Secret Manager path** (`/matchboard/ai-connections`), **KMS-backed secret creation**,
  **cleanup-on-failed-enrollment**, and **duplicate-connection rejection**. Unchanged.
- **Production infrastructure**: the same Scaleway project, region, function namespaces,
  functions, KMS key, and OpenTofu resource addresses. The migrated `infra/prod` configuration
  initializes against the **same existing remote OpenTofu state** (same S3-compatible backend,
  same bucket/key, supplied via the already-configured `TOFU_STATE_BUCKET`/`TOFU_STATE_KEY`
  repository variables) — no new state, no `moved` blocks, no resource renames.
  `lifecycle { ignore_changes = [secret_environment_variables] }` on both function namespaces is
  preserved so OpenTofu never becomes authoritative for externally managed function secrets
  (`MB_SCALEWAY_SECRET_KEY` in particular never enters OpenTofu state).
- **Trust boundary**: the Matchboard web/application runtime still has no direct Secret Manager,
  KMS, or Scaleway deployment credential access, regardless of shared source-repository ownership.
  CI credentials used to plan/apply `security/infra` remain scoped to that subsystem's own
  workflows and are never exposed to Vercel, the application runtime, or unrelated jobs.

### CI/CD, Dependabot, and Vercel isolation

- Three new workflows scope entirely to `security/**`: `Security Broker / Validate` (build+test
  both Go modules, `tofu fmt`/`init -backend=false`/`validate`, no credentials), `Security Broker /
  Plan` (real remote-state plan using read-only plan credentials, PR-triggered), and
  `Security Broker / Apply Production` (manual `workflow_dispatch` with a mandatory
  `confirm: APPLY-PROD` input, using deploy credentials — never automatic on merge to `main`).
  These are distinct from the pre-existing `Security` workflow (`.github/workflows/security.yml`),
  which is Matchboard's own application-level SAST/dependency/secret/authz scanning and is
  unrelated to this subsystem.
- `.github/dependabot.yml` gained two `gomod` entries, one per Go module
  (`/security/broker/enrollment`, `/security/broker/runtime`) — not a single root-level Go module,
  which does not exist. Existing npm/docker-compose/github-actions Dependabot configuration is
  unchanged.
- `scripts/vercel-ignore-build-step.sh` (Vercel's `ignoreCommand`, see
  `docs/adr/0075-per-pr-feature-acceptance-pipeline.md`) now also skips a Matchboard Vercel
  deployment when every changed file is under `security/**` (in addition to its existing
  docs-only skip), so a security-only change — including automated Go dependency bumps — does not
  consume a Matchboard Vercel deployment. Application changes and cross-cutting changes are
  unaffected; normal preview deployments and the Vercel Git integration remain otherwise enabled.

### Cutover

`lagebj/matchboard-security` is not deleted immediately. Per the migration plan: its production
apply workflow must be disabled before `lagebj/matchboard` is treated as the sole apply path for
the existing state (two live apply paths against the same state is not acceptable), then the old
repository is archived with a README pointer to `lagebj/matchboard`'s `security/` directory.

## Consequences

- Future security-subsystem changes (broker refactors, infra changes) follow normal Matchboard
  governance (ADR gate, PR review, CI) — there is no separate development process for the former
  `matchboard-security` repository.
- `security/**` remains a hard trust/deployment boundary inside a single source repository: shared
  ownership does not imply shared runtime privilege. Any change that would grant the Matchboard
  application runtime direct Secret Manager/KMS/deployment access, merge enrollment and runtime
  into one surface, or make production infrastructure apply automatic requires a new ADR
  amendment or supersession of this decision and of ADR-0148, not a silent deviation.
- This ADR does not re-open, redesign, or re-validate the credential-custody architecture itself
  (ADR-0148); it only relocates where that architecture's source code and infrastructure-as-code
  live.

## References

- ADR-0148: AI Advisor — credential custody boundary and provider architecture (the runtime trust
  boundary this ADR preserves unchanged).
- `security/README.md`: the primary description of this subsystem's components, trust boundaries,
  credential lifecycle, token model, and security invariants going forward.
