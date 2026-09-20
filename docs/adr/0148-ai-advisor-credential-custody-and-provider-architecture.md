# ADR-0148: AI Advisor — credential custody boundary and provider architecture

## Status

Accepted (2026-09-20). Partially implemented: this ADR is written and merged alongside the first
implementation slice (Prisma schema only — see "Delivery" below); it governs the full multi-PR
programme, not only what has landed so far.

## Context

Matchboard is adding an **AI Advisor**: organisation-scoped, owner-configured, opt-in, structured
AI review across exactly five capabilities (`round_review`, `lineup_review`, `match_prep`,
`post_match_review`, `weekly_team_review`). This is a genuinely new class of architecture for this
repository:

- It is the first feature that makes **outbound HTTP calls at runtime** to third-party services
  (five AI provider APIs). ADR-0028 explicitly recorded "no outbound HTTP calls at runtime" as
  true of the codebase as of 2026-07-29; this ADR changes that invariant.
- It introduces the first **third-party secret custody boundary**: organisation-supplied AI
  provider API keys must never be persisted in Matchboard's own Neon database or application
  configuration.
- It introduces the first use of **asymmetric (Ed25519/EdDSA) JWT signing** via `jose` — the two
  existing `jose` call sites (`src/lib/machine-principal/machine-token.ts`,
  `src/lib/live-match/realtime/realtime-ticket.ts`) are both symmetric HS256.
- It adds five new organisation-scoped Prisma models and a new Prisma-table-backed job queue.

The product, security, and provider contracts for this programme were fully specified in advance
in an external implementation bundle
(`.matchboard-work/matchboard-ai-advisor-implementation-bundle/`, 15 numbered documents plus
golden UI references) and are **not re-derived here** — this ADR records the architectural
decision the bundle already locked, cross-referenced against this repository's actual
conventions, so future work in this codebase does not reopen or contradict it. A companion
planning digest (`.../DIGEST.md`) maps every bundle contract onto concrete file paths, existing
patterns to reuse, and a phase-by-phase delivery plan; it is a working reference, not a durable
record, and may go stale — this ADR is the durable one.

No ADR previously existed for AI capabilities, credential-custody architecture, or third-party AI
provider integration in this repository (confirmed by scanning `docs/adr/0000`–`0147`).

## Decision

### 1. Credential custody lives entirely outside Matchboard, in `matchboard-security`

Provider API keys (OpenAI, Anthropic, Google Gemini, Mistral, Ollama Cloud) are **never** stored
in Neon, never stored in Matchboard application configuration, and never returned to the browser
after enrollment. A separate, already-specified sibling service, `matchboard-security`, is
**credential custody only**:

- accepts a provider credential during browser-direct enrollment (the credential is sent by the
  browser directly to `matchboard-security`'s public enrollment endpoint — it never transits a
  Matchboard API route);
- stores it in a dedicated secret-manager/KMS boundary;
- authorizes just-in-time credential access to an authenticated Matchboard server workload via a
  private `/v1/credentials/access` endpoint.

`matchboard-security` does **not** construct prompts, own football terminology, call AI providers
on Matchboard's behalf, interpret football data, or persist AI reviews or insights. Those
responsibilities stay in Matchboard.

A retrieved credential is process-memory-only inside a narrow server-only Matchboard boundary
(`withProviderCredential(connectionId, async (credential) => {...})` — no general `getCredential()`
export whose return type could leak the credential) and must never be logged, cached, serialized,
or persisted.

Two independent Ed25519 signing keypairs authenticate Matchboard to `matchboard-security`: one for
enrollment tokens, one for credential-access tokens. Both are short-lived (90s), server-only, and
distinct from every existing signing key in this repository.

**Repository status at the time of this ADR**: nothing in this codebase confirms
`matchboard-security` is deployed or reachable — the only prior reference to it
(`docs/adr/0028-security-baseline-and-threat-model.md`'s "Related" section) links to a spec file
that does not exist in this repository. Per explicit direction from the decision owner, this
service is real and its connection details will be supplied when the enrollment work (delivery
phase 5 below) is reached. Until then, all Matchboard-side work is built and tested against a
local fake/stub transport (mirroring the existing `src/lib/email/{provider.ts,brevo-provider.ts,
fake-provider.ts,provider-factory.ts}` real/fake/factory shape) — this is not a workaround, it is
the bundle's own required test doctrine ("E2E coverage... using fake security/provider
transports. Never use a real provider credential in CI").

### 2. Exactly five provider adapters, no arbitrary base URLs, no generic OpenAI-compatible adapter

The production adapter registry is fixed and code-owned:

| Provider ID | Label | Base URL |
|---|---|---|
| `openai` | OpenAI | `https://api.openai.com` |
| `anthropic` | Anthropic / Claude | `https://api.anthropic.com` |
| `google_gemini` | Google Gemini | `https://generativelanguage.googleapis.com` |
| `mistral` | Mistral AI | `https://api.mistral.ai` |
| `ollama_cloud` | Ollama Cloud | `https://ollama.com/api` |

No organisation-configurable base URL is ever accepted (this is a deliberate SSRF-risk boundary,
not an oversight — a Vercel-hosted server accepting an arbitrary organisation-supplied endpoint
URL is a materially different, larger attack surface than five fixed hosts). Ollama specifically
means **Ollama Cloud only** in production; a self-hosted/localhost Ollama endpoint is a
development-only, environment-variable-configured override, never an organisation setting.
Additional providers, or a generic OpenAI-compatible adapter, are explicitly out of scope for this
programme and require their own future decision.

### 3. Dynamic model discovery, never a hard-coded model matrix

After a credential is enrolled, Matchboard retrieves the provider's own model-list endpoint
server-side, returns only model metadata/IDs to the browser, and requires a model to pass a
synthetic capability probe before a connection can become `READY`. No exhaustive
provider/model matrix is maintained in this codebase, and the retrieved catalogue itself is not
persisted — only the selected model ID and safe connection metadata are.

### 4. AI is subordinate to Matchboard's deterministic engines

AI never mutates canonical football state directly. It produces persisted advisory
interpretation only (`AiAdvisorReview` / `AiAdvisorInsight`). The one path with any write
consequence — a proposed development observation — requires explicit coach confirmation through
the **existing** development/evidence confirmation workflow; AI never writes directly into
`DevelopmentThreadObservation`/`PlayerDevelopmentObservation`. AI is organisation-scoped, disabled
by default, opt-in at both a master switch and a per-capability level, and runs only from
server-side triggers or scheduled jobs — never from page load, and never as free-form chat, a
prompt field, or a floating assistant.

### 5. Data minimization: pseudonymized, ephemeral-ref payloads only

Provider payloads never contain player names, user names, email addresses, the organisation name,
Matchboard database IDs, credentials, or arbitrary free text. Player identities sent externally
use ephemeral refs (`P01`, `P02`, ...) resolved back to real records locally, only after complete
response validation. This pseudonymized data remains personal data — it is not described as
anonymous anywhere in documentation.

### 6. Reuse this repository's existing tenancy, authorization, and queue conventions

New AI models follow the established organisation-scoping convention exactly (`organisationId` +
`@@index` + `onDelete: Cascade`, RLS_TABLES allowlist entry, a companion RLS migration).
`requireOwnerRole()` (`src/lib/auth/actor-context.ts`) — an existing, correct, but
currently-under-used helper — is used explicitly in every AI settings/connection route, rather
than the inline `ctx.role === "OWNER"` checks used elsewhere; this is a deliberate choice to use
the more auditable existing primitive for a new security-sensitive surface, not a new
authorization model. The AI job queue is a plain Prisma-table-backed queue with atomic claim
semantics (`AiAdvisorJob`), following the existing `NotificationOutbox` pattern
(`src/lib/email/outbox.ts`) — no new queue infrastructure dependency.

## Alternatives considered

### Route provider credentials through a Matchboard API endpoint

- Benefits: one fewer network hop to reason about; browser only ever talks to Matchboard.
- Costs: Matchboard's own API surface would transiently see raw provider credentials, requiring
  Matchboard's own logging/request-capture infrastructure to be provably credential-safe on every
  code path that could touch that route, forever.
- Reason not selected: the bundle's browser-direct-enrollment design keeps credentials off
  Matchboard's server entirely for the highest-risk step (initial submission); Matchboard only
  ever retrieves a credential just-in-time, transiently, for an already-scoped operation.

### A single generic OpenAI-compatible adapter with an organisation-configured base URL

- Benefits: less adapter code; trivially supports any provider without a new implementation.
- Costs: accepting an arbitrary organisation-supplied base URL from a Vercel-hosted server is a
  concrete SSRF/private-network risk surface, and "OpenAI-compatible" providers do not actually
  share one stable request/response contract in practice.
- Reason not selected: rejected outright by the locked product decision; five fixed, code-owned
  adapters against fixed hosts is the accepted boundary.

### A hard-coded provider/model matrix

- Benefits: no runtime model-discovery call; simpler to reason about a fixed catalogue.
- Costs: providers add/deprecate models continuously; a hard-coded matrix goes stale immediately
  and either blocks legitimately available models or silently offers withdrawn ones.
- Reason not selected: dynamic discovery plus a capability probe keeps the provider's own API as
  the source of truth for what a given credential can actually use.

## Consequences

### Positive

- A clear, narrow, auditable boundary for the highest-risk part of this programme (credential
  handling) that never touches Matchboard's own persistence layer.
- The five-provider, fixed-host, no-arbitrary-URL registry closes an entire class of SSRF risk
  before it can be introduced.
- AI review data follows the same tenancy, RLS, and job-queue conventions as every other
  organisation-scoped feature in this codebase — no parallel architecture to maintain.
- AI's advisory-only, confirm-before-canonical design means a wrong or malformed AI response can
  never corrupt football facts, selection state, or evidence records.

### Negative

- A new, real dependency on external infrastructure (`matchboard-security`, five third-party
  provider APIs) that this repository cannot independently verify the deployment or behavior of.
- New signing-key infrastructure (two Ed25519 keypairs) with no in-repo precedent — this is
  genuinely new surface area to get right and to operate (key rotation, environment scoping).
- Five independent provider adapters is meaningfully more integration surface than one, and each
  provider's actual API shape drifts over time (mitigated by `13_PROVIDER_API_REFERENCE.md` and a
  bounded adapter interface, but not eliminated).

### Risks and mitigations

- **`matchboard-security` reachability/contract conformance is unverified from this repository.**
  Mitigation: build and test the entire Matchboard-side implementation against a fake/stub
  transport first (see Section 1); treat real enrollment/credential-access as requiring an
  explicit, separate verification pass once real connection details are available, before any
  production go-live for real provider connections.
- **A malformed or malicious provider response could otherwise leak into UI or persisted data.**
  Mitigation: every provider result undergoes local schema and semantic validation, and evidence
  refs are validated and resolved locally, before persistence; a response that fails validation is
  rejected wholesale, never partially trusted.
- **Ollama Cloud has no structured-output support**, unlike the other four providers. Mitigation:
  prompt-constrained JSON plus strict local validation and exactly one bounded repair retry before
  failing that capability run — explicitly narrower than the other adapters' native JSON-schema
  path, not a silent behavioral gap.

## Migration and compatibility

Purely additive. No existing table, column, index, or route changes. The five new Prisma models
(`OrganisationAiSettings`, `AiProviderConnection`, `AiAdvisorReview`, `AiAdvisorInsight`,
`AiAdvisorJob`) and ten new enums are introduced in
`prisma/migrations/20260920120000_add_ai_advisor_models/`, which also enables row-level security
and creates tenant-scoped policies for all five tables, matching this repository's existing RLS
convention (`src/lib/db.ts`'s `RLS_TABLES` allowlist is the primary application-level enforcement
point; database RLS is defence-in-depth). No data backfill is required — every organisation starts
with AI fully disabled (no `OrganisationAiSettings` row is required to exist; its absence is
equivalent to "AI disabled").

Rollback is a straightforward migration-down (drop the five tables/enums) with zero blast radius
into existing features, since nothing outside this programme reads or writes these tables.

## Security and operations

- All signing/credential/provider modules are server-only (`import "server-only"`).
- Provider credentials, signed auth tokens, raw provider inputs/outputs, and full AI context
  documents are never logged.
- Requests carrying provider credentials never follow redirects, and use fixed HTTPS hosts per
  adapter only.
- Provider connection management and organisation-level AI enablement are owner-only
  (`requireOwnerRole`). Coaches can consume AI insights only where existing Matchboard
  authorization already permits access to the underlying football scope — no new role model.
- Production Vercel environment variables for this programme
  (`AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64`, `AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64`,
  `AI_SECURITY_FUNCTION_TOKEN`, `AI_SECURITY_ENROLLMENT_URL`, `AI_SECURITY_RUNTIME_URL`) are
  manual operator setup, out of this repository's automated delivery — see
  `.matchboard-work/matchboard-ai-advisor-implementation-bundle/10_MANUAL_VERCEL_SECRET_SETUP.md`.
  No tenant provider API key is ever placed in Vercel environment configuration. Preview
  environments receive none of the production signing keys; real enrollment stays disabled in
  Preview until an independent non-production `matchboard-security` boundary exists.

## Related records

- `.matchboard-work/matchboard-ai-advisor-implementation-bundle/` — the full locked product,
  security, provider, data-model, UI, and test contract this ADR governs implementation of
  (`01_LOCKED_DECISIONS.md` through `14_GOLDEN_REFERENCE_GUIDE.md`).
- `.matchboard-work/matchboard-ai-advisor-implementation-bundle/DIGEST.md` — working planning
  digest cross-referencing the bundle against this repository's concrete file paths and
  conventions; a phase-by-phase delivery plan; not durable, may go stale.
- ADR-0028 (security baseline) — this ADR changes its "no outbound HTTP calls at runtime"
  context statement; ADR-0028 itself is not superseded, its context note is now historical.
- ADR-0037 / ADR-0087 — the row-level security and fail-closed tenant-scoping conventions this
  ADR's new models follow unchanged.
- ARR-0036 (schema migration history drift) — the AI Advisor migration is hand-curated to exclude
  this pre-existing, unrelated drift, matching the precedent set by
  `20260831070000_guestplayer_and_shared_participant_model`.

## Delivery

Implemented as a sequential series of PRs (one open at a time, per this repository's delivery
convention), tracked informally against the bundle's own 20-step delivery order and the digest's
phase breakdown. This ADR lands with **PR 1: Prisma schema and RLS migration only** — no
application code yet. Every subsequent PR in the programme (provider registry, signing tokens,
`matchboard-security` client, connection/settings routes, model discovery, provider adapters,
fingerprinting, job queue, the five capabilities, contextual UI, development-observation
confirmation wiring) is governed by this ADR; they are not expected to each carry their own ADR
unless a later PR needs to materially deviate from what is decided here, in which case this ADR is
amended or superseded per this repository's ADR governance rules, not silently contradicted.

## History

- 2026-09-20: Created and accepted alongside the Prisma schema/migration PR that begins this
  programme's implementation.
- `post_match_review` (the first of the five capabilities) landed end-to-end: capability context
  builder, capability-handler registry, domain triggers wired into League and Event report
  completion, and cron-runner registration. No deviation from what this ADR decided; recorded here
  per the delivery-tracking convention above, not as an amendment.
- `round_review` (the second capability) landed end-to-end: capability context builder scoped to
  `MatchRound`, wired as a domain trigger into `ensureMatchPlanningBaselineCaptured()` — the same
  automatic, non-coach-operated boundary-close that already owns round finalization per
  ADR-0109/ARR-0042. No deviation from this ADR's decisions.
- `lineup_review` (the third capability) landed end-to-end: capability context builder scoped to
  `Match`, wired as a domain trigger into every draft line-up/rotation-plan mutation (add/remove/
  change-role/move-player selection edits and planned-rotation create/update), debounced 2 minutes
  and collapsed to the newest fingerprint per (org, capability, scope) via a new
  `enqueueDebouncedAiJob()` — no runner change was needed, since `AiAdvisorJob.nextAttemptAt`
  already gated job claims. Eligibility ("a complete plan is saved") is proxied by CORE-role
  selection count reaching `Match.squadSize`; no deviation from this ADR's decisions.
- `match_prep` (the fourth capability) landed end-to-end: capability context builder scoped to
  `Match`, with a new cron-driven discovery step (`jobs/scheduled-triggers.ts`'s
  `enqueueDueMatchPrepJobs()`, called from `/api/cron/ai` before the existing job-claim batch)
  scanning fixtures in the 24-hours-to-kickoff window and reusing `triggerAiCapability()` per
  match — no separate eligibility/dedup logic was needed there, since `triggerAiCapability`
  already re-checks capability enablement, domain eligibility, and the fingerprint/dedup rule.
  "Confirmed opponent sporting evidence" and "structured development focus categories" are
  sourced only from existing structured/categorical fields (`OpponentSportingEvidence`'s computed
  estimate, `OpponentEncounterObservation`'s categorical tags, `DevelopmentThread.category`),
  never their free-text sibling fields, per this ADR's "no arbitrary free-text notes in v1" rule.
  No deviation from this ADR's decisions.
