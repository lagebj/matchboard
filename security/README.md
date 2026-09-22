# Matchboard Security

This directory is the converged AI credential security subsystem, originally developed and
operated as the separate `lagebj/matchboard-security` repository and merged into `lagebj/matchboard`
for shared repository governance, CI/CD, dependency maintenance, and documentation. **Repository
ownership converged; the runtime trust boundary did not.** This subsystem remains an independent
security and deployment boundary inside the Matchboard repository — see "Trust boundaries" below.

Governing ADR: `docs/adr/0148-ai-advisor-credential-custody-and-provider-architecture.md` (credential
custody architecture) and the convergence ADR referenced from the main architecture documentation.

## Purpose

Matchboard's AI Advisor feature lets a coach connect an organisation's own AI provider API key
(OpenAI, Anthropic, Google Gemini, Mistral, Ollama Cloud) so Matchboard can call that provider on
the organisation's behalf. That credential is tenant-supplied, third-party secret material that
must never be stored in Matchboard's own Neon database, application configuration, Git history, or
CI/CD systems. This subsystem exists to hold and broker access to that credential in an isolated,
independently deployed boundary, so a compromise of the Matchboard web application cannot, by
itself, expose tenant AI provider credentials.

## Components

- **`broker/enrollment`** — a standalone Go module/serverless function. Accepts a tenant's AI
  provider credential directly from the browser (never via a Matchboard API route) during
  connection enrollment, validates a short-lived signed enrollment token from Matchboard, and
  stores the credential in Scaleway Secret Manager.
- **`broker/runtime`** — a standalone Go module/serverless function. Accepts a short-lived signed
  runtime token from an authenticated Matchboard server workload and returns the credential for a
  single connection, retrieved just-in-time from Scaleway Secret Manager. The credential is never
  cached or logged by this function.
- **`infra/prod`** — OpenTofu configuration that owns the existing production Scaleway
  infrastructure: the `matchboard-ai-enrollment` and `matchboard-ai-runtime` serverless function
  namespaces/functions, packaged from `broker/enrollment` and `broker/runtime` respectively.
- **Scaleway Secret Manager** — stores each tenant credential as an individual secret under the
  path `/matchboard/ai-connections`, named by connection ID, encrypted with a dedicated KMS key.
- **Scaleway KMS** — provides the encryption key (`AI_SECRET_KMS_KEY_ID`) used to protect secrets
  created by the enrollment function.

## Trust boundaries

- **Matchboard application (web/runtime)**: can request a credential for a specific connection ID
  it already owns, using a short-lived signed runtime token it mints itself. It never receives
  direct Scaleway Secret Manager, KMS, or deployment credentials. A retrieved credential is held
  only in process memory for the duration of a single provider call and is never logged, cached,
  serialized, or persisted (`withProviderCredential(...)` in the main Matchboard source, no
  general `getCredential()` export).
- **Enrollment function**: can create and protect a Secret Manager secret for a connection ID it
  has authorized via a validated enrollment token. It cannot read back a credential it stored, and
  cannot serve the runtime credential-access endpoint.
- **Runtime function**: can read (not write) a single named secret per authorized, validated
  runtime token. It cannot create, modify, or enumerate secrets.
- **CI/CD (GitHub Actions)**: plan credentials (`SCW_PLAN_ACCESS_KEY`/`SCW_PLAN_SECRET_KEY`) can
  read infrastructure state and produce plans; deploy credentials
  (`SCW_DEPLOY_ACCESS_KEY`/`SCW_DEPLOY_SECRET_KEY`) are used only in the manual, confirmation-gated
  production-apply workflow. Neither credential pair is exposed to Vercel, the Matchboard
  application runtime, or application-only workflows/tests.

## Credential lifecycle

1. A coach submits a provider API key from the browser directly to the enrollment function's
   public endpoint — the credential never transits a Matchboard API route or the Matchboard
   server.
2. The enrollment function validates a short-lived (≤2 minute), Ed25519-signed enrollment token
   that Matchboard minted for that specific connection ID and provider, then creates a Secret
   Manager secret at `/matchboard/ai-connections/<connectionId>`, writes the credential as its
   first version, and marks the secret protected (deletion-protected).
3. If any step after secret creation fails, the enrollment function deletes the partially created
   secret (cleanup-on-failure) so no orphaned, empty credential record is left behind.
4. A duplicate enrollment attempt for the same connection ID is rejected
   (`connection_already_exists`) rather than silently overwritten.
5. When Matchboard needs the credential to make a provider call, its server workload mints a
   short-lived runtime token and calls the runtime function's `/v1/credentials/access` endpoint.
   The function verifies the token, reads the secret's latest enabled version, and returns the
   decoded credential once. Matchboard holds it in memory only for the duration of that call.
6. Nothing in this lifecycle ever writes the raw credential to Git, GitHub Actions
   secrets/variables, OpenTofu variables/state, generated plans, build artifacts, logs,
   documentation, tests, or fixtures.

## Token model

Both enrollment and runtime tokens are short-lived (≤2 minutes, with a 30s clock-skew allowance),
Ed25519 (EdDSA)-signed JWTs, verified against a distinct public key per surface
(`MB_ENROLLMENT_TOKEN_PUBLIC_KEY_B64` / `MB_RUNTIME_TOKEN_PUBLIC_KEY_B64`). Each token carries a
fixed issuer (`matchboard`), a surface-specific audience and operation claim, a token ID, and a
connection ID (the enrollment token also carries the provider). The broker verifies issuer,
audience, operation, all standard timing claims (`iat`/`nbf`/`exp`), and that the request body
matches the token's claims before acting. Private signing material lives only in Matchboard's own
server-only configuration and is never present in this subsystem.

## Infrastructure ownership

`security/infra/prod` owns the existing production Scaleway infrastructure through the existing
remote OpenTofu state — the same state, backend, bucket, and key that were authoritative before
this convergence. Converging the source repository did not create replacement infrastructure,
rename OpenTofu resource addresses, or migrate state. See "Deployment" below for how that ownership
is exercised safely (plan before apply, manual apply only).

## Secret ownership

- **GitHub Actions CI credentials** (`SCW_PLAN_ACCESS_KEY`/`SCW_PLAN_SECRET_KEY`,
  `SCW_DEPLOY_ACCESS_KEY`/`SCW_DEPLOY_SECRET_KEY`): Scaleway credentials used only by this
  subsystem's own workflows to plan/apply infrastructure. Never exposed to Vercel or application
  workflows.
- **GitHub Actions variables** (`SCW_PROJECT_ID`, `SCW_REGION`, `AI_SECRET_KMS_KEY_ID`,
  `ENROLLMENT_TOKEN_PUBLIC_KEY_B64`, `RUNTIME_TOKEN_PUBLIC_KEY_B64`, `TOFU_STATE_BUCKET`,
  `TOFU_STATE_KEY`): non-secret configuration and public verification keys, consumed by OpenTofu
  and passed into the deployed functions as plain environment variables.
- **Externally managed function secrets** (`secret_environment_variables` on the Scaleway function
  namespaces, e.g. `MB_SCALEWAY_SECRET_KEY`): managed outside OpenTofu's authority on purpose.
  `lifecycle { ignore_changes = [secret_environment_variables] }` on both namespaces prevents
  OpenTofu from ever reading, planning, or overwriting them.
- **Tenant/provider AI credentials**: live only in Scaleway Secret Manager, under
  `/matchboard/ai-connections`. Never any of the above.

## Deployment

- **Validation** (`Security Broker / Validate`): runs on every change to `security/broker/**` or
  `security/infra/**` (and on push to `main`). Builds and tests both Go modules; runs
  `tofu fmt -check -recursive`, `tofu init -backend=false`, and `tofu validate` with no backend and
  no credentials.
- **Plan** (`Security Broker / Plan`): runs on pull requests touching `security/infra/**` or
  `security/broker/**`. Initialises against the real remote backend using read-only plan
  credentials and produces a plan for review. Never applies.
- **Production apply** (`Security Broker / Apply Production`): manual (`workflow_dispatch`) only,
  gated behind an explicit `confirm: APPLY-PROD` input. Uses deploy credentials scoped to this
  workflow alone. Never runs automatically on merge to `main`.
- **State backend**: the existing Scaleway S3-compatible backend
  (`https://s3.nl-ams.scw.cloud`), configured via the `TOFU_STATE_BUCKET`/`TOFU_STATE_KEY`
  variables at init time — unchanged by this convergence.

## Security invariants

These are load-bearing and must hold for any future change to this subsystem:

1. Tenant/provider AI credentials live only in Scaleway Secret Manager — never in Git, GitHub
   Actions secrets/variables, OpenTofu variables/state, plans, build artifacts, logs,
   documentation, tests, or fixtures.
2. The Matchboard web/application runtime never receives direct Secret Manager, KMS, or Scaleway
   deployment credentials.
3. CI credentials used to plan/apply this subsystem's infrastructure are never exposed to Vercel,
   the Matchboard application runtime, application builds, or unrelated workflows/jobs.
4. `secret_environment_variables` on the deployed function namespaces remain outside OpenTofu's
   authority (`lifecycle.ignore_changes`); OpenTofu never becomes authoritative for them.
5. Signing private keys are never committed; only public verification keys may live in
   repository/CI configuration (as GitHub Actions variables), never in source.
6. Enrollment and runtime remain separate trust surfaces (separate Go modules, separate functions,
   separate token audiences) and must not be merged merely because they share a repository.
7. Production infrastructure apply remains manual and explicitly confirmed — never automatic on
   merge to `main`.

## Development

From `security/broker/enrollment` or `security/broker/runtime`:

```sh
go build ./...
go test ./...
```

From `security/infra/prod`:

```sh
tofu fmt -check -recursive
tofu init -backend=false   # static validation only, no credentials required
tofu validate
```

Producing a real plan against the production remote state additionally requires the plan
credentials and variables listed in "Secret ownership" above (available in CI as
`SCW_PLAN_ACCESS_KEY`/`SCW_PLAN_SECRET_KEY` and the corresponding `vars.*`); do not attempt this
locally with production credentials.
