# ADR-0112: Canonical live-match projection and per-PR Worker deployment

## Status

Accepted

## Date

2026-09-02

## Decision owners

- Maintainer

## Context

ADR-0086 introduced Cloudflare Workers/Durable Objects as a second deployment target alongside Vercel/Neon. The live-match realtime path (Stages 1-4) sends canonical match events from a reporting coach's device through the Durable Object to both the reporting client and a "Follow live" read-only viewer.

Two related problems existed:

1. **Inconsistent observable state.** The reporting LiveMatchClient and the FollowLiveClient derived their displayed state (score, clock, on-field players, recent events) from different sources — the reporter maintained its own score/clock/player state alongside the canonical projection, creating drift risk where the two surfaces could show different facts for the same match session.

2. **Stale Worker in per-PR acceptance testing.** The `deploy-live-match-worker.yml` workflow only deploys the Worker after CI-green pushes to `main`. PR branches run their Playwright acceptance tests against a Vercel preview deployment pointed at the `test` slot, but the Worker serving `realtime-test.matchboard.football` is always the `main` version. Any PR that changes the Worker protocol, event shapes, or broadcast behavior tests against stale code — the E2E spec that exercises the realtime path (including the `follow-live.spec.ts` spec added alongside Follow live) was hitting a different Worker version than the one the PR's client code expected.

## Decision

### One canonical projection for all live-match surfaces

Both LiveMatchClient (reporting) and FollowLiveClient (viewing) derive ALL observable live-match state (score, clock, on-field players, recent events) from a single shared projection (`projectCanonicalLiveState` in `src/lib/live-match/live-match-projection.ts`). No surface maintains separate score, clock, or player state. The projection's inputs are the authoritative snapshot (from `getSnapshot()`) and realtime events (from `applyEvent` callbacks) — the same inputs the Durable Object broadcasts.

### Per-PR Worker deployment to the test environment

The `test-acceptance.yml` workflow now deploys the PR's Worker code to the Cloudflare test environment (`wrangler deploy --env test`) before running Playwright, so PRs that change the Worker test against their own Worker code. This mirrors how the Vercel preview deployment already works (the PR's app code is live in the test slot). The production Worker is still only deployed from `main` (unchanged — `deploy-live-match-worker.yml`).

## Rationale

A single canonical projection eliminates an entire class of drift bugs where two surfaces disagree about the same facts. Follow live was the immediate trigger, but the reporting client's own reconciliation logic (refresh consistency, Stage 4 persistence) also benefits from operating on the same projection.

Per-PR Worker deployment closes the same deployment gap that ADR-0075 closed for Vercel: the test environment should reflect the PR's code, not stale main code. The Worker is stateless code (same reasoning as ADR-0086: "a bad deploy degrades to the existing HTTP/local-first reporting path — it cannot corrupt data or block match reporting"), so deploying it per-PR carries the same risk profile as the Vercel preview deploy.

## Alternatives considered

### Separate projection per surface

- Benefits: each surface can evolve independently.
- Costs: drift is inevitable; two bugs to fix for every state inconsistency.
- Reason not selected: Follow live was already drifting from reporting in practice.

### Mock the Worker in E2E tests

- Benefits: no Cloudflare dependency in CI.
- Costs: the E2E spec exists specifically to exercise the real Durable Object path; mocking it defeats the purpose.
- Reason not selected: ADR-0086's amendment explicitly requires exercising the real path.

### Deploy Worker per PR to a preview environment (not test)

- Benefits: isolation from other test traffic.
- Costs: requires a separate Cloudflare Worker and domain per PR; no infrastructure exists for this.
- Reason not selected: `test.matchboard.football` already serializes PR acceptance (ADR-0075's concurrency group), so the test Worker is never serving two PRs simultaneously.

## Consequences

### Positive

- Live reporting and Follow live show identical state for the same session.
- E2E tests exercise the PR's own Worker code, catching protocol mismatches before merge.
- Refresh/reconnect consistency is derived from the same projection reset logic.
- The `period` and `matchSeconds` fields added to `CanonicalLiveEvent` are populated by the Worker from event data, giving both surfaces match-clock timestamps on events.

### Negative

- Per-PR Worker deploys add ~30 seconds to the acceptance pipeline (Wrangler build + deploy).
- Both surfaces share projection code, so a projection bug affects both equally — but this is preferable to two different bugs.

### Risks and mitigations

- **Worker deploy failure blocks acceptance.** Mitigated by: the Worker deploy step exits gracefully if Cloudflare secrets are not configured (same pattern as the existing required-secrets check), and a Worker deploy failure does not affect the Vercel deploy or Neon branch setup that already succeeded.
- **Test Worker version churn.** Mitigated by: ADR-0075's `concurrency: group: test-slot` serializes PR acceptance, so only one PR's Worker is live at a time.
- **Worker deploy race with main.** Mitigated by: `deploy-live-match-worker.yml` runs after CI-green pushes to main, which is a separate concurrency group from `test-slot`. The main-branch Worker deploy can race with a PR's Worker deploy, but both target the same `--env test` and Wrangler deploy is atomic (last writer wins). This is acceptable: the PR's deploy step runs after the Vercel deploy succeeds, and the E2E spec runs after the Worker deploy.

## Migration and compatibility

- `CanonicalLiveEvent` gained optional `period` and `matchSeconds` fields (additive, backward-compatible — old clients ignore unknown fields).
- The Worker populates these fields from `eventFields` when available. Old Worker code simply won't send them; the projection handles `undefined` gracefully.
- The `FollowLiveClient` was rewritten to use the shared projection. No migration needed — the old component is replaced in the same change.

## Security and operations

- The Worker deploy uses the same `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets already configured for the main-branch deploy workflow.
- `LIVE_MATCH_INTERNAL_SECRET_TEST` is synced on every Worker deploy (idempotent), matching the main-branch workflow's pattern.
- The per-PR deploy only targets `--env test`, never `--env production`. Production Worker deploys remain gated by the main-branch workflow.
- No new Cloudflare resources are created — the same pre-existing Worker is redeployed with new code.

## Related records

- ADRs: ADR-0086 (live-match realtime Cloudflare Durable Objects), ADR-0075 (per-PR feature acceptance pipeline)
- ARRs: None
- Security findings: None
- Issues or plans: None

## Implementation evidence

- Pull requests or commits: PR #401 (canonical projection + per-PR Worker deploy)
- Tests or verification: `e2e/follow-live.spec.ts` exercises the real Durable Object path; Worker typecheck and unit tests in CI; local Playwright test passes.
- Provider evidence: Wrangler deploy logs from `test-acceptance.yml`

## Supersedes

None.

## Superseded by

None.

## History

### 2026-09-02

Record created. Per-PR Worker deployment step added to `test-acceptance.yml`. Canonical projection (`projectCanonicalLiveState`, `canonicalEventToSummary`) introduced in `src/lib/live-match/live-match-projection.ts`. `FollowLiveClient` rewritten to use shared projection.